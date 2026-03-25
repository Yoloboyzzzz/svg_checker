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

  it('removes paths with empty or missing d attribute from output', () => {
    const analyzer = createAnalyzer(DEFAULT_RULES)
    const fixer = createFixer(DEFAULT_RULES, analyzer)
    const svgString = `<svg xmlns="http://www.w3.org/2000/svg">
      <path d="" stroke="#000"/>
      <path stroke="#000"/>
      <path d="M 10,10 L 50,10" stroke="#000"/>
    </svg>`
    const result = fixer.fix(svgString, 'test.svg', 100)
    const parser = new DOMParser()
    const doc = parser.parseFromString(result.content, 'image/svg+xml')
    const paths = doc.querySelectorAll('path')
    for (const path of paths) {
      const d = path.getAttribute('d') ?? ''
      expect(d.trim()).not.toBe('')
    }
  })

  it('fixing a compound path with id produces no duplicate id attributes in output', () => {
    const analyzer = createAnalyzer(DEFAULT_RULES)
    const fixer = createFixer(DEFAULT_RULES, analyzer)
    const result = fixer.fix(loadFixture('with-id-compound-path.svg'), 'with-id-compound-path.svg', 100)
    const parser = new DOMParser()
    const doc = parser.parseFromString(result.content, 'image/svg+xml')
    const allIds = Array.from(doc.querySelectorAll('[id]')).map(el => el.getAttribute('id')!)
    const uniqueIds = new Set(allIds)
    expect(allIds.length).toBe(uniqueIds.size)
  })

  it('fixing degenerate-subpaths fixture produces a 100-score report with no empty paths', () => {
    const analyzer = createAnalyzer(DEFAULT_RULES)
    const fixer = createFixer(DEFAULT_RULES, analyzer)
    const result = fixer.fix(loadFixture('with-degenerate-subpaths.svg'), 'with-degenerate-subpaths.svg', 100)
    expect(result.report.score).toBe(100)
    const parser = new DOMParser()
    const doc = parser.parseFromString(result.content, 'image/svg+xml')
    const paths = doc.querySelectorAll('path')
    for (const path of paths) {
      const d = path.getAttribute('d') ?? ''
      expect(d.trim()).not.toBe('')
      expect(/[LlHhVvCcSsQqTtAa]/.test(d)).toBe(true)
    }
  })
})
