import type { ValidationResult } from './index'
import { SKILL_CDN_BASE } from '@/lib/skillThemes'

const SKILL_LINK_PREFIX = SKILL_CDN_BASE // 'https://cdn.jsdelivr.net/gh/stone-yu/ai-draw-skill@main/assets'

/**
 * Sanitize an HTML fragment from AI.
 *
 * Allowed:
 *   - Any presentational tags (article, section, div, span, h1..h6, p, ul, ol, li, table, ...)
 *   - <style>...</style> blocks (inline CSS only — no @import http)
 *   - <link rel="stylesheet" href="..."> only when href starts with the skill CDN base
 *
 * Removed:
 *   - <script>, <iframe>, <object>, <embed>
 *   - on* event attributes
 *   - javascript: URLs
 *   - <link> to anywhere outside the skill CDN
 *   - @import statements in <style> that point outside the skill CDN
 */
export function sanitizeHtml(html: string): string {
  let cleaned = html

  cleaned = cleaned.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '')
  cleaned = cleaned.replace(/<script\b[^>]*\/>/gi, '')
  cleaned = cleaned.replace(/<iframe\b[\s\S]*?<\/iframe\s*>/gi, '')
  cleaned = cleaned.replace(/<iframe\b[^>]*\/>/gi, '')
  cleaned = cleaned.replace(/<object\b[\s\S]*?<\/object\s*>/gi, '')
  cleaned = cleaned.replace(/<embed\b[^>]*\/?>/gi, '')

  cleaned = cleaned.replace(/\s+on[a-zA-Z]+\s*=\s*"[^"]*"/g, '')
  cleaned = cleaned.replace(/\s+on[a-zA-Z]+\s*=\s*'[^']*'/g, '')
  cleaned = cleaned.replace(/\s+on[a-zA-Z]+\s*=\s*(?![\s/])[^\s>]+/g, '')

  cleaned = cleaned.replace(/(href|src|xlink:href)\s*=\s*"(\s*javascript:[^"]*)"/gi, '$1="#"')
  cleaned = cleaned.replace(/(href|src|xlink:href)\s*=\s*'(\s*javascript:[^']*)'/gi, "$1='#'")

  // Strip <link> tags whose href is outside the skill CDN.
  cleaned = cleaned.replace(/<link\b[^>]*>/gi, (tag) => {
    const hrefMatch = tag.match(/href\s*=\s*["']([^"']+)["']/i)
    if (!hrefMatch) return ''
    return hrefMatch[1].startsWith(SKILL_LINK_PREFIX) ? tag : ''
  })

  // Strip @import inside <style> if pointing outside skill CDN.
  cleaned = cleaned.replace(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi, (full, body) => {
    const cleanedBody = body.replace(/@import\s+(?:url\()?\s*["']?([^"')]+)["']?\)?\s*;?/gi, (imp: string, url: string) =>
      url.startsWith(SKILL_LINK_PREFIX) ? imp : ''
    )
    return full.replace(body, cleanedBody)
  })

  return cleaned
}

/**
 * Validate the HTML fragment is non-empty and has at least one element-looking
 * thing. We do not attempt to parse fully — the browser's HTML parser inside
 * the sandboxed iframe is far more lenient than DOMParser.
 */
export function validateHtmlContent(html: string): ValidationResult {
  const trimmed = html.trim()
  if (!trimmed) {
    return { valid: false, error: 'Empty HTML content' }
  }
  if (!/<[a-zA-Z]/.test(trimmed)) {
    return { valid: false, error: 'No HTML tags found' }
  }
  return { valid: true }
}

// Backwards-compat re-exports for code that still imports the old names.
// The body is identical to sanitizeHtml / validateHtmlContent for the SVG
// case because an SVG fragment is just a special HTML fragment.
export const sanitizeSvg = sanitizeHtml
export const validateHtmlSvg = validateHtmlContent
