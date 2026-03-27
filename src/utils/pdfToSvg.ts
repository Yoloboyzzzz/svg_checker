import * as pdfjs from 'pdfjs-dist'
import type { PDFDocumentProxy } from 'pdfjs-dist'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.js',
  import.meta.url
).href

export type { PDFDocumentProxy }

export async function loadPdf(file: File): Promise<PDFDocumentProxy> {
  const buffer = await file.arrayBuffer()
  const pdf = await pdfjs.getDocument({ data: buffer }).promise
  return pdf
}

export async function renderPageThumbnail(
  pdf: PDFDocumentProxy,
  pageNum: number,
  targetWidth: number
): Promise<string> {
  const page = await pdf.getPage(pageNum)
  const viewport = page.getViewport({ scale: 1 })
  const scale = targetWidth / viewport.width
  const scaled = page.getViewport({ scale })

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(scaled.width)
  canvas.height = Math.round(scaled.height)
  const ctx = canvas.getContext('2d')!
  await page.render({ canvasContext: ctx, viewport: scaled }).promise
  return canvas.toDataURL()
}

export async function pageToSvg(pdf: PDFDocumentProxy, pageNum: number): Promise<string> {
  const page = await pdf.getPage(pageNum)
  const viewport = page.getViewport({ scale: 1 })
  const operatorList = await page.getOperatorList()

  // SVGGraphics is exported from pdfjs-dist 3.x build
  const { SVGGraphics } = pdfjs as unknown as { SVGGraphics: new (commonObjs: unknown, objs: unknown) => { embedFonts: boolean; getSVG(ops: unknown, vp: unknown): Promise<Element> } }
  const gfx = new SVGGraphics(page.commonObjs, page.objs)
  gfx.embedFonts = true

  const svgEl = await gfx.getSVG(operatorList, viewport)
  return new XMLSerializer().serializeToString(svgEl)
}
