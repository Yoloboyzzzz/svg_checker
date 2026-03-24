import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

function loadFixture(name: string): string {
  return readFileSync(resolve(__dirname, `../fixtures/${name}`), 'utf-8')
}

describe('disconnectedLineRule.check()', () => {
  it('fails when SVG contains <line> elements', async () => {
    const { disconnectedLineRule } = await import('../../src/checker/rules/disconnectedLineRule')
    const parser = new DOMParser()
    const doc = parser.parseFromString(loadFixture('with-lines.svg'), 'image/svg+xml')
    const result = disconnectedLineRule.check(doc)
    expect(result.pass).toBe(false)
    expect(result.violationCount).toBeGreaterThanOrEqual(2)
    expect(result.violations.some(v => v.description.includes('<line>'))).toBe(true)
  })

  it('fails when single-segment paths share endpoints', async () => {
    const { disconnectedLineRule } = await import('../../src/checker/rules/disconnectedLineRule')
    const parser = new DOMParser()
    const doc = parser.parseFromString(loadFixture('with-segment-paths.svg'), 'image/svg+xml')
    const result = disconnectedLineRule.check(doc)
    expect(result.pass).toBe(false)
    expect(result.violationCount).toBe(4)
  })

  it('fails when a multi-segment path shares an endpoint with another path', async () => {
    const { disconnectedLineRule } = await import('../../src/checker/rules/disconnectedLineRule')
    // Path A is a 3-point polyline ending at (108,127); path B is a 2-point segment also ending there
    const svg = `<svg xmlns="http://www.w3.org/2000/svg">
      <path style="stroke:#000" d="M 25,106 L 81,73 L 108,127"/>
      <path style="stroke:#000" d="M 174,156 L 148,205 L 48,177 L 108,127"/>
    </svg>`
    const parser = new DOMParser()
    const doc = parser.parseFromString(svg, 'image/svg+xml')
    const result = disconnectedLineRule.check(doc)
    expect(result.pass).toBe(false)
    expect(result.violationCount).toBe(2)
  })

  it('passes for isolated paths with no shared endpoints', async () => {
    const { disconnectedLineRule } = await import('../../src/checker/rules/disconnectedLineRule')
    // clean.svg has two parallel lines with different stroke colours — no shared endpoints
    const parser = new DOMParser()
    const doc = parser.parseFromString(loadFixture('clean.svg'), 'image/svg+xml')
    const result = disconnectedLineRule.check(doc)
    expect(result.pass).toBe(true)
  })

  it('ignores compound paths (handled by compoundPathRule)', async () => {
    const { disconnectedLineRule } = await import('../../src/checker/rules/disconnectedLineRule')
    const svg = `<svg xmlns="http://www.w3.org/2000/svg">
      <path style="stroke:#000" d="M 10,10 L 50,10 M 60,60 L 90,90"/>
    </svg>`
    const parser = new DOMParser()
    const doc = parser.parseFromString(svg, 'image/svg+xml')
    const result = disconnectedLineRule.check(doc)
    expect(result.pass).toBe(true)
  })

  it('passes for empty SVG', async () => {
    const { disconnectedLineRule } = await import('../../src/checker/rules/disconnectedLineRule')
    const parser = new DOMParser()
    const doc = parser.parseFromString(loadFixture('empty.svg'), 'image/svg+xml')
    const result = disconnectedLineRule.check(doc)
    expect(result.pass).toBe(true)
  })
})

describe('disconnectedLineRule.fix()', () => {
  it('chains two connected <line> elements into a single path', async () => {
    const { disconnectedLineRule } = await import('../../src/checker/rules/disconnectedLineRule')
    const parser = new DOMParser()
    const doc = parser.parseFromString(loadFixture('with-lines.svg'), 'image/svg+xml')
    disconnectedLineRule.fix(doc)
    expect(doc.querySelectorAll('line').length).toBe(0)
    const paths = doc.querySelectorAll('path')
    expect(paths.length).toBe(1)
    const d = paths[0].getAttribute('d')!
    expect(d).toContain('10,10')
    expect(d).toContain('90,10')
    expect(d).toContain('90,90')
  })

  it('chains four connected single-segment paths into one path', async () => {
    const { disconnectedLineRule } = await import('../../src/checker/rules/disconnectedLineRule')
    const parser = new DOMParser()
    const doc = parser.parseFromString(loadFixture('with-segment-paths.svg'), 'image/svg+xml')
    disconnectedLineRule.fix(doc)
    expect(doc.querySelectorAll('path').length).toBe(1)
    const d = doc.querySelector('path')!.getAttribute('d')!
    expect(d).toContain('10,10')
    expect(d).toContain('90,10')
    expect(d).toContain('90,90')
    expect(d).toContain('10,90')
  })

  it('joins a multi-segment path with another path sharing its endpoint', async () => {
    const { disconnectedLineRule } = await import('../../src/checker/rules/disconnectedLineRule')
    // Simulates testfile scenario: 4-point chain + 3-point polyline sharing (108,127)
    const svg = `<svg xmlns="http://www.w3.org/2000/svg">
      <path style="stroke:#000" d="M 25,106 L 81,73 L 108,127"/>
      <path style="stroke:#000" d="M 174,156 L 148,205 L 48,177 L 108,127"/>
    </svg>`
    const parser = new DOMParser()
    const doc = parser.parseFromString(svg, 'image/svg+xml')
    disconnectedLineRule.fix(doc)
    const paths = doc.querySelectorAll('path')
    expect(paths.length).toBe(1)
    const d = paths[0].getAttribute('d')!
    // All 6 distinct coordinate pairs must appear in the merged path
    expect(d).toContain('25,106')
    expect(d).toContain('81,73')
    expect(d).toContain('108,127')
    expect(d).toContain('174,156')
    expect(d).toContain('148,205')
    expect(d).toContain('48,177')
  })

  it('chains paths with implicit L commands (no explicit L letter)', async () => {
    const { disconnectedLineRule } = await import('../../src/checker/rules/disconnectedLineRule')
    const svg = `<svg xmlns="http://www.w3.org/2000/svg">
      <path style="stroke:#000" d="M 148.83521,205.15124 48.941309,177.99887"/>
      <path style="stroke:#000" d="m 174.31151,156.54515 -25.4763,48.60609"/>
    </svg>`
    const parser = new DOMParser()
    const doc = parser.parseFromString(svg, 'image/svg+xml')
    disconnectedLineRule.fix(doc)
    expect(doc.querySelectorAll('path').length).toBe(1)
    const d = doc.querySelector('path')!.getAttribute('d')!
    expect(d).toContain('174.31151')
    expect(d).toContain('148.83521')
    expect(d).toContain('48.941309')
  })

  it('keeps disconnected segments as separate paths', async () => {
    const { disconnectedLineRule } = await import('../../src/checker/rules/disconnectedLineRule')
    const svg = `<svg xmlns="http://www.w3.org/2000/svg">
      <line x1="0" y1="0" x2="10" y2="0" stroke="#000"/>
      <line x1="20" y1="20" x2="30" y2="20" stroke="#000"/>
    </svg>`
    const parser = new DOMParser()
    const doc = parser.parseFromString(svg, 'image/svg+xml')
    disconnectedLineRule.fix(doc)
    expect(doc.querySelectorAll('line').length).toBe(0)
    expect(doc.querySelectorAll('path').length).toBe(2)
  })

  it('does not merge segments of different styles', async () => {
    const { disconnectedLineRule } = await import('../../src/checker/rules/disconnectedLineRule')
    const svg = `<svg xmlns="http://www.w3.org/2000/svg">
      <line x1="0" y1="0" x2="10" y2="0" stroke="#ff0000"/>
      <line x1="10" y1="0" x2="20" y2="0" stroke="#0000ff"/>
    </svg>`
    const parser = new DOMParser()
    const doc = parser.parseFromString(svg, 'image/svg+xml')
    disconnectedLineRule.fix(doc)
    expect(doc.querySelectorAll('path').length).toBe(2)
  })

  it('preserves stroke and other attributes', async () => {
    const { disconnectedLineRule } = await import('../../src/checker/rules/disconnectedLineRule')
    const svg = `<svg xmlns="http://www.w3.org/2000/svg">
      <line x1="0" y1="0" x2="10" y2="10" stroke="#ff0000" stroke-width="2"/>
    </svg>`
    const parser = new DOMParser()
    const doc = parser.parseFromString(svg, 'image/svg+xml')
    disconnectedLineRule.fix(doc)
    const path = doc.querySelector('path')!
    expect(path.getAttribute('stroke')).toBe('#ff0000')
    expect(path.getAttribute('stroke-width')).toBe('2')
  })

  it('after fix, check passes', async () => {
    const { disconnectedLineRule } = await import('../../src/checker/rules/disconnectedLineRule')
    const parser = new DOMParser()
    const doc = parser.parseFromString(loadFixture('with-segment-paths.svg'), 'image/svg+xml')
    disconnectedLineRule.fix(doc)
    expect(disconnectedLineRule.check(doc).pass).toBe(true)
  })
})
