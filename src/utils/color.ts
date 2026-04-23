function hexToRgb(hex: string): [number, number, number] | null {
  const h = hex.replace("#", "").trim()
  if (h.length === 3) {
    const r = parseInt(h[0] + h[0], 16)
    const g = parseInt(h[1] + h[1], 16)
    const b = parseInt(h[2] + h[2], 16)
    if ([r, g, b].some(Number.isNaN)) return null
    return [r, g, b]
  }
  if (h.length === 6) {
    const r = parseInt(h.slice(0, 2), 16)
    const g = parseInt(h.slice(2, 4), 16)
    const b = parseInt(h.slice(4, 6), 16)
    if ([r, g, b].some(Number.isNaN)) return null
    return [r, g, b]
  }
  return null
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const srgb = [r, g, b].map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2]
}

/**
 * Returns "#000000" or "#ffffff" — whichever yields higher WCAG contrast
 * against the supplied background. Falls back to white on unparseable input.
 */
export function getReadableForeground(bgHex: string): "#000000" | "#ffffff" {
  const rgb = hexToRgb(bgHex)
  if (!rgb) return "#ffffff"
  return relativeLuminance(rgb) > 0.5 ? "#000000" : "#ffffff"
}
