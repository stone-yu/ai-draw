import type { ValidationResult } from './index'

/**
 * Sanitize an SVG string by stripping dangerous constructs.
 * - Removes <script> elements
 * - Removes on* event attributes
 * - Neutralizes javascript: URLs in href / xlink:href
 *
 * Returns the cleaned SVG. If the input does not contain a usable <svg> root,
 * returns the input unchanged so validateHtmlSvg can flag it.
 */
export function sanitizeSvg(svg: string): string {
  let cleaned = svg

  // Remove <script>...</script> (including newlines) and self-closing <script />.
  cleaned = cleaned.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '')
  cleaned = cleaned.replace(/<script\b[^>]*\/>/gi, '')

  // Remove on* event handler attributes (onclick, onload, onmouseover, ...).
  // Matches both quoted and unquoted values.
  cleaned = cleaned.replace(/\s+on[a-zA-Z]+\s*=\s*"[^"]*"/g, '')
  cleaned = cleaned.replace(/\s+on[a-zA-Z]+\s*=\s*'[^']*'/g, '')
  cleaned = cleaned.replace(/\s+on[a-zA-Z]+\s*=\s*(?![\s/])[^\s>]+/g, '')

  // Neutralize javascript: in href / xlink:href attributes.
  cleaned = cleaned.replace(
    /(href|xlink:href)\s*=\s*"(\s*javascript:[^"]*)"/gi,
    '$1="#"',
  )
  cleaned = cleaned.replace(
    /(href|xlink:href)\s*=\s*'(\s*javascript:[^']*)'/gi,
    "$1='#'",
  )

  return cleaned
}

/**
 * Validate that the content is a usable SVG document.
 * Accepts a leading `<?xml ...?>` declaration but requires a top-level <svg>.
 */
export function validateHtmlSvg(svg: string): ValidationResult {
  const trimmed = svg.trim()
  if (!trimmed) {
    return { valid: false, error: 'Empty SVG content' }
  }

  // Strip optional XML prolog before checking root element.
  const withoutProlog = trimmed.replace(/^<\?xml[^?]*\?>\s*/i, '')

  if (!/^<svg\b/i.test(withoutProlog)) {
    return { valid: false, error: 'Content does not start with <svg>' }
  }

  if (!/<\/svg\s*>\s*$/i.test(withoutProlog)) {
    return { valid: false, error: 'Content is missing closing </svg>' }
  }

  // DOMParser in 'image/svg+xml' mode is strict (rejects HTML-style unclosed
  // tags, names starting with digits, etc.). The browser's SVG renderer is much
  // more forgiving — and our content goes through a sandboxed iframe anyway —
  // so a parse failure is a warning, not a hard rejection. The user can still
  // see the rendered result and fix anything obviously broken in the Monaco
  // editor.
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(withoutProlog, 'image/svg+xml')
    const parserError = doc.querySelector('parsererror')
    if (parserError) {
      console.warn('[validateHtmlSvg] non-fatal SVG parse warning:', parserError.textContent)
    }
  } catch (err) {
    console.warn('[validateHtmlSvg] DOMParser threw, accepting content anyway:', err)
  }

  return { valid: true }
}
