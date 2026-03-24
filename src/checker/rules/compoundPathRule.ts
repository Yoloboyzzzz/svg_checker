import type { CheckResult, CheckRule } from '../../types'

function isCompound(d: string): boolean {
  return (d.match(/[Mm]/g) ?? []).length > 1
}

export const compoundPathRule: CheckRule = {
  category: 'compound-paths',
  label: 'No Compound Paths',
  defaultWeight: 1/4,

  check(doc: Document): CheckResult {
    const paths = Array.from(doc.querySelectorAll('path'))
    const violations = paths
      .filter(p => isCompound(p.getAttribute('d') ?? ''))
      .map((el, i) => ({
        elementIndex: i,
        elementId: el.getAttribute('id'),
        description: `Compound path with multiple sub-paths${el.getAttribute('id') ? ` id="${el.getAttribute('id')}"` : ''}`
      }))
    return {
      category: 'compound-paths',
      label: 'No Compound Paths',
      weight: this.defaultWeight,
      pass: violations.length === 0,
      violationCount: violations.length,
      violations
    }
  },

  fix(doc: Document): void {
    const paths = Array.from(doc.querySelectorAll('path'))
    for (const path of paths) {
      const d = path.getAttribute('d') ?? ''
      if (!isCompound(d)) continue
      const subPaths = d.split(/(?=[Mm])/).filter(s => s.trim() !== '')
      const parent = path.parentNode!
      for (let i = subPaths.length - 1; i >= 0; i--) {
        const newPath = path.cloneNode(false) as Element
        newPath.setAttribute('d', subPaths[i].trim())
        if (i > 0) newPath.removeAttribute('id')
        parent.insertBefore(newPath, path.nextSibling)
      }
      parent.removeChild(path)
    }
  }
}
