import { parseSVG } from '../utils/svgParse'
import { serializeSVG } from '../utils/svgSerialize'
import type { CheckRule, FixedSVG, SVGAnalyzer, SVGFixer } from '../types'

// Returns true if the value string is rgb(60,60,60) / #3c3c3c in any common form
function isGray60(val: string): boolean {
  const v = val.trim().toLowerCase()
  return v === '#3c3c3c' || v === 'rgb(60,60,60)' ||
    /^rgb\(\s*60\s*,\s*60\s*,\s*60\s*\)$/.test(v)
}

function hasGray60Color(el: Element): boolean {
  const styleProps: Record<string, string> = {}
  for (const decl of (el.getAttribute('style') ?? '').split(';')) {
    const colon = decl.indexOf(':')
    if (colon === -1) continue
    styleProps[decl.slice(0, colon).trim()] = decl.slice(colon + 1).trim()
  }
  const fill = styleProps['fill'] ?? el.getAttribute('fill') ?? ''
  const stroke = styleProps['stroke'] ?? el.getAttribute('stroke') ?? ''
  return isGray60(fill) || isGray60(stroke)
}

export function createFixer(rules: CheckRule[], analyzer: SVGAnalyzer): SVGFixer {
  return {
    fix(svgString: string, filename: string, _fileSize: number): FixedSVG {
      const doc = parseSVG(svgString)
      // Normalize stroke-width to 0.1mm first so all rules see consistent widths
      for (const el of Array.from(doc.querySelectorAll('*'))) {
        const style = el.getAttribute('style') ?? ''
        const newStyle = style
          .split(';')
          .filter(d => d.trim() && !d.trim().startsWith('stroke-width'))
          .join(';')
        if (newStyle !== style) el.setAttribute('style', newStyle)
        el.removeAttribute('stroke-width')
        el.setAttribute('stroke-width', '0.1mm')
      }
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
      // Remove all elements with fill or stroke of rgb(60,60,60) / #3c3c3c
      for (const el of Array.from(doc.querySelectorAll('*'))) {
        if (hasGray60Color(el)) el.parentNode?.removeChild(el)
      }
      const content = serializeSVG(doc)
      const fixedFilename = filename.replace(/\.svg$/i, '-fixed.svg')
      const report = analyzer.analyze(content, fixedFilename, new Blob([content]).size)
      return { content, filename: fixedFilename, report }
    }
  }
}
