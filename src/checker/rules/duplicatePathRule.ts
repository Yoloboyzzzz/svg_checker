import type { CheckResult, CheckRule } from '../../types'

function isInDefs(el: Element): boolean {
  let node: Element | null = el.parentElement
  while (node) {
    const tag = (node.localName ?? node.tagName).toLowerCase()
    if (tag === 'defs' || tag === 'marker' || tag === 'pattern' || tag === 'symbol' || tag === 'clippath') return true
    node = node.parentElement
  }
  return false
}

function normalizePath(d: string): string {
  return d
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/,\s*/g, ',')
    .replace(/(-?\d+\.?\d*(?:[eE][+-]?\d+)?)/g, m => parseFloat(m).toFixed(1))
}

// Geometry-only key for <path> elements — stroke/fill excluded per spec clarification
function pathKey(el: Element): string {
  const transform = el.getAttribute('transform') ?? ''
  return normalizePath(el.getAttribute('d') ?? '') + '|transform=' + transform
}

// Geometry-only key for <line> elements — endpoints sorted so reversed copies match
function lineKey(el: Element): string {
  const round = (n: number) => Math.round(n * 10) / 10
  const x1 = round(parseFloat(el.getAttribute('x1') ?? '0'))
  const y1 = round(parseFloat(el.getAttribute('y1') ?? '0'))
  const x2 = round(parseFloat(el.getAttribute('x2') ?? '0'))
  const y2 = round(parseFloat(el.getAttribute('y2') ?? '0'))
  const transform = el.getAttribute('transform') ?? ''
  const endpoints = [`${x1},${y1}`, `${x2},${y2}`].sort()
  return 'line|' + endpoints.join('|') + '|transform=' + transform
}

export const duplicatePathRule: CheckRule = {
  category: 'duplicate-paths',
  label: 'No Duplicate Paths',
  defaultWeight: 1/4,

  check(doc: Document): CheckResult {
    const paths = Array.from(doc.querySelectorAll('path')).filter(p => !isInDefs(p))
    const lines = Array.from(doc.querySelectorAll('line')).filter(l => !isInDefs(l))

    const seen = new Map<string, number>()
    const dupIndices = new Set<number>()
    const allElements: Element[] = [...paths, ...lines]

    allElements.forEach((el, i) => {
      const key = (el.localName ?? el.tagName).toLowerCase() === 'line' ? lineKey(el) : pathKey(el)
      if (seen.has(key)) {
        dupIndices.add(i)
        dupIndices.add(seen.get(key)!)
      } else {
        seen.set(key, i)
      }
    })

    const violations = Array.from(dupIndices).map(i => ({
      elementIndex: i,
      elementId: allElements[i].getAttribute('id'),
      description: `Duplicate path${allElements[i].getAttribute('id') ? ` id="${allElements[i].getAttribute('id')}"` : ''}`
    }))
    return {
      category: 'duplicate-paths',
      label: 'No Duplicate Paths',
      weight: this.defaultWeight,
      pass: violations.length === 0,
      violationCount: dupIndices.size > 0 ? Math.floor(dupIndices.size / 2) : 0,
      totalChecked: allElements.length,
      violations
    }
  },

  fix(doc: Document): void {
    const paths = Array.from(doc.querySelectorAll('path')).filter(p => !isInDefs(p))
    const lines = Array.from(doc.querySelectorAll('line')).filter(l => !isInDefs(l))
    const seen = new Map<string, Element>()

    for (const el of [...paths, ...lines]) {
      const key = (el.localName ?? el.tagName).toLowerCase() === 'line' ? lineKey(el) : pathKey(el)
      if (seen.has(key)) {
        el.parentNode?.removeChild(el)
      } else {
        seen.set(key, el)
      }
    }
  }
}
