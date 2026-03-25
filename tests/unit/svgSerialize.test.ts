import { describe, it, expect } from 'vitest'
import { serializeSVG } from '../../src/utils/svgSerialize'

describe('serializeSVG()', () => {
  it('always includes xmlns on root svg element', () => {
    const parser = new DOMParser()
    const svgString = '<svg xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="40"/></svg>'
    const doc = parser.parseFromString(svgString, 'image/svg+xml')
    // Manipulate the doc to trigger any edge cases in XMLSerializer
    const rect = doc.createElementNS('http://www.w3.org/2000/svg', 'rect')
    rect.setAttribute('x', '10')
    rect.setAttribute('y', '10')
    rect.setAttribute('width', '20')
    rect.setAttribute('height', '20')
    doc.documentElement.appendChild(rect)
    const result = serializeSVG(doc)
    expect(result).toContain('xmlns="http://www.w3.org/2000/svg"')
    expect(result).toMatch(/^<svg/)
  })
})
