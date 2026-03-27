export type CheckCategory = 'groups' | 'compound-paths' | 'duplicate-paths' | 'disconnected-lines'

export interface ViolationDetail {
  elementIndex: number
  elementId: string | null
  description: string
}

export interface CheckResult {
  category: CheckCategory
  label: string
  weight: number
  pass: boolean
  violationCount: number
  totalChecked: number
  violations: ViolationDetail[]
}

export interface QualityReport {
  filename: string
  fileSize: number
  score: number
  checks: CheckResult[]
}

export interface FixedSVG {
  content: string
  filename: string
  report: QualityReport
}

import type { PDFDocumentProxy } from 'pdfjs-dist'

export type AppState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'pdf-picking'; pdf: PDFDocumentProxy; filename: string }
  | { status: 'error'; message: string }
  | {
      status: 'analyzed'
      rawSvg: string
      report: QualityReport
      sanitizedSvg: string
    }
  | {
      status: 'fixed'
      rawSvg: string
      report: QualityReport
      sanitizedSvg: string
      fixed: FixedSVG
      fixedSanitizedSvg: string
    }

export interface CheckRule {
  readonly category: CheckCategory
  readonly label: string
  readonly defaultWeight: number
  check(doc: Document): CheckResult
  fix(doc: Document): void
}

export interface SVGAnalyzer {
  analyze(svgString: string, filename: string, fileSize: number): QualityReport
}

export interface SVGFixer {
  fix(svgString: string, filename: string, fileSize: number): FixedSVG
}
