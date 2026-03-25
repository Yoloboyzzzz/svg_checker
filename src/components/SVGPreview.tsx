import DOMPurify from 'dompurify'

interface SVGPreviewProps {
  svgString: string
  label: string
}

function fitSVG(svg: string): string {
  // Extract existing width/height/viewBox from the root <svg> tag
  const wMatch = svg.match(/<svg[^>]*\swidth="([^"]*)"/)
  const hMatch = svg.match(/<svg[^>]*\sheight="([^"]*)"/)
  const vbMatch = svg.match(/<svg[^>]*\sviewBox="([^"]*)"/)

  let viewBox = vbMatch?.[1]
  if (!viewBox && wMatch && hMatch) {
    viewBox = `0 0 ${parseFloat(wMatch[1])} ${parseFloat(hMatch[1])}`
  }

  return svg.replace(/<svg([^>]*)>/, (_match, attrs: string) => {
    let a = attrs
      .replace(/\s+width="[^"]*"/, '')
      .replace(/\s+height="[^"]*"/, '')
      .replace(/\s+viewBox="[^"]*"/, '')
    if (viewBox) a += ` viewBox="${viewBox}"`
    return `<svg${a} width="100%" height="100%">`
  })
}

export function SVGPreview({ svgString, label }: SVGPreviewProps) {
  const sanitized = DOMPurify.sanitize(svgString, { USE_PROFILES: { svg: true, svgFilters: true } })
  const fitted = fitSVG(sanitized)
  return (
    <div className="rounded-xl border border-gray-200 p-4 bg-white">
      <p className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide">{label}</p>
      <div
        className="w-full [&>svg]:w-full [&>svg]:h-auto"
        dangerouslySetInnerHTML={{ __html: fitted }}
      />
    </div>
  )
}
