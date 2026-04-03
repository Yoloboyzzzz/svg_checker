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

function isInText(el: Element): boolean {
  let node: Element | null = el.parentElement
  while (node) {
    const tag = (node.localName ?? node.tagName).toLowerCase()
    if (tag === 'text' || tag === 'tspan') return true
    node = node.parentElement
  }
  return false
}

function isBlackColor(val: string): boolean {
  const v = val.trim().toLowerCase()
  return v === 'black' || v === '#000' || v === '#000000' ||
    /^rgb\(\s*0\s*,\s*0\s*,\s*0\s*\)$/.test(v)
}

function isRedColor(val: string): boolean {
  const v = val.trim().toLowerCase()
  return v === 'red' || v === '#f00' || v === '#ff0000' ||
    /^rgb\(\s*255\s*,\s*0\s*,\s*0\s*\)$/.test(v)
}

function isBlueColor(val: string): boolean {
  const v = val.trim().toLowerCase()
  return v === 'blue' || v === '#00f' || v === '#0000ff' ||
    /^rgb\(\s*0\s*,\s*0\s*,\s*255\s*\)$/.test(v)
}

function getStyleProps(el: Element): Record<string, string> {
  const props: Record<string, string> = {}
  const styleAttr = el.getAttribute('style') ?? ''
  for (const decl of styleAttr.split(';')) {
    const colon = decl.indexOf(':')
    if (colon === -1) continue
    props[decl.slice(0, colon).trim()] = decl.slice(colon + 1).trim()
  }
  return props
}

function isBlack(el: Element): boolean {
  const styleProps = getStyleProps(el)
  const fillVal = styleProps['fill'] ?? el.getAttribute('fill') ?? ''
  const strokeVal = styleProps['stroke'] ?? el.getAttribute('stroke') ?? ''
  // SVG default fill is black — absent fill means black
  if (fillVal === '') return true
  return isBlackColor(fillVal) || isBlackColor(strokeVal)
}

// Returns 0 for red, 1 for blue, 2 for everything else
function colorPriority(el: Element): number {
  const styleProps = getStyleProps(el)
  const fillVal = styleProps['fill'] ?? el.getAttribute('fill') ?? ''
  if (isRedColor(fillVal)) return 0
  if (isBlueColor(fillVal)) return 1
  return 2
}

function isCompound(d: string): boolean {
  return (d.match(/[Mm]/g) ?? []).length > 1
}

// Track the final absolute position after traversing a path string.
// Handles all SVG path commands so relative 'm' offsets are computed correctly.
function trackEndPosition(d: string): { x: number; y: number } {
  let x = 0, y = 0
  const tokens = d.trim().split(/(?=[MmLlHhVvCcSsQqTtAaZz])/).filter(t => t.trim())
  for (const token of tokens) {
    const cmd = token.trim()[0]
    const args = (token.slice(1).match(/[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) ?? []).map(Number)
    switch (cmd) {
      case 'M':
        // First pair: absolute move. Subsequent pairs: implicit absolute L.
        for (let i = 0; i + 1 < args.length; i += 2) { x = args[i]; y = args[i + 1] }
        break
      case 'm':
        // First pair: relative move. Subsequent pairs: implicit relative l.
        if (args.length >= 2) { x += args[0]; y += args[1] }
        for (let i = 2; i + 1 < args.length; i += 2) { x += args[i]; y += args[i + 1] }
        break
      case 'L': for (let i = 0; i + 1 < args.length; i += 2) { x = args[i]; y = args[i + 1] } break
      case 'l': for (let i = 0; i + 1 < args.length; i += 2) { x += args[i]; y += args[i + 1] } break
      case 'H': if (args.length) x = args[args.length - 1]; break
      case 'h': for (const a of args) x += a; break
      case 'V': if (args.length) y = args[args.length - 1]; break
      case 'v': for (const a of args) y += a; break
      case 'C': for (let i = 0; i + 5 < args.length; i += 6) { x = args[i + 4]; y = args[i + 5] } break
      case 'c': for (let i = 0; i + 5 < args.length; i += 6) { x += args[i + 4]; y += args[i + 5] } break
      case 'S': case 'Q': for (let i = 0; i + 3 < args.length; i += 4) { x = args[i + 2]; y = args[i + 3] } break
      case 's': case 'q': for (let i = 0; i + 3 < args.length; i += 4) { x += args[i + 2]; y += args[i + 3] } break
      case 'T': for (let i = 0; i + 1 < args.length; i += 2) { x = args[i]; y = args[i + 1] } break
      case 't': for (let i = 0; i + 1 < args.length; i += 2) { x += args[i]; y += args[i + 1] } break
      case 'A': for (let i = 0; i + 6 < args.length; i += 7) { x = args[i + 5]; y = args[i + 6] } break
      case 'a': for (let i = 0; i + 6 < args.length; i += 7) { x += args[i + 5]; y += args[i + 6] } break
      // Z: closes to path start — we ignore it for position tracking purposes
    }
  }
  return { x, y }
}

// Splits a compound path into individual sub-path strings, converting any
// relative 'm' start commands to absolute 'M' so each sub-path is self-contained.
function splitCompoundPath(d: string): string[] {
  const rawParts = d.split(/(?=[Mm])/).filter(s => s.trim() !== '')
  if (rawParts.length <= 1) return rawParts.map(p => p.trim())

  const result: string[] = []
  let curX = 0, curY = 0

  for (const part of rawParts) {
    const trimmed = part.trim()
    const cmd = trimmed[0]
    const rest = trimmed.slice(1).trim()

    // Extract the first coordinate pair of this sub-path
    const firstPair = rest.match(
      /^([-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)[,\s]+([-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)/
    )

    if (!firstPair || cmd === 'M') {
      // Absolute move or unparseable — use as-is
      if (cmd === 'M' && firstPair) {
        curX = parseFloat(firstPair[1])
        curY = parseFloat(firstPair[2])
      }
      result.push(trimmed)
    } else {
      // Relative 'm' — resolve against current position
      const absX = curX + parseFloat(firstPair[1])
      const absY = curY + parseFloat(firstPair[2])
      const afterFirstPair = rest.slice(firstPair[0].length).trim()

      let normalized: string
      if (!afterFirstPair) {
        normalized = `M ${absX},${absY}`
      } else if (/^[MmLlHhVvCcSsQqTtAaZz]/.test(afterFirstPair)) {
        // Explicit command follows — append as-is (it was already correct)
        normalized = `M ${absX},${absY} ${afterFirstPair}`
      } else {
        // Implicit coordinate pairs after 'm' are relative l commands.
        // After converting to 'M', they must become explicit 'l' so they
        // are not misread as absolute L coordinates.
        normalized = `M ${absX},${absY} l ${afterFirstPair}`
      }
      result.push(normalized)
    }

    // Advance current position to the end of this sub-path
    const end = trackEndPosition(result[result.length - 1])
    curX = end.x
    curY = end.y
  }

  return result
}

function hasDrawCommands(d: string): boolean {
  return /[LlHhVvCcSsQqTtAa]/.test(d)
}

type Bounds = { x1: number; y1: number; x2: number; y2: number }

function approxBounds(d: string): Bounds | null {
  const xs: number[] = [], ys: number[] = []
  let cx = 0, cy = 0
  const tokens = d.trim().split(/(?=[MmLlHhVvCcSsQqTtAaZz])/).filter(t => t.trim())
  for (const token of tokens) {
    const cmd = token.trim()[0]
    const args = (token.slice(1).match(/[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) ?? []).map(Number)
    switch (cmd) {
      case 'M': case 'L': case 'T':
        for (let i = 0; i + 1 < args.length; i += 2) { cx = args[i]; cy = args[i + 1]; xs.push(cx); ys.push(cy) } break
      case 'm': case 'l': case 't':
        for (let i = 0; i + 1 < args.length; i += 2) { cx += args[i]; cy += args[i + 1]; xs.push(cx); ys.push(cy) } break
      case 'H': for (const a of args) { cx = a; xs.push(cx) } break
      case 'h': for (const a of args) { cx += a; xs.push(cx) } break
      case 'V': for (const a of args) { cy = a; ys.push(cy) } break
      case 'v': for (const a of args) { cy += a; ys.push(cy) } break
      case 'C': for (let i = 0; i + 5 < args.length; i += 6) { xs.push(args[i], args[i + 2], args[i + 4]); ys.push(args[i + 1], args[i + 3], args[i + 5]); cx = args[i + 4]; cy = args[i + 5] } break
      case 'c': for (let i = 0; i + 5 < args.length; i += 6) { xs.push(cx + args[i], cx + args[i + 2], cx + args[i + 4]); ys.push(cy + args[i + 1], cy + args[i + 3], cy + args[i + 5]); cx += args[i + 4]; cy += args[i + 5] } break
      case 'S': case 'Q': for (let i = 0; i + 3 < args.length; i += 4) { xs.push(args[i], args[i + 2]); ys.push(args[i + 1], args[i + 3]); cx = args[i + 2]; cy = args[i + 3] } break
      case 's': case 'q': for (let i = 0; i + 3 < args.length; i += 4) { xs.push(cx + args[i], cx + args[i + 2]); ys.push(cy + args[i + 1], cy + args[i + 3]); cx += args[i + 2]; cy += args[i + 3] } break
      case 'A': for (let i = 0; i + 6 < args.length; i += 7) { xs.push(args[i + 5]); ys.push(args[i + 6]); cx = args[i + 5]; cy = args[i + 6] } break
      case 'a': for (let i = 0; i + 6 < args.length; i += 7) { xs.push(cx + args[i + 5]); ys.push(cy + args[i + 6]); cx += args[i + 5]; cy += args[i + 6] } break
    }
  }
  if (!xs.length || !ys.length) return null
  return { x1: Math.min(...xs), y1: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys) }
}

function boundsOverlap(a: Bounds, b: Bounds): boolean {
  return a.x1 <= b.x2 && a.x2 >= b.x1 && a.y1 <= b.y2 && a.y2 >= b.y1
}

export const compoundPathRule: CheckRule = {
  category: 'compound-paths',
  label: 'No Compound Paths',
  defaultWeight: 1/4,

  check(doc: Document): CheckResult {
    const paths = Array.from(doc.querySelectorAll('path')).filter(p => !isInDefs(p) && !isInText(p) && !isBlack(p))
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
      totalChecked: paths.length,
      violations
    }
  },

  fix(doc: Document): void {
    const paths = Array.from(doc.querySelectorAll('path')).filter(p => !isInDefs(p) && !isInText(p) && !isBlack(p))
    const compoundPaths = paths.filter(p => isCompound(p.getAttribute('d') ?? ''))

    // Group compound paths by parent so we can sort within each group
    const byParent = new Map<Node, Element[]>()
    for (const path of compoundPaths) {
      const parent = path.parentNode!
      if (!byParent.has(parent)) byParent.set(parent, [])
      byParent.get(parent)!.push(path)
    }

    for (const [parent, group] of byParent) {
      // Capture insertion anchor (node before the first compound path in this group)
      const anchor = group[0].previousSibling

      // Collect all sub-paths from every compound path in this group
      const collected: Array<{ el: Element; priority: number }> = []
      for (const path of group) {
        const d = path.getAttribute('d') ?? ''
        const subPaths = splitCompoundPath(d).filter(hasDrawCommands)
        const priority = colorPriority(path)
        const originalId = path.getAttribute('id')
        let firstOfPath = true
        for (const subD of subPaths) {
          const newPath = path.cloneNode(false) as Element
          newPath.setAttribute('d', subD)
          if (firstOfPath && originalId) {
            newPath.setAttribute('id', originalId)
          } else {
            newPath.removeAttribute('id')
          }
          firstOfPath = false
          collected.push({ el: newPath, priority })
        }
        parent.removeChild(path)
      }

      // Sort: only reorder paths that overlap; Red (0) → Blue (1) → everything else (2).
      // Non-overlapping paths keep their original relative order.
      const bounds = collected.map(item => approxBounds(item.el.getAttribute('d') ?? ''))
      let swapped = true
      while (swapped) {
        swapped = false
        for (let i = 0; i + 1 < collected.length; i++) {
          const bi = bounds[i], bj = bounds[i + 1]
          if (bi && bj && boundsOverlap(bi, bj) && collected[i].priority > collected[i + 1].priority) {
            ;[collected[i], collected[i + 1]] = [collected[i + 1], collected[i]]
            ;[bounds[i], bounds[i + 1]] = [bounds[i + 1], bounds[i]]
            swapped = true
          }
        }
      }

      // Insert sorted paths at the position of the first compound path
      let insertAfter = anchor
      for (const { el } of collected) {
        parent.insertBefore(el, insertAfter ? insertAfter.nextSibling : parent.firstChild)
        insertAfter = el
      }
    }
  }
}
