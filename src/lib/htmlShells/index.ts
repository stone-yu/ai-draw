import { findDiagramTheme, normalizeHtmlTheme, SKILL_CDN_BASE_CSS } from '@/lib/skillThemes'

/**
 * Escape a string for safe insertion into HTML text content.
 * The title comes from user input; HTML body comes from sanitized AI output.
 */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Build srcdoc HTML for the html engine (single-diagram).
 * Theme can be either a new skill theme id or a legacy variant — both
 * get normalized via normalizeHtmlTheme.
 */
export function buildHtmlSrcDoc(themeId: string, body: string, title: string): string {
  const normalized = normalizeHtmlTheme(themeId)
  const theme = findDiagramTheme(normalized)!
  const safeTitle = escapeHtml(title || 'Diagram')

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${safeTitle}</title>
<link rel="stylesheet" href="${SKILL_CDN_BASE_CSS}" />
<link rel="stylesheet" href="${theme.cdnPath}" />
<style>
  html, body { margin: 0; padding: 0; min-height: 100%; }
  body { display: flex; align-items: center; justify-content: center; padding: 24px; box-sizing: border-box; }
  .ai-draw-canvas { width: 100%; max-width: 1400px; }
</style>
</head>
<body data-theme="${theme.id}">
<div class="ai-draw-canvas">${body}</div>
</body>
</html>`
}

/**
 * @deprecated — keep until Task 5 rewrites HtmlRenderer to use buildHtmlSrcDoc directly.
 * In v1 this took 4 distinct shell functions; now it routes everything through the
 * single skill-CDN shell. Theme id passes through normalizeHtmlTheme.
 */
export function buildSrcDoc(variant: string, svg: string, title: string): string {
  return buildHtmlSrcDoc(variant, svg, title)
}
