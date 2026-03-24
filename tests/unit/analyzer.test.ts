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

  it('returns score 0 for all-violations SVG', () => {
    const analyzer = createAnalyzer(DEFAULT_RULES)
    const report = analyzer.analyze(loadFixture('all-violations.svg'), 'all.svg', 100)
    expect(report.score).toBe(0)
    expect(report.checks.every(c => !c.pass)).toBe(true)
  })

  it('throws on malformed SVG', () => {
    const analyzer = createAnalyzer(DEFAULT_RULES)
    expect(() => analyzer.analyze(loadFixture('malformed.svg'), 'bad.svg', 10)).toThrow()
  })
})
