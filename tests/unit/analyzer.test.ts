import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createAnalyzer } from '../../src/checker/analyzer'
import { DEFAULT_RULES } from '../../src/checker/rules'

function loadFixture(name: string): string {
  return readFileSync(resolve(__dirname, `../fixtures/${name}`), 'utf-8')
}

describe('analyzer.analyze()', () => {
  it('returns score 100 for clean SVG', () => {
    const analyzer = createAnalyzer(DEFAULT_RULES)
    const report = analyzer.analyze(loadFixture('clean.svg'), 'clean.svg', 100)
    expect(report.score).toBe(100)
    expect(report.checks.every(c => c.pass)).toBe(true)
  })

  it('returns a reduced score when all checks fail', () => {
    const analyzer = createAnalyzer(DEFAULT_RULES)
    const report = analyzer.analyze(loadFixture('all-violations.svg'), 'all.svg', 100)
    // Every rule must fail
    expect(report.checks.every(c => !c.pass)).toBe(true)
    // Score is proportional: having only some elements violate still gives partial credit,
    // but the overall score must be well below 100
    expect(report.score).toBeLessThan(75)
    expect(report.score).toBeGreaterThanOrEqual(0)
  })

  it('throws on malformed SVG', () => {
    const analyzer = createAnalyzer(DEFAULT_RULES)
    expect(() => analyzer.analyze(loadFixture('malformed.svg'), 'bad.svg', 10)).toThrow()
  })
})
