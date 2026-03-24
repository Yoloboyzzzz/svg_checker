export function normalizeColor(color: string): string {
  const el = document.createElement('div')
  el.style.color = color
  document.body.appendChild(el)
  const normalized = getComputedStyle(el).color
  document.body.removeChild(el)
  return normalized
}
