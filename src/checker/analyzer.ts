import { parseSVG } from '../utils/svgParse'
import type { CheckRule, QualityReport, SVGAnalyzer } from '../types'

export function createAnalyzer(rules: CheckRule[]): SVGAnalyzer {
  return {
    analyze(svgString: string, filename: string, fileSize: number): QualityReport {
      const doc = parseSVG(svgString)
      const checks = rules.map(rule => rule.check(doc)) as [any, any, any]
      const score = Math.round(
        checks.reduce((sum: number, c: any) => sum + (c.pass ? c.weight : 0), 0) * 100
      )
      return { filename, fileSize, score, checks }
    }
  }
}
