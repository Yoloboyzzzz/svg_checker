export function serializeSVG(doc: Document): string {
  return new XMLSerializer().serializeToString(doc.documentElement)
}
