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
    expect(result.violationCount).toBe(2)
    expect(result.violations[0].description).toContain('<line>')
  })

  it('fails when single-segment paths share endpoints', async () => {
    const { disconnectedLineRule } = await import('../../src/checker/rules/disconnectedLineRule')
    const parser = new DOMParser()
    const doc = parser.parseFromString(loadFixture('with-segment-paths.svg'), 'image/svg+xml')
    const result = disconnectedLineRule.check(doc)
    expect(result.pass).toBe(false)
    expect(result.violationCount).toBe(4)
    expect(result.violations[0].description).toContain('Single-segment path')
  })

  it('passes for isolated single-segment paths with no shared endpoints', async () => {
    const { disconnectedLineRule } = await import('../../src/checker/rules/disconnectedLineRule')
    // clean.svg has two parallel lines — no shared endpoints
    const parser = new DOMParser()
    const doc = parser.parseFromString(loadFixture('clean.svg'), 'image/svg+xml')
    const result = disconnectedLineRule.check(doc)
    expect(result.pass).toBe(true)
    expect(result.violationCount).toBe(0)
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
    const paths = doc.querySelectorAll('path')
    expect(paths.length).toBe(1)
    const d = paths[0].getAttribute('d')!
    expect(d).toContain('10,10')
    expect(d).toContain('90,10')
    expect(d).toContain('90,90')
    expect(d).toContain('10,90')
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

  it('after fix on with-segment-paths, check passes', async () => {
    const { disconnectedLineRule } = await import('../../src/checker/rules/disconnectedLineRule')
    const parser = new DOMParser()
    const doc = parser.parseFromString(loadFixture('with-segment-paths.svg'), 'image/svg+xml')
    disconnectedLineRule.fix(doc)
    const result = disconnectedLineRule.check(doc)
    expect(result.pass).toBe(true)
  })

  it('chains paths with implicit L commands (no explicit L letter in d attribute)', async () => {
    const { disconnectedLineRule } = await import('../../src/checker/rules/disconnectedLineRule')
    // path3 uses "M x,y x,y" (implicit absolute L), path4 uses "m dx,dy dx,dy" (implicit relative l)
    // They share endpoint (148.83521, 205.15124)
    const svg = `<svg xmlns="http://www.w3.org/2000/svg">
      <path style="stroke:#000000" d="M 148.83521,205.15124 48.941309,177.99887" id="path3"/>
      <path style="stroke:#000000" d="m 174.31151,156.54515 -25.4763,48.60609" id="path4"/>
    </svg>`
    const parser = new DOMParser()
    const doc = parser.parseFromString(svg, 'image/svg+xml')
    const checkBefore = disconnectedLineRule.check(doc)
    expect(checkBefore.pass).toBe(false)
    expect(checkBefore.violationCount).toBe(2)
    disconnectedLineRule.fix(doc)
    const paths = doc.querySelectorAll('path')
    expect(paths.length).toBe(1)
    const d = paths[0].getAttribute('d')!
    // All three nodes must be present in the merged path
    expect(d).toContain('174.31151')
    expect(d).toContain('148.83521')
    expect(d).toContain('48.941309')
  })

  it('after fix on with-lines, check passes', async () => {
    const { disconnectedLineRule } = await import('../../src/checker/rules/disconnectedLineRule')
    const parser = new DOMParser()
    const doc = parser.parseFromString(loadFixture('with-lines.svg'), 'image/svg+xml')
    disconnectedLineRule.fix(doc)
    const result = disconnectedLineRule.check(doc)
    expect(result.pass).toBe(true)
  })
})
