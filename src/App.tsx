import { useState } from 'react'
import DOMPurify from 'dompurify'
import type { AppState } from './types'
import { DEFAULT_RULES } from './checker/rules'
import { createAnalyzer } from './checker/analyzer'
import { createFixer } from './checker/fixer'
import { downloadSVG } from './utils/download'
import { DropZone } from './components/DropZone'
import { QualityScore } from './components/QualityScore'
import { SVGPreview } from './components/SVGPreview'
import { CheckCard } from './components/CheckCard'

const analyzer = createAnalyzer(DEFAULT_RULES)
const fixer = createFixer(DEFAULT_RULES, analyzer)

function sanitize(svg: string): string {
  return DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true } })
}

export default function App() {
  const [state, setState] = useState<AppState>({ status: 'idle' })

  const handleFile = (content: string, filename: string, fileSize: number) => {
    setState({ status: 'loading' })
    try {
      const report = analyzer.analyze(content, filename, fileSize)
      setState({
        status: 'analyzed',
        rawSvg: content,
        report,
        sanitizedSvg: sanitize(content),
      })
    } catch (e) {
      setState({ status: 'error', message: (e as Error).message })
    }
  }

  const handleFix = () => {
    if (state.status !== 'analyzed' && state.status !== 'fixed') return
    const rawSvg = state.rawSvg
    const filename = state.report.filename
    const fileSize = state.report.fileSize
    try {
      const fixed = fixer.fix(rawSvg, filename, fileSize)
      setState(prev => ({
        status: 'fixed',
        rawSvg: (prev as any).rawSvg,
        report: (prev as any).report,
        sanitizedSvg: (prev as any).sanitizedSvg,
        fixed,
        fixedSanitizedSvg: sanitize(fixed.content),
      }))
      downloadSVG(fixed.content, fixed.filename)
    } catch (e) {
      setState({ status: 'error', message: (e as Error).message })
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">SVG Checker</h1>
        <p className="text-gray-500 mb-8">Upload an SVG to check for groups, compound paths, and duplicate paths.</p>

        <DropZone onFile={handleFile} onError={(msg) => setState({ status: 'error', message: msg })} />

        {state.status === 'loading' && (
          <div className="mt-8 flex items-center justify-center gap-3 text-gray-500">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" aria-label="Loading" />
            <span>Analysing…</span>
          </div>
        )}

        {state.status === 'error' && (
          <div className="mt-8 rounded-xl bg-red-50 border border-red-200 p-4 text-red-700">
            {state.message}
          </div>
        )}

        {(state.status === 'analyzed' || state.status === 'fixed') && (
          <div className="mt-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SVGPreview svgString={state.sanitizedSvg} label="Original" />
              {state.status === 'fixed' && (
                <SVGPreview svgString={state.fixedSanitizedSvg} label="Fixed" />
              )}
            </div>

            <QualityScore score={state.report.score} />

            <div className="space-y-2">
              {state.report.checks.map(check => (
                <CheckCard key={check.category} result={check} />
              ))}
            </div>

            <button
              onClick={handleFix}
              disabled={state.report.score === 100}
              aria-disabled={state.report.score === 100}
              className="w-full py-3 px-6 rounded-xl font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {state.report.score === 100 ? 'No Issues to Fix' : 'Fix Issues & Download'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
