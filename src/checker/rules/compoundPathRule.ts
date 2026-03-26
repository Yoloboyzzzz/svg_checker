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

export const compoundPathRule: CheckRule = {
  category: 'compound-paths',
  label: 'No Compound Paths',
  defaultWeight: 1/4,

  check(doc: Document): CheckResult {
    const paths = Array.from(doc.querySelectorAll('path')).filter(p => !isInDefs(p) && !isBlack(p))
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
    const paths = Array.from(doc.querySelectorAll('path')).filter(p => !isInDefs(p) && !isBlack(p))
    for (const path of paths) {
      const d = path.getAttribute('d') ?? ''
      if (!isCompound(d)) continue
      const subPaths = splitCompoundPath(d).filter(hasDrawCommands)
      const parent = path.parentNode!
      if (subPaths.length === 0) {
        parent.removeChild(path)
        continue
      }
      for (let i = subPaths.length - 1; i >= 0; i--) {
        const newPath = path.cloneNode(false) as Element
        newPath.setAttribute('d', subPaths[i])
        if (i > 0) newPath.removeAttribute('id')
        parent.insertBefore(newPath, path.nextSibling)
      }
      parent.removeChild(path)
    }
  }
}
