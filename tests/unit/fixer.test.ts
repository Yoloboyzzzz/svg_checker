import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createAnalyzer } from '../../src/checker/analyzer'
import { createFixer } from '../../src/checker/fixer'
import { DEFAULT_RULES } from '../../src/checker/rules'

function loadFixture(name: string): string {
  return readFileSync(resolve(__dirname, `../fixtures/${name}`), 'utf-8')
}

describe('fixer.fix()', () => {
  it('produces a 100-score SVG from all-violations fixture', () => {
    const analyzer = createAnalyzer(DEFAULT_RULES)
    const fixer = createFixer(DEFAULT_RULES, analyzer)
    const result = fixer.fix(loadFixture('all-violations.svg'), 'all-violations.svg', 100)
    expect(result.report.score).toBe(100)
  })

  it('appends -fixed to filename', () => {
    const analyzer = createAnalyzer(DEFAULT_RULES)
    const fixer = createFixer(DEFAULT_RULES, analyzer)
    const result = fixer.fix(loadFixture('clean.svg'), 'my-icon.svg', 100)
    expect(result.filename).toBe('my-icon-fixed.svg')
  })

  it('returns valid parseable SVG', () => {
    const analyzer = createAnalyzer(DEFAULT_RULES)
    const fixer = createFixer(DEFAULT_RULES, analyzer)
    const result = fixer.fix(loadFixture('all-violations.svg'), 'all-violations.svg', 100)
    const parser = new DOMParser()
    const doc = parser.parseFromString(result.content, 'image/svg+xml')
    expect(doc.querySelector('parsererror')).toBeNull()
  })
})
