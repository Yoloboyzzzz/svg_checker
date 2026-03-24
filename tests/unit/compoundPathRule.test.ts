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
})
