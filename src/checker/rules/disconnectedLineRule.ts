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

// Join tolerance: absorbs floating-point rounding from vector editors (< 0.1 units)
// while preventing false-positive joins across intended gaps
const EPS = 0.2

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
    if (['stroke', 'stroke-opacity'].includes(attr.name)) {
      strokeProps[attr.name] = attr.value
    }
  }
  const styleAttr = el.getAttribute('style') ?? ''
  for (const decl of styleAttr.split(';')) {
    const colon = decl.indexOf(':')
    if (colon === -1) continue
    const prop = decl.slice(0, colon).trim()
    const val = decl.slice(colon + 1).trim()
    if (['stroke', 'stroke-opacity'].includes(prop)) {
      strokeProps[prop] = val
    }
  }
  const transform = el.getAttribute('transform') ?? ''
  return Object.entries(strokeProps).sort().map(([k, v]) => `${k}=${v}`).join(';') + '|transform=' + transform
}

function isLine(el: Element): boolean {
  return (el.localName ?? el.tagName).toLowerCase() === 'line'
}

// Returns true if the element has a non-none fill — filled shapes should not be
// broken apart, deduplicated, or joined (they are area fills, not cut lines).
// Closed paths (z) with no explicit fill:none use the SVG default fill (black).
function hasFill(el: Element): boolean {
  const style = el.getAttribute('style') ?? ''
  for (const decl of style.split(';')) {
    const colon = decl.indexOf(':')
    if (colon === -1) continue
    if (decl.slice(0, colon).trim() === 'fill') {
      const val = decl.slice(colon + 1).trim()
      if (val === 'none') return false
      return val !== ''
    }
  }
  const fill = el.getAttribute('fill')
  if (fill !== null) return fill !== 'none'
  // No explicit fill set: SVG default is black.
  // Closed paths (z) without fill:none are filled shapes — protect them.
  return /[Zz]/.test(el.getAttribute('d') ?? '')
}

// Returns true if the element renders in black (fill or stroke is black).
// Black elements are excluded from all processing except ungrouping.
function isBlackColor(val: string): boolean {
  const v = val.trim().toLowerCase()
  return v === 'black' || v === '#000' || v === '#000000' ||
    /^rgb\(\s*0\s*,\s*0\s*,\s*0\s*\)$/.test(v)
}

function isBlack(el: Element): boolean {
  const styleProps: Record<string, string> = {}
  const styleAttr = el.getAttribute('style') ?? ''
  for (const decl of styleAttr.split(';')) {
    const colon = decl.indexOf(':')
    if (colon === -1) continue
    styleProps[decl.slice(0, colon).trim()] = decl.slice(colon + 1).trim()
  }
  const fillVal = styleProps['fill'] ?? el.getAttribute('fill') ?? ''
  const strokeVal = styleProps['stroke'] ?? el.getAttribute('stroke') ?? ''
  return isBlackColor(fillVal) || isBlackColor(strokeVal)
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

function isInText(el: Element): boolean {
  let node: Element | null = el.parentElement
  while (node) {
    const tag = (node.localName ?? node.tagName).toLowerCase()
    if (tag === 'text' || tag === 'tspan') return true
    node = node.parentElement
  }
  return false
}

function parseNums(s: string): number[] {
  return (s.match(/[-+]?(?:\d*\.?\d+)(?:[eE][-+]?\d+)?/g) ?? []).map(Number)
}

// Parses straight-line paths (M/m/L/l/H/h/V/v/Z/z only) into a point array.
// Z/z closes the subpath by appending the start point, exposing the closing segment
// to deduplication so shared edges between adjacent closed shapes are removed.
function parseLinearPoints(el: Element): Point[] | null {
  const d = el.getAttribute('d') ?? ''
  if (/[CcSsQqTtAa]/.test(d)) return null
  if ((d.match(/[Mm]/g) ?? []).length > 1) return null

  const points: Point[] = []
  let x = 0, y = 0

  for (const token of d.trim().split(/(?=[MmLlHhVvZz])/)) {
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
      case 'Z': case 'z': if (points.length > 0) points.push({ ...points[0] }); break
    }
  }

  return points.length >= 2 ? points : null
}

// Explodes a multi-point linear path into one PathFrag per adjacent point pair.
// This prevents back-tracking: reversed duplicates are removed by deduplicateFragsInGroup.
function extractLinearFrags(el: Element): PathFrag[] {
  const points = parseLinearPoints(el)
  if (!points) return []
  return points.slice(0, -1).map((a, i) => {
    const b = points[i + 1]
    return { start: a, end: b, forwardD: `L ${b.x},${b.y}`, reverseD: `L ${a.x},${a.y}`, el }
  })
}

// Removes frags whose geometry duplicates (or reverses) a frag already in the result.
function deduplicateFragsInGroup(segs: PathFrag[]): PathFrag[] {
  const result: PathFrag[] = []
  for (const frag of segs) {
    const isDup = result.some(k =>
      (pointsEqual(k.start, frag.end) && pointsEqual(k.end, frag.start)) ||
      (pointsEqual(k.start, frag.start) && pointsEqual(k.end, frag.end))
    )
    if (!isDup) result.push(frag)
  }
  return result
}

// Parses paths that contain only M/m and Q/q commands (quadratic beziers),
// with no other curve or close commands. Chains all Q segments into a single
// PathFrag from the path's overall start to end.
// Reversing a quadratic `q cx,cy ex,ey` from end back to start:
//   relative control = (cx-ex, cy-ey), relative end = (-ex, -ey)
function extractQFrag(el: Element): PathFrag | null {
  const d = el.getAttribute('d') ?? ''
  if (/[CcSsAaZzLlHhVv]/.test(d)) return null
  if (!/[Qq]/.test(d)) return null
  if ((d.match(/[Mm]/g) ?? []).length !== 1) return null

  const mMatch = d.match(/^[\s]*[Mm]\s*([-+\d.eE]+)[,\s]+([-+\d.eE]+)/)
  if (!mMatch) return null
  const startX = parseFloat(mMatch[1]), startY = parseFloat(mMatch[2])
  let curX = startX, curY = startY

  // Forward command strings for each Q segment
  const forwardParts: string[] = []
  // Reverse command strings (built in reverse order, then reversed at end)
  const reverseParts: string[] = []

  const qRe = /([Qq])\s*([-+\d.eE]+)[,\s]+([-+\d.eE]+)[,\s]+([-+\d.eE]+)[,\s]+([-+\d.eE]+)/g
  let m: RegExpExecArray | null
  while ((m = qRe.exec(d)) !== null) {
    const isRel = m[1] === 'q'
    const cx = isRel ? curX + parseFloat(m[2]) : parseFloat(m[2])
    const cy = isRel ? curY + parseFloat(m[3]) : parseFloat(m[3])
    const ex = isRel ? curX + parseFloat(m[4]) : parseFloat(m[4])
    const ey = isRel ? curY + parseFloat(m[5]) : parseFloat(m[5])
    forwardParts.push(`Q ${cx},${cy} ${ex},${ey}`)
    // Reverse: from (ex,ey) back to (curX,curY); control point stays the same
    reverseParts.push(`Q ${cx},${cy} ${curX},${curY}`)
    curX = ex; curY = ey
  }

  if (forwardParts.length === 0) return null

  return {
    start: { x: startX, y: startY },
    end: { x: curX, y: curY },
    forwardD: forwardParts.join(' '),
    reverseD: reverseParts.reverse().join(' '),
    el
  }
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
    if (isInText(el)) continue
    if (isBlack(el)) continue
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
    if (isInText(el)) continue
    if (hasFill(el) || isBlack(el)) continue
    const linears = extractLinearFrags(el)
    if (linears.length > 0) { result.push(...linears); continue }
    const q = extractQFrag(el)
    if (q) { result.push(q); continue }
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

// If two straight-line frags (L commands) are collinear and their projections
// onto the shared axis overlap (more than just touching), returns a single merged
// frag spanning the full extent of both. Arc frags are left unchanged.
function tryMergeCollinear(a: PathFrag, b: PathFrag): PathFrag | null {
  if (!a.forwardD.trimStart().startsWith('L')) return null
  if (!b.forwardD.trimStart().startsWith('L')) return null

  const dx = a.end.x - a.start.x
  const dy = a.end.y - a.start.y
  const lenSq = dx * dx + dy * dy
  if (lenSq < 1e-10) return null
  const len = Math.sqrt(lenSq)
  const ux = dx / len, uy = dy / len

  const bdx = b.end.x - b.start.x
  const bdy = b.end.y - b.start.y
  const bLen = Math.sqrt(bdx * bdx + bdy * bdy)
  if (bLen < 1e-10) return null

  // Parallelism: |cross(unit_a, unit_b)| must be near zero
  if (Math.abs(ux * (bdy / bLen) - uy * (bdx / bLen)) > 0.01) return null

  // Collinearity: perpendicular distance from b.start to line through a
  const cdx = b.start.x - a.start.x
  const cdy = b.start.y - a.start.y
  if (Math.abs(ux * cdy - uy * cdx) > EPS) return null

  // Project all endpoints onto the line
  const t_b0 = ux * cdx + uy * cdy
  const t_b1 = ux * (b.end.x - a.start.x) + uy * (b.end.y - a.start.y)
  const minB = Math.min(t_b0, t_b1)
  const maxB = Math.max(t_b0, t_b1)
  // a's range is always [0, len]
  const overlapMin = Math.max(0, minB)
  const overlapMax = Math.min(len, maxB)

  // Require real overlap (> EPS), not just endpoint touching — chainFrags handles that
  if (overlapMax <= overlapMin + EPS) return null

  const tMin = Math.min(0, minB)
  const tMax = Math.max(len, maxB)
  const start: Point = { x: a.start.x + ux * tMin, y: a.start.y + uy * tMin }
  const end: Point = { x: a.start.x + ux * tMax, y: a.start.y + uy * tMax }

  return {
    start, end,
    forwardD: `L ${end.x},${end.y}`,
    reverseD: `L ${start.x},${start.y}`,
    el: a.el
  }
}

// Iteratively merges collinear-overlapping frag pairs (from different elements)
// until no more merges are possible.
function mergeCollinearOverlaps(frags: PathFrag[]): PathFrag[] {
  let result = [...frags]
  let changed = true
  while (changed) {
    changed = false
    outer: for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        if (result[i].el === result[j].el) continue
        const m = tryMergeCollinear(result[i], result[j])
        if (m) {
          result.splice(j, 1)
          result.splice(i, 1)
          result.push(m)
          changed = true
          break outer
        }
      }
    }
  }
  return result
}

// ── Circular-arc overlap detection and merging ──────────────────────────────

interface ArcInfo {
  cx: number; cy: number; r: number
  startAngle: number; endAngle: number  // degrees, 0=+x axis, increases CW in SVG screen coords
  sweep: number
  el: Element
}

// Compute the center of a circular arc (rx=ry=r, rotation=0).
// Returns null when the two points are too far apart for the given radius.
function computeArcCenter(
  x1: number, y1: number, x2: number, y2: number,
  r: number, largeArc: number, sweep: number
): { cx: number; cy: number } | null {
  const hx = (x1 - x2) / 2, hy = (y1 - y2) / 2
  const hs = hx * hx + hy * hy
  if (hs >= r * r - 1e-6) return null
  // sign: (largeArc XOR sweep) selects which of the two candidate centers to use
  const sign = (largeArc === sweep) ? -1 : 1
  const t = sign * Math.sqrt(r * r - hs)
  const sqHs = Math.sqrt(hs)
  return {
    cx: (x1 + x2) / 2 + t * hy / sqHs,
    cy: (y1 + y2) / 2 - t * hx / sqHs
  }
}

function toDegrees(rad: number): number {
  return (((rad * 180 / Math.PI) % 360) + 360) % 360
}

function normAngle(a: number): number {
  return ((a % 360) + 360) % 360
}

// Angular span covered by this arc in its sweep direction (always > 0, ≤ 360)
function arcSpanDeg(info: ArcInfo): number {
  const span = info.sweep === 1
    ? normAngle(info.endAngle - info.startAngle)
    : normAngle(info.startAngle - info.endAngle)
  return span === 0 ? 360 : span
}

// Parse all circular arc segments (A/a, rx=ry, rotation=0) from an eligible path element.
// Returns one ArcInfo per arc command. Paths with C/S/Q/T/Z commands are skipped.
function collectArcInfos(el: Element): ArcInfo[] {
  const d = el.getAttribute('d') ?? ''
  if (/[CcSsQqTtZz]/.test(d)) return []
  if (!/[Aa]/.test(d)) return []
  if (isInDefs(el) || isInText(el) || hasFill(el) || isBlack(el)) return []

  const mMatch = d.match(/^[\s]*[Mm]\s*([-+\d.eE]+)[,\s]+([-+\d.eE]+)/)
  if (!mMatch) return []
  let curX = parseFloat(mMatch[1])
  let curY = parseFloat(mMatch[2])

  const result: ArcInfo[] = []
  const arcRe = /([Aa])\s*([-+\d.eE]+)[,\s]+([-+\d.eE]+)[,\s]+([-+\d.eE]+)[,\s]+([01])[,\s]+([01])[,\s]+([-+\d.eE]+)[,\s]+([-+\d.eE]+)/g
  let m: RegExpExecArray | null
  while ((m = arcRe.exec(d)) !== null) {
    const isRel = m[1] === 'a'
    const rx = parseFloat(m[2]), ry = parseFloat(m[3])
    const rot = parseFloat(m[4])
    const largeArc = parseInt(m[5]), sweep = parseInt(m[6])
    const endX = isRel ? curX + parseFloat(m[7]) : parseFloat(m[7])
    const endY = isRel ? curY + parseFloat(m[8]) : parseFloat(m[8])
    // Only handle circular arcs with no rotation
    if (Math.abs(rx - ry) < 0.01 && Math.abs(rot) < 0.01) {
      const c = computeArcCenter(curX, curY, endX, endY, rx, largeArc, sweep)
      if (c) {
        result.push({
          cx: c.cx, cy: c.cy, r: rx,
          startAngle: toDegrees(Math.atan2(curY - c.cy, curX - c.cx)),
          endAngle: toDegrees(Math.atan2(endY - c.cy, endX - c.cx)),
          sweep, el
        })
      }
    }
    curX = endX
    curY = endY
  }
  return result
}

// Group key: arcs on the same circle with the same sweep direction and transform
function circleKey(info: ArcInfo, el: Element): string {
  const r = (n: number) => Math.round(n * 10) / 10
  const transform = el.getAttribute('transform') ?? ''
  return `${r(info.cx)},${r(info.cy)},${r(info.r)},sw${info.sweep}|t=${transform}`
}

// Merge a group of ArcInfos on the same circle into the minimal non-overlapping set.
// Uses offset-from-reference representation to avoid angle wrap-around issues.
function mergeArcGroup(infos: ArcInfo[]): ArcInfo[] {
  if (infos.length <= 1) return infos
  const sweep = infos[0].sweep
  const ref = infos[0].startAngle

  // Convert each arc to [startOffset, endOffset] measured in sweep direction from ref
  const intervals = infos.map(info => {
    const startOff = sweep === 1
      ? normAngle(info.startAngle - ref)
      : normAngle(ref - info.startAngle)
    return { start: startOff, end: startOff + arcSpanDeg(info), info }
  })
  intervals.sort((a, b) => a.start - b.start)

  // Standard interval merge with 0.5° touching tolerance
  const merged: { start: number; end: number; info: ArcInfo }[] = []
  for (const iv of intervals) {
    if (merged.length === 0 || iv.start > merged[merged.length - 1].end + 0.5) {
      merged.push({ ...iv })
    } else if (iv.end > merged[merged.length - 1].end) {
      merged[merged.length - 1].end = iv.end
    }
  }

  // Convert offsets back to absolute angles
  return merged.map(m => {
    const startAngle = sweep === 1 ? normAngle(ref + m.start) : normAngle(ref - m.start)
    const endAngle   = sweep === 1 ? normAngle(ref + m.end)   : normAngle(ref - m.end)
    return { ...m.info, startAngle, endAngle }
  })
}

// Build a <path> element from a merged ArcInfo, copying style from refEl
function arcInfoToElement(info: ArcInfo, doc: Document, refEl: Element): Element {
  const toRad = (deg: number) => deg * Math.PI / 180
  const x1 = info.cx + info.r * Math.cos(toRad(info.startAngle))
  const y1 = info.cy + info.r * Math.sin(toRad(info.startAngle))
  const x2 = info.cx + info.r * Math.cos(toRad(info.endAngle))
  const y2 = info.cy + info.r * Math.sin(toRad(info.endAngle))
  const largeArc = arcSpanDeg(info) > 180 ? 1 : 0
  const path = doc.createElementNS('http://www.w3.org/2000/svg', 'path')
  path.setAttribute('d', `M ${x1},${y1} A ${info.r},${info.r} 0 ${largeArc} ${info.sweep} ${x2},${y2}`)
  for (const attr of Array.from(refEl.attributes)) {
    if (!['id', 'd'].includes(attr.name)) path.setAttribute(attr.name, attr.value)
  }
  return path
}

// Detect which elements contain arcs that overlap with arcs from a different element
// on the same circle. Returns the set of violating elements.
function findOverlappingArcElements(doc: Document): Set<Element> {
  const groups = new Map<string, ArcInfo[]>()
  for (const el of Array.from(doc.querySelectorAll('path'))) {
    for (const arc of collectArcInfos(el)) {
      const key = circleKey(arc, el)
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(arc)
    }
  }
  const violating = new Set<Element>()
  for (const arcs of groups.values()) {
    const distinctEls = new Set(arcs.map(a => a.el))
    if (distinctEls.size < 2) continue
    const merged = mergeArcGroup(arcs)
    if (merged.length < distinctEls.size) {
      for (const el of distinctEls) violating.add(el)
    }
  }
  return violating
}

// Merge all overlapping circular arcs in-place on the document
function mergeOverlappingArcs(doc: Document): void {
  const groups = new Map<string, ArcInfo[]>()
  for (const el of Array.from(doc.querySelectorAll('path'))) {
    for (const arc of collectArcInfos(el)) {
      const key = circleKey(arc, el)
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(arc)
    }
  }

  for (const arcs of groups.values()) {
    const distinctEls = new Set(arcs.map(a => a.el))
    if (distinctEls.size < 2) continue
    const merged = mergeArcGroup(arcs)
    if (merged.length >= distinctEls.size) continue  // nothing changed
    const refEl = arcs[0].el
    const parent = refEl.parentNode
    if (!parent) continue
    for (const info of merged) {
      parent.insertBefore(arcInfoToElement(info, doc, refEl), refEl)
    }
    for (const el of distinctEls) {
      el.parentNode?.removeChild(el)
    }
  }
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
          if (segs[i].el === segs[j].el) continue
          if (sharesEndpoint(segs[i], segs[j]) || tryMergeCollinear(segs[i], segs[j])) {
            violatingSet.add(segs[i].el)
            violatingSet.add(segs[j].el)
          }
        }
      }
    }

    // Detect overlapping circular arcs across different elements
    for (const el of findOverlappingArcElements(doc)) violatingSet.add(el)

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
    // Remove tiny curve stubs (dimension tick marks < 1 SVG unit end-to-end).
    // These are single-subpath paths with only curve commands (c/C/s/S/q/Q/t/T)
    // that were split out of compound paths and would cause unwanted laser pierce points.
    for (const el of Array.from(doc.querySelectorAll('path'))) {
      if (isInDefs(el)) continue
      if (hasFill(el) || isBlack(el)) continue
      const d = el.getAttribute('d') ?? ''
      if (/[LlHhVvAaZz]/.test(d)) continue           // has real geometry — keep
      if (!/[CcSsQqTt]/.test(d)) continue             // no curve commands — skip
      if ((d.match(/[Mm]/g) ?? []).length !== 1) continue  // multi-subpath — keep
      // Compute endpoint offset from the last pair of numbers in the d string
      const nums = (d.match(/[-+]?(?:\d*\.?\d+)(?:[eE][+-]?\d+)?/g) ?? []).map(Number)
      if (nums.length < 2) continue
      const dx = nums[nums.length - 2], dy = nums[nums.length - 1]
      if (Math.sqrt(dx * dx + dy * dy) < 1.0) el.parentNode?.removeChild(el)
    }

    // Merge overlapping circular arcs before straight-line chaining
    mergeOverlappingArcs(doc)

    const segments = collectSegments(doc)
    if (segments.length === 0) return

    const groups = new Map<string, PathFrag[]>()
    for (const seg of segments) {
      const key = styleKey(seg.el)
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(seg)
    }

    for (const segs of groups.values()) {
      const chains = chainFrags(mergeCollinearOverlaps(deduplicateFragsInGroup(segs)))
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
