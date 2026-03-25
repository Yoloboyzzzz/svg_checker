import { parseSVG } from '../utils/svgParse'
import { serializeSVG } from '../utils/svgSerialize'
import type { CheckRule, FixedSVG, SVGAnalyzer, SVGFixer } from '../types'

export function createFixer(rules: CheckRule[], analyzer: SVGAnalyzer): SVGFixer {
  return {
    fix(svgString: string, filename: string, _fileSize: number): FixedSVG {
      const doc = parseSVG(svgString)
      // Apply fixes in order: groups → compound-paths → duplicate-paths → disconnected-lines
      const ordered = ['groups', 'compound-paths', 'duplicate-paths', 'disconnected-lines']
      for (const cat of ordered) {
        const rule = rules.find(r => r.category === cat)
        if (rule) rule.fix(doc)
      }
      // Remove any path with empty or absent d attribute (defensive cleanup)
      for (const path of Array.from(doc.querySelectorAll('path'))) {
        if ((path.getAttribute('d') ?? '').trim() === '') {
          path.parentNode?.removeChild(path)
        }
      }
      const content = serializeSVG(doc)
      const fixedFilename = filename.replace(/\.svg$/i, '-fixed.svg')
      const report = analyzer.analyze(content, fixedFilename, new Blob([content]).size)
      return { content, filename: fixedFilename, report }
    }
  }
}
