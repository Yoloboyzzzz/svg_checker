import { useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy } from '../utils/pdfToSvg'
import { renderPageThumbnail } from '../utils/pdfToSvg'

interface PdfPagePickerProps {
  pdf: PDFDocumentProxy
  filename: string
  onPickPage: (pageNum: number) => void
  onCancel: () => void
}

export function PdfPagePicker({ pdf, filename, onPickPage, onCancel }: PdfPagePickerProps) {
  const pageCount = pdf.numPages
  const [thumbs, setThumbs] = useState<(string | null)[]>(Array(pageCount).fill(null))
  const cancelledRef = useRef(false)

  useEffect(() => {
    cancelledRef.current = false
    ;(async () => {
      for (let i = 1; i <= pageCount; i++) {
        if (cancelledRef.current) break
        const dataUrl = await renderPageThumbnail(pdf, i, 180)
        if (cancelledRef.current) break
        setThumbs(prev => {
          const next = [...prev]
          next[i - 1] = dataUrl
          return next
        })
      }
    })()
    return () => { cancelledRef.current = true }
  }, [pdf, pageCount])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Select a page</h2>
            <p className="text-sm text-gray-500 mt-0.5">{filename} &mdash; {pageCount} page{pageCount !== 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 transition-colors text-2xl leading-none"
            aria-label="Cancel"
          >
            &times;
          </button>
        </div>

        {/* Grid */}
        <div className="overflow-y-auto p-6">
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
            {thumbs.map((dataUrl, idx) => (
              <button
                key={idx}
                onClick={() => onPickPage(idx + 1)}
                className="group flex flex-col items-center gap-2 rounded-xl border-2 border-transparent hover:border-blue-500 focus:border-blue-500 focus:outline-none p-2 transition-colors"
              >
                <div className="w-full bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center" style={{ aspectRatio: '1 / 1.414' }}>
                  {dataUrl
                    ? <img src={dataUrl} alt={`Page ${idx + 1}`} className="w-full h-full object-contain" />
                    : <div className="w-6 h-6 border-2 border-gray-300 border-t-blue-400 rounded-full animate-spin" />
                  }
                </div>
                <span className="text-xs text-gray-500 group-hover:text-blue-600 transition-colors">
                  Page {idx + 1}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
