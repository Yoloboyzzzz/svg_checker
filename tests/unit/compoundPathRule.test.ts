import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

function loadFixture(name: string): string {
  return readFileSync(resolve(__dirname, `../fixtures/${name}`), 'utf-8')
}

describe('compoundPathRule.check()', () => {
  it('fails when SVG has compound paths', async () => {
    const { compoundPathRule } = await import('../../src/checker/rules/compoundPathRule')
    const parser = new DOMParser()
    const doc = parser.parseFromString(loadFixture('with-compound-paths.svg'), 'image/svg+xml')
    const result = compoundPathRule.check(doc)
    expect(result.pass).toBe(false)
    expect(result.violationCount).toBeGreaterThanOrEqual(1)
  })

  it('passes when SVG has no compound paths', async () => {
    const { compoundPathRule } = await import('../../src/checker/rules/compoundPathRule')
    const parser = new DOMParser()
    const doc = parser.parseFromString(loadFixture('clean.svg'), 'image/svg+xml')
    const result = compoundPathRule.check(doc)
    expect(result.pass).toBe(true)
    expect(result.violationCount).toBe(0)
  })
})

describe('compoundPathRule.fix()', () => {
  it('splits compound paths into separate <path> elements', async () => {
    const { compoundPathRule } = await import('../../src/checker/rules/compoundPathRule')
    const parser = new DOMParser()
    const doc = parser.parseFromString(loadFixture('with-compound-paths.svg'), 'image/svg+xml')
    compoundPathRule.fix(doc)
    const result = compoundPathRule.check(doc)
    expect(result.pass).toBe(true)
  })

  it('converts relative m to absolute M so sub-paths stay in place', async () => {
    const { compoundPathRule } = await import('../../src/checker/rules/compoundPathRule')
    // Sub-path 2 starts with relative 'm 50,50', which should resolve against
    // the end of sub-path 1 (200,100) → absolute start (250,150).
    const svg = `<svg xmlns="http://www.w3.org/2000/svg">
      <path d="M 100,100 L 200,100 m 50,50 L 300,200" style="stroke:#000"/>
    </svg>`
    const parser = new DOMParser()
    const doc = parser.parseFromString(svg, 'image/svg+xml')
    compoundPathRule.fix(doc)
    const paths = doc.querySelectorAll('path')
    expect(paths.length).toBe(2)
    // Sub-path 1 unchanged
    expect(paths[0].getAttribute('d')).toBe('M 100,100 L 200,100')
    // Sub-path 2: m 50,50 relative to end of sub-path 1 (200,100) → M 250,150
    const d2 = paths[1].getAttribute('d')!
    expect(d2).toMatch(/^M 250,150/)
    expect(d2).toContain('L 300,200')
  })

  it('handles implicit relative l pairs after a relative m', async () => {
    const { compoundPathRule } = await import('../../src/checker/rules/compoundPathRule')
    // "m 50,50 100,0 0,100" = m(50,50) l(100,0) l(0,100) — all relative
    // End of sub-path 1 is (200,100), so sub-path 2 starts at (250,150)
    // and should draw to (350,150) then (350,250).
    const svg = `<svg xmlns="http://www.w3.org/2000/svg">
      <path d="M 100,100 L 200,100 m 50,50 100,0 0,100" style="stroke:#000"/>
    </svg>`
    const parser = new DOMParser()
    const doc = parser.parseFromString(svg, 'image/svg+xml')
    compoundPathRule.fix(doc)
    const paths = doc.querySelectorAll('path')
    expect(paths.length).toBe(2)
    const d2 = paths[1].getAttribute('d')!
    // Start must be absolute M 250,150 and remaining pairs must remain relative
    expect(d2).toMatch(/^M 250,150/)
    expect(d2).toContain('l ')   // implicit pairs converted to explicit relative l
  })

  it('handles three sub-paths with chained relative m offsets, dropping M-only sub-paths', async () => {
    const { compoundPathRule } = await import('../../src/checker/rules/compoundPathRule')
    // Sub-path 1 ends at (200,100) and has an L draw command → kept.
    // Sub-path 2: m 50,50 → starts at (250,150) with no draw commands → degenerate, dropped.
    // Sub-path 3: m 10,10 → starts at (260,160) with no draw commands → degenerate, dropped.
    const svg = `<svg xmlns="http://www.w3.org/2000/svg">
      <path d="M 100,100 L 200,100 m 50,50 m 10,10" style="stroke:#000"/>
    </svg>`
    const parser = new DOMParser()
    const doc = parser.parseFromString(svg, 'image/svg+xml')
    compoundPathRule.fix(doc)
    const paths = doc.querySelectorAll('path')
    expect(paths.length).toBe(1)
    expect(paths[0].getAttribute('d')).toBe('M 100,100 L 200,100')
  })

  it('retains id on first sub-path only, removes id from subsequent sub-paths', async () => {
    const { compoundPathRule } = await import('../../src/checker/rules/compoundPathRule')
    const parser = new DOMParser()
    const doc = parser.parseFromString(loadFixture('with-id-compound-path.svg'), 'image/svg+xml')
    compoundPathRule.fix(doc)
    const paths = doc.querySelectorAll('path')
    expect(paths.length).toBe(3)
    expect(paths[0].getAttribute('id')).toBe('mypath')
    expect(paths[1].getAttribute('id')).toBeNull()
    expect(paths[2].getAttribute('id')).toBeNull()
  })
})
