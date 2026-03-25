import type { CheckResult, CheckRule } from '../../types'

interface Point { x: number; y: number }

// Instead of collapsing paths to point arrays, we store the raw path-command
// fragments so that arc commands survive the merge unchanged.
interface PathFrag {
  start: Point
  end: Point
  forwardD: string  // path commands (no leading M) from start → end
  reverseD: string  // path commands (no leading M) from end → start
  el: Element
}

// Generous tolerance to accommodate CAD floating-point coordinates
const EPS = 0.5

function pointsEqual(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) < EPS && Math.abs(a.y - b.y) < EPS
}

function sharesEndpoint(a: PathFrag, b: PathFrag): boolean {
  return (
    pointsEqual(a.start, b.start) || pointsEqual(a.start, b.end) ||
    pointsEqual(a.end, b.start)   || pointsEqual(a.end, b.end)
  )
}

function styleKey(el: Element): string {
  const strokeProps: Record<string, string> = {}
  for (const attr of Array.from(el.attributes)) {
    if (['stroke', 'stroke-width', 'stroke-opacity'].includes(attr.name)) {
      strokeProps[attr.name] = attr.value
    }
  }
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
  const transform = el.getAttribute('transform') ?? ''
  return Object.entries(strokeProps).sort().map(([k, v]) => `${k}=${v}`).join(';') + '|transform=' + transform
}

function isLine(el: Element): boolean {
  return (el.localName ?? el.tagName).toLowerCase() === 'line'
}

// Paths inside <defs>, <marker>, <pattern>, or <symbol> are part of
// definitions and must never be moved or merged.
function isInDefs(el: Element): boolean {
  let node: Element | null = el.parentElement
  while (node) {
    const tag = (node.localName ?? node.tagName).toLowerCase()
    if (tag === 'defs' || tag === 'marker' || tag === 'pattern' || tag === 'symbol' || tag === 'clippath') return true
    node = node.parentElement
  }
  return false
}

function parseNums(s: string): number[] {
  return (s.match(/[-+]?(?:\d*\.?\d+)(?:[eE][-+]?\d+)?/g) ?? []).map(Number)
}

// Parses straight-line paths (M/m/L/l/H/h/V/v only).
function extractLinearFrag(el: Element): PathFrag | null {
  const d = el.getAttribute('d') ?? ''
  if (/[CcSsQqTtAaZz]/.test(d)) return null
  if ((d.match(/[Mm]/g) ?? []).length > 1) return null

  const points: Point[] = []
  let x = 0, y = 0

  for (const token of d.trim().split(/(?=[MmLlHhVv])/)) {
    if (!token.trim()) continue
    const cmd = token[0]
    const args = parseNums(token.slice(1))
    switch (cmd) {
      case 'M': for (let i = 0; i + 1 < args.length; i += 2) { x = args[i]; y = args[i + 1]; points.push({ x, y }) } break
      case 'm': for (let i = 0; i + 1 < args.length; i += 2) { x += args[i]; y += args[i + 1]; points.push({ x, y }) } break
      case 'L': for (let i = 0; i + 1 < args.length; i += 2) { x = args[i]; y = args[i + 1]; points.push({ x, y }) } break
      case 'l': for (let i = 0; i + 1 < args.length; i += 2) { x += args[i]; y += args[i + 1]; points.push({ x, y }) } break
      case 'H': for (const a of args) { x = a; points.push({ x, y }) } break
      case 'h': for (const a of args) { x += a; points.push({ x, y }) } break
      case 'V': for (const a of args) { y = a; points.push({ x, y }) } break
      case 'v': for (const a of args) { y += a; points.push({ x, y }) } break
    }
  }

  if (points.length < 2) return null

  const forwardD = points.slice(1).map(p => `L ${p.x},${p.y}`).join(' ')
  const reverseD = [...points].reverse().slice(1).map(p => `L ${p.x},${p.y}`).join(' ')

  return { start: points[0], end: points[points.length - 1], forwardD, reverseD, el }
}

// Parses paths that contain a single arc command (a/A), with an optional
// leading M/m. Preserves the arc parameters so the curve survives the merge.
// Reversing an arc means flipping the sweep-flag and negating relative offsets.
function extractArcFrag(el: Element): PathFrag | null {
  const d = el.getAttribute('d') ?? ''
  if (!/[Aa]/.test(d)) return null
  if (/[CcSsQqTtZz]/.test(d)) return null
  if ((d.match(/[Mm]/g) ?? []).length !== 1) return null
  if ((d.match(/[Aa]/g) ?? []).length !== 1) return null

  const mMatch = d.match(/[Mm]\s*([-+\d.eE]+)[,\s]+([-+\d.eE]+)/)
  if (!mMatch) return null
  // First command → absolute start even for lowercase m (origin is 0,0)
  const start: Point = { x: parseFloat(mMatch[1]), y: parseFloat(mMatch[2]) }

  const arcMatch = d.match(/([Aa])\s*([-+\d.eE]+)[,\s]+([-+\d.eE]+)[,\s]+([-+\d.eE]+)[,\s]+([01])[,\s]+([01])[,\s]+([-+\d.eE]+)[,\s]+([-+\d.eE]+)/)
  if (!arcMatch) return null

  const isRel = arcMatch[1] === 'a'
  const rx = parseFloat(arcMatch[2])
  const ry = parseFloat(arcMatch[3])
  const rot = parseFloat(arcMatch[4])
  const laf = parseInt(arcMatch[5])
  const sf = parseInt(arcMatch[6])
  const p1 = parseFloat(arcMatch[7])
  const p2 = parseFloat(arcMatch[8])

  const end: Point = isRel
    ? { x: start.x + p1, y: start.y + p2 }
    : { x: p1, y: p2 }

  const forwardD = `${isRel ? 'a' : 'A'} ${rx},${ry} ${rot} ${laf} ${sf} ${p1},${p2}`
  const reverseD = isRel
    ? `a ${rx},${ry} ${rot} ${laf} ${1 - sf} ${-p1},${-p2}`
    : `A ${rx},${ry} ${rot} ${laf} ${1 - sf} ${start.x},${start.y}`

  return { start, end, forwardD, reverseD, el }
}

function collectSegments(doc: Document): PathFrag[] {
  const result: PathFrag[] = []

  for (const el of Array.from(doc.querySelectorAll('line'))) {
    if (isInDefs(el)) continue
    const x1 = parseFloat(el.getAttribute('x1') ?? '0')
    const y1 = parseFloat(el.getAttribute('y1') ?? '0')
    const x2 = parseFloat(el.getAttribute('x2') ?? '0')
    const y2 = parseFloat(el.getAttribute('y2') ?? '0')
    result.push({
      start: { x: x1, y: y1 },
      end: { x: x2, y: y2 },
      forwardD: `L ${x2},${y2}`,
      reverseD: `L ${x1},${y1}`,
      el
    })
  }

  for (const el of Array.from(doc.querySelectorAll('path'))) {
    if (isInDefs(el)) continue
    const linear = extractLinearFrag(el)
    if (linear) { result.push(linear); continue }
    const arc = extractArcFrag(el)
    if (arc) result.push(arc)
  }

  return result
}

interface Chain {
  start: Point
  end: Point
  parts: string[]
}

// Chains PathFrag entries by shared endpoints. Appends forwardD or reverseD
// depending on which end connects to the current chain tip/head.
function chainFrags(frags: PathFrag[]): Chain[] {
  const remaining = [...frags]
  const chains: Chain[] = []

  while (remaining.length > 0) {
    const first = remaining.splice(0, 1)[0]
    const chain: Chain = {
      start: first.start,
      end: first.end,
      parts: [first.forwardD]
    }

    let extended = true
    while (extended) {
      extended = false
      for (let i = 0; i < remaining.length; i++) {
        const frag = remaining[i]

        if (pointsEqual(frag.start, chain.end)) {
          chain.parts.push(frag.forwardD)
          chain.end = frag.end
          remaining.splice(i, 1); extended = true; break
        } else if (pointsEqual(frag.end, chain.end)) {
          chain.parts.push(frag.reverseD)
          chain.end = frag.start
          remaining.splice(i, 1); extended = true; break
        } else if (pointsEqual(frag.end, chain.start)) {
          chain.parts.unshift(frag.forwardD)
          chain.start = frag.start
          remaining.splice(i, 1); extended = true; break
        } else if (pointsEqual(frag.start, chain.start)) {
          chain.parts.unshift(frag.reverseD)
          chain.start = frag.end
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

    for (const seg of segments) {
      if (isLine(seg.el)) violatingSet.add(seg.el)
    }

    const groups = new Map<string, PathFrag[]>()
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

    const groups = new Map<string, PathFrag[]>()
    for (const seg of segments) {
      const key = styleKey(seg.el)
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(seg)
    }

    for (const segs of groups.values()) {
      const chains = chainFrags(segs)
      const refEl = segs[0].el
      const groupParent = refEl.parentNode!
      for (const chain of chains) {
        const path = doc.createElementNS('http://www.w3.org/2000/svg', 'path')
        path.setAttribute('d', `M ${chain.start.x},${chain.start.y} ${chain.parts.join(' ')}`)
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
