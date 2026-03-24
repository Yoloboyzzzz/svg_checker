import type { CheckResult, CheckRule } from '../../types'
import { normalizeColor } from '../../utils/colorNormalize'

function normalizePath(d: string): string {
  return d
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/,\s*/g, ',')
    .replace(/(-?\d+\.\d{5,})/g, m => parseFloat(m).toFixed(4))
}

function getStrokeKey(el: Element): string {
  const stroke = el.getAttribute('stroke') ?? 'none'
  if (stroke === 'none' || stroke === '') return 'none'
  try { return normalizeColor(stroke) } catch { return stroke }
}

export const duplicatePathRule: CheckRule = {
  category: 'duplicate-paths',
  label: 'No Duplicate Paths',
  defaultWeight: 1/4,

  check(doc: Document): CheckResult {
    const paths = Array.from(doc.querySelectorAll('path'))
    const seen = new Map<string, number>()
    const dupIndices = new Set<number>()
    paths.forEach((p, i) => {
      const key = normalizePath(p.getAttribute('d') ?? '') + '|' + getStrokeKey(p)
      if (seen.has(key)) {
        dupIndices.add(i)
        const firstIdx = seen.get(key)!
        dupIndices.add(firstIdx)
      } else {
        seen.set(key, i)
      }
    })
    const violations = Array.from(dupIndices).map(i => ({
      elementIndex: i,
      elementId: paths[i].getAttribute('id'),
      description: `Duplicate path${paths[i].getAttribute('id') ? ` id="${paths[i].getAttribute('id')}"` : ''}`
    }))
    return {
      category: 'duplicate-paths',
      label: 'No Duplicate Paths',
      weight: this.defaultWeight,
      pass: violations.length === 0,
      violationCount: dupIndices.size > 0 ? Math.floor(dupIndices.size / 2) : 0,
      violations
    }
  },

  fix(doc: Document): void {
    const paths = Array.from(doc.querySelectorAll('path'))
    const seen = new Map<string, Element>()
    for (const p of paths) {
      const key = normalizePath(p.getAttribute('d') ?? '') + '|' + getStrokeKey(p)
      if (seen.has(key)) {
        p.parentNode?.removeChild(p)
      } else {
        seen.set(key, p)
      }
    }
  }
}
