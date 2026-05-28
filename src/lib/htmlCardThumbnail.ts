import {
  findDiagramTheme,
  findPptTheme,
  normalizeHtmlTheme,
  type DiagramThemeFamily,
  type PptAudience,
} from '@/lib/skillThemes'

interface Palette {
  from: string
  to: string
  text: string
  sub: string
  badge: string
  badgeText: string
}

const HTML_PALETTES: Record<DiagramThemeFamily, Palette> = {
  tech:       { from: '#0f172a', to: '#1e1b4b', text: '#e2e8f0', sub: 'rgba(226,232,240,0.65)', badge: 'rgba(255,255,255,0.18)', badgeText: '#ffffff' },
  business:   { from: '#1e3a8a', to: '#0891b2', text: '#ffffff', sub: 'rgba(255,255,255,0.75)', badge: 'rgba(255,255,255,0.20)', badgeText: '#ffffff' },
  minimalist: { from: '#f8fafc', to: '#e2e8f0', text: '#0f172a', sub: 'rgba(15,23,42,0.6)',     badge: 'rgba(15,23,42,0.08)',   badgeText: '#0f172a' },
  colorful:   { from: '#7c3aed', to: '#ec4899', text: '#ffffff', sub: 'rgba(255,255,255,0.85)', badge: 'rgba(255,255,255,0.22)', badgeText: '#ffffff' },
}

const PPT_AUDIENCE_PALETTES: Record<PptAudience, Palette> = {
  engineers: HTML_PALETTES.tech,
  execs:     HTML_PALETTES.business,
  xhs:       { from: '#fb923c', to: '#ec4899', text: '#ffffff', sub: 'rgba(255,255,255,0.85)', badge: 'rgba(255,255,255,0.22)', badgeText: '#ffffff' },
  students:  HTML_PALETTES.minimalist,
  vc:        { from: '#1d4ed8', to: '#7c3aed', text: '#ffffff', sub: 'rgba(255,255,255,0.80)', badge: 'rgba(255,255,255,0.20)', badgeText: '#ffffff' },
  internal:  { from: '#475569', to: '#0f172a', text: '#e2e8f0', sub: 'rgba(226,232,240,0.65)', badge: 'rgba(255,255,255,0.18)', badgeText: '#ffffff' },
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
}

/**
 * Pull the first meaningful heading out of AI HTML output for the card title.
 */
function extractTitle(content: string, fallback: string): string {
  if (!content) return fallback
  const m = content.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)
    ?? content.match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/i)
    ?? content.match(/data-slide-title\s*=\s*["']([^"']+)["']/i)
  if (!m) return fallback
  const text = stripTags(m[1])
  return text || fallback
}

/**
 * Break a single line of text into 1-2 wrapped lines for the card center.
 * Naive char-count-based wrap — adequate for short titles.
 */
function wrap(text: string, perLine = 14, maxLines = 2): string[] {
  if (text.length <= perLine) return [text]
  const lines: string[] = []
  let cursor = 0
  while (cursor < text.length && lines.length < maxLines) {
    let end = Math.min(cursor + perLine, text.length)
    // try to break at a space if we're not at the end
    if (end < text.length) {
      const space = text.lastIndexOf(' ', end)
      if (space > cursor) end = space
    }
    lines.push(text.slice(cursor, end).trim())
    cursor = end
    while (text[cursor] === ' ') cursor++
  }
  if (cursor < text.length && lines.length === maxLines) {
    lines[maxLines - 1] = lines[maxLines - 1].replace(/.{1,3}$/, '…')
  }
  return lines
}

interface CardOpts {
  engineType: 'html' | 'html-ppt'
  styleVariant?: string
  pptAudience?: PptAudience
}

/**
 * Generate a stylized SVG card as a thumbnail for html / html-ppt projects.
 * Returns a base64-encoded `data:image/svg+xml` URL so it can be assigned
 * directly to `<img src>` and stored in IndexedDB.
 */
export function generateHtmlCardThumbnail(content: string, opts: CardOpts): string {
  const { engineType, styleVariant, pptAudience } = opts
  const isPpt = engineType === 'html-ppt'

  let palette: Palette
  let themeLabel: string
  if (isPpt) {
    const audience: PptAudience = pptAudience ?? 'engineers'
    palette = PPT_AUDIENCE_PALETTES[audience]
    const theme = styleVariant ? findPptTheme(styleVariant) : undefined
    themeLabel = theme?.id ?? styleVariant ?? audience
  } else {
    const themeId = normalizeHtmlTheme(styleVariant)
    const theme = findDiagramTheme(themeId)
    palette = theme ? HTML_PALETTES[theme.family] : HTML_PALETTES.tech
    themeLabel = theme?.id ?? themeId
  }

  const title = extractTitle(content, isPpt ? 'AI Deck' : 'AI Diagram')
  const lines = wrap(title, 14, 2)
  const lineHeight = 32
  const startY = 250 / 2 - ((lines.length - 1) * lineHeight) / 2 + 8

  const badgeLabel = isPpt ? 'HTML-PPT' : 'HTML'
  const badgeWidth = isPpt ? 78 : 54

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 250" width="400" height="250">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${palette.from}"/>
      <stop offset="100%" stop-color="${palette.to}"/>
    </linearGradient>
  </defs>
  <rect width="400" height="250" fill="url(#bg)"/>
  <text x="20" y="32" font-family="-apple-system,Segoe UI,sans-serif" font-size="12" fill="${palette.sub}">${escapeXml(themeLabel)}</text>
  <rect x="${400 - 20 - badgeWidth}" y="18" width="${badgeWidth}" height="22" rx="11" fill="${palette.badge}"/>
  <text x="${400 - 20 - badgeWidth / 2}" y="33" font-family="-apple-system,Segoe UI,sans-serif" font-size="11" font-weight="600" text-anchor="middle" fill="${palette.badgeText}">${badgeLabel}</text>
  ${lines.map((line, i) => `<text x="200" y="${startY + i * lineHeight}" font-family="-apple-system,Segoe UI,sans-serif" font-size="24" font-weight="700" text-anchor="middle" fill="${palette.text}">${escapeXml(line)}</text>`).join('\n  ')}
  <text x="380" y="234" font-family="-apple-system,Segoe UI,sans-serif" font-size="10" text-anchor="end" fill="${palette.sub}">AI Draw</text>
</svg>`

  const encoded = btoa(unescape(encodeURIComponent(svg)))
  return `data:image/svg+xml;base64,${encoded}`
}
