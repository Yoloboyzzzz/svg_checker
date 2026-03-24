import { parseSVG } from '../utils/svgParse'
import { serializeSVG } from '../utils/svgSerialize'
import type { CheckRule, FixedSVG, SVGAnalyzer, SVGFixer } from '../types'

export function createFixer(rules: CheckRule[], analyzer: SVGAnalyzer): SVGFixer {
  return {
    fix(svgString: string, filename: string, _fileSize: number): FixedSVG {
      const doc = parseSVG(svgString)
      // Apply fixes in order: groups → compound-paths → duplicate-paths
      const ordered = ['groups', 'compound-paths', 'duplicate-paths']
      for (const cat of ordered) {
        const rule = rules.find(r => r.category === cat)
        if (rule) rule.fix(doc)
      }
      const content = serializeSVG(doc)
      const fixedFilename = filename.replace(/\.svg$/i, '-fixed.svg')
      const report = analyzer.analyze(content, fixedFilename, new Blob([content]).size)
      return { content, filename: fixedFilename, report }
    }
  }
}
