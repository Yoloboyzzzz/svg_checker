import type { CheckResult, CheckRule } from '../../types'

interface Segment {
  x1: number; y1: number
  x2: number; y2: number
  el: Element
}

interface Point { x: number; y: number }

// Generous tolerance to accommodate CAD floating-point coordinates
const EPS = 0.5

function pointsEqual(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) < EPS && Math.abs(a.y - b.y) < EPS
}

function sharesEndpoint(a: Segment, b: Segment): boolean {
  const ap1 = { x: a.x1, y: a.y1 }, ap2 = { x: a.x2, y: a.y2 }
  const bp1 = { x: b.x1, y: b.y1 }, bp2 = { x: b.x2, y: b.y2 }
  return (
    pointsEqual(ap1, bp1) || pointsEqual(ap1, bp2) ||
    pointsEqual(ap2, bp1) || pointsEqual(ap2, bp2)
  )
}

// Style key for grouping — excludes positional and identity attributes
function styleKey(el: Element): string {
  return Array.from(el.attributes)
    .filter(a => !['x1', 'y1', 'x2', 'y2', 'id', 'd'].includes(a.name))
    .map(a => `${a.name}=${a.value}`)
    .sort()
    .join(';')
}

// Returns start/end points if the path is a single line segment, null otherwise.
// Handles both explicit L/l and implicit line commands (SVG allows "M x,y x,y" and "m dx,dy dx,dy").
function parseLineSegment(d: string): { x1: number; y1: number; x2: number; y2: number } | null {
  // [Ll]? makes the line command letter optional — SVG implicit line after M/m
  const m = d.trim().match(
    /^([Mm])\s*([-\d.e+]+)[,\s]+([-\d.e+]+)\s*([Ll])?\s*([-\d.e+]+)[,\s]+([-\d.e+]+)\s*$/
  )
  if (!m) return null
  const moveCmd = m[1]   // 'M' or 'm'
  const x1 = parseFloat(m[2])
  const y1 = parseFloat(m[3])
  const lineCmd = m[4]   // 'L', 'l', or undefined (implicit)
  const dx = parseFloat(m[5])
  const dy = parseFloat(m[6])
  // Implicit line after 'm' is relative; implicit line after 'M' is absolute (SVG spec §8.3.2)
  const isRelative = lineCmd === 'l' || (lineCmd === undefined && moveCmd === 'm')
  return { x1, y1, x2: isRelative ? x1 + dx : dx, y2: isRelative ? y1 + dy : dy }
}

function isLine(el: Element): boolean {
  return el.tagName.toLowerCase() === 'line'
}

// Collects <line> elements and single-segment <path> elements
function collectSegments(doc: Document): Segment[] {
  const result: Segment[] = []
  for (const el of Array.from(doc.querySelectorAll('line'))) {
    result.push({
      x1: parseFloat(el.getAttribute('x1') ?? '0'),
      y1: parseFloat(el.getAttribute('y1') ?? '0'),
      x2: parseFloat(el.getAttribute('x2') ?? '0'),
      y2: parseFloat(el.getAttribute('y2') ?? '0'),
      el
    })
  }
  for (const el of Array.from(doc.querySelectorAll('path'))) {
    const coords = parseLineSegment(el.getAttribute('d') ?? '')
    if (coords) result.push({ ...coords, el })
  }
  return result
}

function chainSegments(segs: Segment[]): Point[][] {
  const remaining = segs.map(s => ({ p1: { x: s.x1, y: s.y1 }, p2: { x: s.x2, y: s.y2 } }))
  const chains: Point[][] = []

  while (remaining.length > 0) {
    const first = remaining.splice(0, 1)[0]
    const chain: Point[] = [first.p1, first.p2]

    let extended = true
    while (extended) {
      extended = false
      const tail = chain[chain.length - 1]
      const head = chain[0]
      for (let i = 0; i < remaining.length; i++) {
        const { p1, p2 } = remaining[i]
        if      (pointsEqual(p1, tail))  { chain.push(p2);    remaining.splice(i, 1); extended = true; break }
        else if (pointsEqual(p2, tail))  { chain.push(p1);    remaining.splice(i, 1); extended = true; break }
        else if (pointsEqual(p2, head))  { chain.unshift(p1); remaining.splice(i, 1); extended = true; break }
        else if (pointsEqual(p1, head))  { chain.unshift(p2); remaining.splice(i, 1); extended = true; break }
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

    // <line> elements are always violations.
    // Single-segment <path> elements are violations only when they share an endpoint
    // with another segment (they can be joined into a polyline).
    const lineSegs = segments.filter(s => isLine(s.el))
    const pathSegs = segments.filter(s => !isLine(s.el))

    const joinablePathIndices = new Set<number>()
    for (let i = 0; i < segments.length; i++) {
      for (let j = i + 1; j < segments.length; j++) {
        if (sharesEndpoint(segments[i], segments[j])) {
          if (!isLine(segments[i].el)) joinablePathIndices.add(i)
          if (!isLine(segments[j].el)) joinablePathIndices.add(j)
        }
      }
    }
    const joinablePaths = segments.filter((s, i) => !isLine(s.el) && joinablePathIndices.has(i))

    const allViolations = [...lineSegs, ...joinablePaths]
    const violations = allViolations.map((seg, i) => {
      const id = seg.el.getAttribute('id')
      if (isLine(seg.el)) {
        return {
          elementIndex: i,
          elementId: id,
          description: `<line> (${seg.x1},${seg.y1}) → (${seg.x2},${seg.y2}) — should be part of a connected path`
        }
      }
      const d = seg.el.getAttribute('d') ?? ''
      return {
        elementIndex: i,
        elementId: id,
        description: `Single-segment path "${d.length > 40 ? d.slice(0, 40) + '…' : d}" — should be joined with adjacent segments`
      }
    })

    return {
      category: 'disconnected-lines',
      label: 'No Bare Lines',
      weight: this.defaultWeight,
      pass: violations.length === 0,
      violationCount: violations.length,
      violations
    }
  },

  fix(doc: Document): void {
    // Fix processes ALL <line> and single-segment <path> elements —
    // connected ones get chained into polylines, isolated ones become proper <path> elements.
    const segments = collectSegments(doc)
    if (segments.length === 0) return

    const groups = new Map<string, Segment[]>()
    for (const seg of segments) {
      const key = styleKey(seg.el)
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(seg)
    }

    const insertionRef = segments[0].el
    const parent = insertionRef.parentNode!

    for (const segs of groups.values()) {
      const chains = chainSegments(segs)
      const refEl = segs[0].el
      for (const chain of chains) {
        const path = doc.createElementNS('http://www.w3.org/2000/svg', 'path')
        path.setAttribute('d', chain.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' '))
        for (const attr of Array.from(refEl.attributes)) {
          if (!['x1', 'y1', 'x2', 'y2', 'id', 'd'].includes(attr.name)) {
            path.setAttribute(attr.name, attr.value)
          }
        }
        parent.insertBefore(path, insertionRef)
      }
    }

    for (const seg of segments) {
      seg.el.parentNode?.removeChild(seg.el)
    }
  }
}
