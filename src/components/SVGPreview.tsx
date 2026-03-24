import DOMPurify from 'dompurify'

interface SVGPreviewProps {
  svgString: string
  label: string
}

export function SVGPreview({ svgString, label }: SVGPreviewProps) {
  const sanitized = DOMPurify.sanitize(svgString, { USE_PROFILES: { svg: true, svgFilters: true } })
  return (
    <div className="rounded-xl border border-gray-200 p-4 bg-white">
      <p className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide">{label}</p>
      <div
        className="max-h-64 overflow-hidden flex items-center justify-center [&>svg]:max-w-full [&>svg]:max-h-60"
        dangerouslySetInnerHTML={{ __html: sanitized }}
      />
    </div>
  )
}
