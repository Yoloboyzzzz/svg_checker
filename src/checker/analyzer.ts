import { parseSVG } from '../utils/svgParse'
import type { CheckRule, QualityReport, SVGAnalyzer } from '../types'

export function createAnalyzer(rules: CheckRule[]): SVGAnalyzer {
  return {
    analyze(svgString: string, filename: string, fileSize: number): QualityReport {
      const doc = parseSVG(svgString)
      const checks = rules.map(rule => rule.check(doc))
      const score = Math.round(
        checks.reduce((sum, c) => {
          if (c.totalChecked === 0) return sum + c.weight
          const quality = Math.max(0, 1 - c.violationCount / c.totalChecked)
          return sum + c.weight * quality
        }, 0) * 100
      )
      return { filename, fileSize, score, checks }
    }
  }
}
