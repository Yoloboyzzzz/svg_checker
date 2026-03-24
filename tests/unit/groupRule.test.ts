import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

function loadFixture(name: string): string {
  return readFileSync(resolve(__dirname, `../fixtures/${name}`), 'utf-8')
}

describe('groupRule.check()', () => {
  it('fails when SVG contains <g> elements', async () => {
    const { groupRule } = await import('../../src/checker/rules/groupRule')
    const parser = new DOMParser()
    const doc = parser.parseFromString(loadFixture('with-groups.svg'), 'image/svg+xml')
    const result = groupRule.check(doc)
    expect(result.pass).toBe(false)
    expect(result.violationCount).toBeGreaterThanOrEqual(1)
    expect(result.violations.length).toBeGreaterThanOrEqual(1)
  })

  it('passes when SVG has no <g> elements', async () => {
    const { groupRule } = await import('../../src/checker/rules/groupRule')
    const parser = new DOMParser()
    const doc = parser.parseFromString(loadFixture('clean.svg'), 'image/svg+xml')
    const result = groupRule.check(doc)
    expect(result.pass).toBe(true)
    expect(result.violationCount).toBe(0)
  })

  it('passes for empty SVG', async () => {
    const { groupRule } = await import('../../src/checker/rules/groupRule')
    const parser = new DOMParser()
    const doc = parser.parseFromString(loadFixture('empty.svg'), 'image/svg+xml')
    const result = groupRule.check(doc)
    expect(result.pass).toBe(true)
  })
})

describe('groupRule.fix()', () => {
  it('removes all <g> elements', async () => {
    const { groupRule } = await import('../../src/checker/rules/groupRule')
    const parser = new DOMParser()
    const doc = parser.parseFromString(loadFixture('with-groups.svg'), 'image/svg+xml')
    groupRule.fix(doc)
    const result = groupRule.check(doc)
    expect(result.pass).toBe(true)
  })

  it('does not remove Inkscape layer <g> elements', async () => {
    const { groupRule } = await import('../../src/checker/rules/groupRule')
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape">
      <g inkscape:groupmode="layer" id="layer1"><path d="M0,0 L10,10"/></g>
    </svg>`
    const parser = new DOMParser()
    const doc = parser.parseFromString(svg, 'image/svg+xml')
    const result = groupRule.check(doc)
    expect(result.pass).toBe(true)
    groupRule.fix(doc)
    expect(doc.querySelector('g')).not.toBeNull()
  })

  it('inlines transform attribute from <g> onto children', async () => {
    const { groupRule } = await import('../../src/checker/rules/groupRule')
    const svg = `<svg xmlns="http://www.w3.org/2000/svg">
      <g transform="translate(10,10)"><path d="M0,0 L10,10"/></g>
    </svg>`
    const parser = new DOMParser()
    const doc = parser.parseFromString(svg, 'image/svg+xml')
    groupRule.fix(doc)
    const path = doc.querySelector('path')!
    expect(path.getAttribute('transform')).toBe('translate(10,10)')
    expect(doc.querySelector('g')).toBeNull()
  })
})
