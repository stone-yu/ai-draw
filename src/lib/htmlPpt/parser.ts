export interface ParsedSlide {
  /** Stable index assigned at parse time. */
  index: number
  /** Outer HTML of <section class="slide">…</section>, sanitized upstream. */
  html: string
  /** Optional title for tab labelling. */
  title?: string
}

export interface ParseResult {
  slides: ParsedSlide[]
  /** Comment line like "<!-- audience:engineers theme:tokyo-night -->" if present. */
  headerComment: string | null
  /** True if DOMParser failed or no <section class="slide"> found. */
  fallback: boolean
}

const SLIDE_SELECTOR = 'section.slide'

export function parsePptHtml(html: string): ParseResult {
  const headerMatch = html.match(/^\s*(<!--[^]*?-->)/)
  const headerComment = headerMatch ? headerMatch[1].trim() : null

  try {
    const parser = new DOMParser()
    const wrapped = `<!doctype html><html><body>${html}</body></html>`
    const doc = parser.parseFromString(wrapped, 'text/html')
    const nodes = Array.from(doc.querySelectorAll(SLIDE_SELECTOR))
    if (nodes.length === 0) {
      return { slides: [], headerComment, fallback: true }
    }
    const slides: ParsedSlide[] = nodes.map((el, i) => ({
      index: i,
      html: el.outerHTML,
      title:
        el.getAttribute('data-slide-title') ||
        el.querySelector('h1, h2, h3')?.textContent?.trim() ||
        undefined,
    }))
    return { slides, headerComment, fallback: false }
  } catch (err) {
    console.warn('[parsePptHtml] DOMParser threw:', err)
    return { slides: [], headerComment, fallback: true }
  }
}

export function joinSlides(headerComment: string | null, slides: ParsedSlide[]): string {
  const sorted = [...slides].sort((a, b) => a.index - b.index)
  const body = sorted.map((s) => s.html).join('\n')
  return headerComment ? `${headerComment}\n${body}` : body
}

export function replaceSlide(html: string, index: number, newSlideOuterHtml: string): string {
  const parsed = parsePptHtml(html)
  if (parsed.fallback) return html
  const replaced = parsed.slides.map((s) => (s.index === index ? { ...s, html: newSlideOuterHtml } : s))
  return joinSlides(parsed.headerComment, replaced)
}
