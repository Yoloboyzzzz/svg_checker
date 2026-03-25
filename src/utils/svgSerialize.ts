export function serializeSVG(doc: Document): string {
  const result = new XMLSerializer().serializeToString(doc.documentElement)
  if (!result.includes('xmlns="http://www.w3.org/2000/svg"')) {
    return result.replace(/^(<svg)(\s|>)/, '$1 xmlns="http://www.w3.org/2000/svg"$2')
  }
  return result
}
