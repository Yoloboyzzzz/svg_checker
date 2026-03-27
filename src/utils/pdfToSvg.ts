import * as pdfjs from 'pdfjs-dist'
import type { PDFDocumentProxy } from 'pdfjs-dist'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.js',
  import.meta.url
).href

export type { PDFDocumentProxy }

export async function loadPdf(file: File): Promise<PDFDocumentProxy> {
  const buffer = await file.arrayBuffer()
  const pdf = await pdfjs.getDocument({ data: buffer, fontExtraProperties: true }).promise
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

  const [operatorList, textContent] = await Promise.all([
    page.getOperatorList(),
    page.getTextContent(),
  ])

  // SVGGraphics is exported from pdfjs-dist 3.x build
  const { SVGGraphics } = pdfjs as unknown as { SVGGraphics: new (commonObjs: unknown, objs: unknown) => { embedFonts: boolean; getSVG(ops: unknown, vp: unknown): Promise<Element> } }
  const gfx = new SVGGraphics(page.commonObjs, page.objs)
  gfx.embedFonts = true

  const svgEl = await gfx.getSVG(operatorList, viewport)

  // Strip <style> elements — pdf.js serialises them with svg: namespace prefix which
  // browsers render as visible text rather than CSS when injected via innerHTML.
  svgEl.querySelectorAll('style').forEach(el => el.remove())

  // Replace PDF-encoded character bytes in <text>/<tspan> elements with the properly
  // Unicode-decoded strings from getTextContent(). Both APIs process operators in the
  // same order so the nth SVG text element corresponds to the nth text item.
  const unicodeItems = textContent.items
    .filter((item): item is typeof item & { str: string } => 'str' in item)
  const textEls = Array.from(svgEl.querySelectorAll('text'))
  textEls.forEach((textEl, i) => {
    if (i >= unicodeItems.length) return
    const str = unicodeItems[i].str
    const tspan = textEl.querySelector('tspan')
    if (!tspan) return
    tspan.textContent = str
    // Remove per-character x positions — they were tuned for the PDF font's
    // character widths and are wrong for the system font that will now render the text.
    tspan.removeAttribute('x')
  })

  return new XMLSerializer().serializeToString(svgEl)
}
