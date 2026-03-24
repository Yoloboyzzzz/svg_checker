export function parseSVG(svgString: string): Document {
  const parser = new DOMParser()
  const doc = parser.parseFromString(svgString, 'image/svg+xml')
  const errorNode = doc.querySelector('parsererror')
  if (errorNode) {
    throw new Error('Invalid SVG: malformed XML')
  }
  return doc
}
