import { useRef } from 'react'

interface DropZoneProps {
  onFile: (content: string, filename: string, fileSize: number) => void
  onPdf: (file: File) => void
  onError: (message: string) => void
  disabled?: boolean
}

export function DropZone({ onFile, onPdf, onError, disabled }: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const processFile = (file: File) => {
    const name = file.name.toLowerCase()
    if (name.endsWith('.pdf')) {
      onPdf(file)
      return
    }
    if (!name.endsWith('.svg')) {
      onError('Only .svg and .pdf files are supported.')
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      onFile(e.target?.result as string, file.name, file.size)
    }
    reader.readAsText(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    e.target.value = ''
  }

  return (
    <div
      className="border-2 border-dashed border-gray-300 rounded-xl p-10 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      aria-label="File upload area"
    >
      <p className="text-gray-500 text-sm mb-2">Drag & drop an SVG or PDF file here, or</p>
      <button
        type="button"
        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        disabled={disabled}
        onClick={(e) => { e.stopPropagation(); inputRef.current?.click() }}
        aria-label="Browse for file"
      >
        Browse
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".svg,.pdf"
        className="hidden"
        onChange={handleChange}
        aria-label="File input"
      />
    </div>
  )
}
