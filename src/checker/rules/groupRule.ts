import type { CheckResult, CheckRule } from '../../types'

function isLayer(el: Element): boolean {
  return el.getAttribute('inkscape:groupmode') === 'layer'
}

export const groupRule: CheckRule = {
  category: 'groups',
  label: 'No Groups',
  defaultWeight: 1/4,

  check(doc: Document): CheckResult {
    const groups = Array.from(doc.querySelectorAll('g')).filter(g => !isLayer(g))
    const totalChecked = doc.querySelectorAll('path, line, rect, circle, ellipse, polyline, polygon, g').length
    const violations = groups.map((el, i) => ({
      elementIndex: i,
      elementId: el.getAttribute('id'),
      description: `<g> element${el.getAttribute('id') ? ` id="${el.getAttribute('id')}"` : ''}`
    }))
    return {
      category: 'groups',
      label: 'No Groups',
      weight: this.defaultWeight,
      pass: groups.length === 0,
      violationCount: groups.length,
      totalChecked,
      violations
    }
  },

  fix(doc: Document): void {
    // Process deepest non-layer groups first (bottom-up)
    let groups = Array.from(doc.querySelectorAll('g')).filter(g => !isLayer(g))
    while (groups.length > 0) {
      // Pick a leaf group (no nested non-layer groups)
      const leaf = groups.find(g => g.querySelector('g:not([inkscape\\:groupmode="layer"])') === null) ?? groups[0]
      const parent = leaf.parentNode!
      const transform = leaf.getAttribute('transform')
      const children = Array.from(leaf.childNodes)
      for (const child of children) {
        if (transform && child instanceof Element) {
          const existingTransform = child.getAttribute('transform')
          child.setAttribute(
            'transform',
            existingTransform ? `${transform} ${existingTransform}` : transform
          )
        }
        parent.insertBefore(child, leaf)
      }
      parent.removeChild(leaf)
      groups = Array.from(doc.querySelectorAll('g')).filter(g => !isLayer(g))
    }
  }
}
