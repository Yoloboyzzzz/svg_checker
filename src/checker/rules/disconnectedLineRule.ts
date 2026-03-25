import type { CheckResult, CheckRule } from '../../types'

interface Point { x: number; y: number }

interface PathData {
  start: Point
  end: Point
  points: Point[]   // all points in path order (for merging)
  el: Element
}

// Generous tolerance to accommodate CAD floating-point coordinates
const EPS = 0.5

function pointsEqual(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) < EPS && Math.abs(a.y - b.y) < EPS
}

function sharesEndpoint(a: PathData, b: PathData): boolean {
  return (
    pointsEqual(a.start, b.start) || pointsEqual(a.start, b.end) ||
    pointsEqual(a.end, b.start)   || pointsEqual(a.end, b.end)
  )
}

// Style key for grouping — only stroke properties matter for laser cutting.
// Parses stroke/stroke-width/stroke-opacity from both the style="" attribute
// and individual presentation attributes; fill is intentionally ignored.
function styleKey(el: Element): string {
  const strokeProps: Record<string, string> = {}

  // Collect individual presentation attributes first (lower priority)
  for (const attr of Array.from(el.attributes)) {
    if (['stroke', 'stroke-width', 'stroke-opacity'].includes(attr.name)) {
      strokeProps[attr.name] = attr.value
    }
  }

  // Parse inline style="" — overrides individual attributes
  const styleAttr = el.getAttribute('style') ?? ''
  for (const decl of styleAttr.split(';')) {
    const colon = decl.indexOf(':')
    if (colon === -1) continue
    const prop = decl.slice(0, colon).trim()
    const val = decl.slice(colon + 1).trim()
    if (['stroke', 'stroke-width', 'stroke-opacity'].includes(prop)) {
      strokeProps[prop] = val
    }
  }

  // Include the transform so paths in different coordinate spaces are never merged
  const transform = el.getAttribute('transform') ?? ''
  return Object.entries(strokeProps).sort().map(([k, v]) => `${k}=${v}`).join(';') + '|transform=' + transform
}

function isLine(el: Element): boolean {
  return el.tagName.toLowerCase() === 'line'
}

// Parses any path containing only M/m/L/l/H/h/V/v commands into an ordered
// list of absolute points. Returns null for curves, closed paths (Z), or
// compound paths (multiple M commands) — those are handled by other rules.
function extractPoints(d: string): Point[] | null {
  // Reject curves, close commands, and compound paths
  if (/[CcSsQqTtAaZz]/.test(d)) return null
  if ((d.match(/[Mm]/g) ?? []).length > 1) return null

  const points: Point[] = []
  let x = 0, y = 0

  for (const token of d.trim().split(/(?=[MmLlHhVv])/)) {
    if (!token.trim()) continue
    const cmd = token[0]
    const nums = token.slice(1).match(/[-+]?(?:\d*\.?\d+)(?:[eE][-+]?\d+)?/g)
    const args = (nums ?? []).map(Number)

    switch (cmd) {
      case 'M':
        for (let i = 0; i + 1 < args.length; i += 2) {
          x = args[i]; y = args[i + 1]; points.push({ x, y })
        }
        break
      case 'm':
        for (let i = 0; i + 1 < args.length; i += 2) {
          x += args[i]; y += args[i + 1]; points.push({ x, y })
        }
        break
      case 'L':
        for (let i = 0; i + 1 < args.length; i += 2) {
          x = args[i]; y = args[i + 1]; points.push({ x, y })
        }
        break
      case 'l':
        for (let i = 0; i + 1 < args.length; i += 2) {
          x += args[i]; y += args[i + 1]; points.push({ x, y })
        }
        break
      case 'H':
        for (const a of args) { x = a; points.push({ x, y }) }
        break
      case 'h':
        for (const a of args) { x += a; points.push({ x, y }) }
        break
      case 'V':
        for (const a of args) { y = a; points.push({ x, y }) }
        break
      case 'v':
        for (const a of args) { y += a; points.push({ x, y }) }
        break
    }
  }

  return points.length >= 2 ? points : null
}

function collectSegments(doc: Document): PathData[] {
  const result: PathData[] = []

  for (const el of Array.from(doc.querySelectorAll('line'))) {
    const x1 = parseFloat(el.getAttribute('x1') ?? '0')
    const y1 = parseFloat(el.getAttribute('y1') ?? '0')
    const x2 = parseFloat(el.getAttribute('x2') ?? '0')
    const y2 = parseFloat(el.getAttribute('y2') ?? '0')
    const points = [{ x: x1, y: y1 }, { x: x2, y: y2 }]
    result.push({ start: points[0], end: points[1], points, el })
  }

  for (const el of Array.from(doc.querySelectorAll('path'))) {
    const pts = extractPoints(el.getAttribute('d') ?? '')
    if (!pts) continue
    result.push({ start: pts[0], end: pts[pts.length - 1], points: pts, el })
  }

  return result
}

// Chains PathData entries by shared endpoints, concatenating full point arrays.
// Connected segments (head-to-tail, tail-to-tail, head-to-head) are merged;
// isolated segments become single-point chains.
function chainSegments(segs: PathData[]): Point[][] {
  const remaining = segs.map(s => ({ points: [...s.points] }))
  const chains: Point[][] = []

  while (remaining.length > 0) {
    const first = remaining.splice(0, 1)[0]
    const chain: Point[] = [...first.points]

    let extended = true
    while (extended) {
      extended = false
      const tail = chain[chain.length - 1]
      const head = chain[0]

      for (let i = 0; i < remaining.length; i++) {
        const pts = remaining[i].points
        const rHead = pts[0]
        const rTail = pts[pts.length - 1]

        if (pointsEqual(rHead, tail)) {
          // Tail of chain connects to head of this segment → append (skip shared point)
          chain.push(...pts.slice(1))
          remaining.splice(i, 1); extended = true; break
        } else if (pointsEqual(rTail, tail)) {
          // Tail of chain connects to tail of this segment → append reversed
          chain.push(...[...pts].reverse().slice(1))
          remaining.splice(i, 1); extended = true; break
        } else if (pointsEqual(rTail, head)) {
          // Head of chain connects to tail of this segment → prepend (skip shared point)
          chain.unshift(...pts.slice(0, -1))
          remaining.splice(i, 1); extended = true; break
        } else if (pointsEqual(rHead, head)) {
          // Head of chain connects to head of this segment → prepend reversed
          chain.unshift(...[...pts].reverse().slice(0, -1))
          remaining.splice(i, 1); extended = true; break
        }
      }
    }
    chains.push(chain)
  }
  return chains
}

export const disconnectedLineRule: CheckRule = {
  category: 'disconnected-lines',
  label: 'No Bare Lines',
  defaultWeight: 1/4,

  check(doc: Document): CheckResult {
    const segments = collectSegments(doc)
    const violatingSet = new Set<Element>()

    // <line> elements are always violations
    for (const seg of segments) {
      if (isLine(seg.el)) violatingSet.add(seg.el)
    }

    // Paths that share an endpoint with another path of the same style
    // can be joined and are therefore violations
    const groups = new Map<string, PathData[]>()
    for (const seg of segments) {
      const key = styleKey(seg.el)
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(seg)
    }

    for (const segs of groups.values()) {
      for (let i = 0; i < segs.length; i++) {
        for (let j = i + 1; j < segs.length; j++) {
          if (sharesEndpoint(segs[i], segs[j])) {
            violatingSet.add(segs[i].el)
            violatingSet.add(segs[j].el)
          }
        }
      }
    }

    const violations = Array.from(violatingSet).map((el, i) => {
      const id = el.getAttribute('id')
      if (isLine(el)) {
        const x1 = el.getAttribute('x1') ?? '0', y1 = el.getAttribute('y1') ?? '0'
        const x2 = el.getAttribute('x2') ?? '0', y2 = el.getAttribute('y2') ?? '0'
        return { elementIndex: i, elementId: id, description: `<line> (${x1},${y1}) → (${x2},${y2}) — should be part of a connected path` }
      }
      const d = el.getAttribute('d') ?? ''
      return { elementIndex: i, elementId: id, description: `Path "${d.length > 40 ? d.slice(0, 40) + '…' : d}" — should be joined with adjacent segment` }
    })

    return {
      category: 'disconnected-lines',
      label: 'No Bare Lines',
      weight: this.defaultWeight,
      pass: violations.length === 0,
      violationCount: violations.length,
      totalChecked: segments.length,
      violations
    }
  },

  fix(doc: Document): void {
    const segments = collectSegments(doc)
    if (segments.length === 0) return

    // Group by visual style so only same-style segments are merged
    const groups = new Map<string, PathData[]>()
    for (const seg of segments) {
      const key = styleKey(seg.el)
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(seg)
    }

    for (const segs of groups.values()) {
      const chains = chainSegments(segs)
      const refEl = segs[0].el
      const groupParent = refEl.parentNode!
      for (const chain of chains) {
        const path = doc.createElementNS('http://www.w3.org/2000/svg', 'path')
        path.setAttribute('d', chain.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' '))
        for (const attr of Array.from(refEl.attributes)) {
          if (!['x1', 'y1', 'x2', 'y2', 'id', 'd'].includes(attr.name)) {
            path.setAttribute(attr.name, attr.value)
          }
        }
        groupParent.insertBefore(path, refEl)
      }
    }

    for (const seg of segments) {
      seg.el.parentNode?.removeChild(seg.el)
    }
  }
}
