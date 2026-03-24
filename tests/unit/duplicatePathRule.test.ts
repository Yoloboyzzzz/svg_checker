import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

function loadFixture(name: string): string {
  return readFileSync(resolve(__dirname, `../fixtures/${name}`), 'utf-8')
}

describe('duplicatePathRule.check()', () => {
  it('fails when SVG has duplicate paths', async () => {
    const { duplicatePathRule } = await import('../../src/checker/rules/duplicatePathRule')
    const parser = new DOMParser()
    const doc = parser.parseFromString(loadFixture('with-duplicates.svg'), 'image/svg+xml')
    const result = duplicatePathRule.check(doc)
    expect(result.pass).toBe(false)
    expect(result.violationCount).toBeGreaterThanOrEqual(1)
  })

  it('passes when SVG has no duplicate paths', async () => {
    const { duplicatePathRule } = await import('../../src/checker/rules/duplicatePathRule')
    const parser = new DOMParser()
    const doc = parser.parseFromString(loadFixture('clean.svg'), 'image/svg+xml')
    const result = duplicatePathRule.check(doc)
    expect(result.pass).toBe(true)
    expect(result.violationCount).toBe(0)
  })

  it('treats color-equivalent strokes as duplicates (#FF0000 vs red)', async () => {
    const { duplicatePathRule } = await import('../../src/checker/rules/duplicatePathRule')
    const parser = new DOMParser()
    const svg = `<svg xmlns="http://www.w3.org/2000/svg">
      <path d="M10,10 L90,90" stroke="#ff0000" fill="none"/>
      <path d="M10,10 L90,90" stroke="red" fill="none"/>
    </svg>`
    const doc = parser.parseFromString(svg, 'image/svg+xml')
    const result = duplicatePathRule.check(doc)
    expect(result.pass).toBe(false)
  })
})

describe('duplicatePathRule.fix()', () => {
  it('removes duplicate paths leaving one', async () => {
    const { duplicatePathRule } = await import('../../src/checker/rules/duplicatePathRule')
    const parser = new DOMParser()
    const doc = parser.parseFromString(loadFixture('with-duplicates.svg'), 'image/svg+xml')
    duplicatePathRule.fix(doc)
    const result = duplicatePathRule.check(doc)
    expect(result.pass).toBe(true)
  })
})
