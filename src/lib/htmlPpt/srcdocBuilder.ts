import { findPptTheme, SKILL_CDN_BASE_CSS } from '@/lib/skillThemes'
import { escapeHtml } from '@/lib/htmlShells'

const COMMON_STYLE = `
html, body { margin: 0; padding: 0; height: 100%; background: var(--bg, #111); color: var(--text-1, #eee); }
body { overflow: hidden; font-family: var(--font-body, system-ui, sans-serif); }
.deck { width: 100vw; height: 100vh; position: relative; }
.deck > section.slide {
  position: absolute; inset: 0;
  display: flex; flex-direction: column; justify-content: center; align-items: stretch;
  padding: 6vh 8vw; box-sizing: border-box; overflow: auto;
}
.deck > section.slide { opacity: 0; pointer-events: none; transition: opacity 200ms ease-in-out; }
body[data-active-index] > .deck > section.slide { opacity: 0; pointer-events: none; }
body[data-active-index="0"] > .deck > section.slide:nth-of-type(1) { opacity: 1; pointer-events: auto; }
body[data-active-index="1"] > .deck > section.slide:nth-of-type(2) { opacity: 1; pointer-events: auto; }
body[data-active-index="2"] > .deck > section.slide:nth-of-type(3) { opacity: 1; pointer-events: auto; }
body[data-active-index="3"] > .deck > section.slide:nth-of-type(4) { opacity: 1; pointer-events: auto; }
body[data-active-index="4"] > .deck > section.slide:nth-of-type(5) { opacity: 1; pointer-events: auto; }
body[data-active-index="5"] > .deck > section.slide:nth-of-type(6) { opacity: 1; pointer-events: auto; }
body[data-active-index="6"] > .deck > section.slide:nth-of-type(7) { opacity: 1; pointer-events: auto; }
body[data-active-index="7"] > .deck > section.slide:nth-of-type(8) { opacity: 1; pointer-events: auto; }
body[data-active-index="8"] > .deck > section.slide:nth-of-type(9) { opacity: 1; pointer-events: auto; }
body[data-active-index="9"] > .deck > section.slide:nth-of-type(10) { opacity: 1; pointer-events: auto; }
body[data-active-index="10"] > .deck > section.slide:nth-of-type(11) { opacity: 1; pointer-events: auto; }
body[data-active-index="11"] > .deck > section.slide:nth-of-type(12) { opacity: 1; pointer-events: auto; }
body[data-active-index="12"] > .deck > section.slide:nth-of-type(13) { opacity: 1; pointer-events: auto; }
body[data-active-index="13"] > .deck > section.slide:nth-of-type(14) { opacity: 1; pointer-events: auto; }
body[data-active-index="14"] > .deck > section.slide:nth-of-type(15) { opacity: 1; pointer-events: auto; }
body[data-active-index="15"] > .deck > section.slide:nth-of-type(16) { opacity: 1; pointer-events: auto; }
body[data-active-index="16"] > .deck > section.slide:nth-of-type(17) { opacity: 1; pointer-events: auto; }
body[data-active-index="17"] > .deck > section.slide:nth-of-type(18) { opacity: 1; pointer-events: auto; }
body[data-active-index="18"] > .deck > section.slide:nth-of-type(19) { opacity: 1; pointer-events: auto; }
body[data-active-index="19"] > .deck > section.slide:nth-of-type(20) { opacity: 1; pointer-events: auto; }
`

interface BuildOpts {
  themeId: string
  /** Already-sanitized HTML body containing one or more <section class="slide"> */
  body: string
  title: string
  /** 0-based initial active slide index */
  activeIndex?: number
  /** Include a small inline JS that wires keyboard navigation. Used only by exporter / new-window preview. */
  includeNavScript?: boolean
}

export function buildPptSrcDoc(opts: BuildOpts): string {
  const theme = findPptTheme(opts.themeId)
  const themeCss = theme ? `<link rel="stylesheet" href="${theme.cdnPath}" />` : ''
  const safeTitle = escapeHtml(opts.title || 'Deck')
  const idx = Math.max(0, opts.activeIndex ?? 0)
  const navScript = opts.includeNavScript
    ? `<script>(function(){var b=document.body;function go(d){var n=b.querySelectorAll('.deck > section.slide').length;var i=parseInt(b.dataset.activeIndex||'0',10)+d;if(i<0)i=0;if(i>=n)i=n-1;b.dataset.activeIndex=String(i);}document.addEventListener('keydown',function(e){if(e.key==='ArrowRight'||e.key===' '){e.preventDefault();go(1);}else if(e.key==='ArrowLeft'){e.preventDefault();go(-1);}});})();</script>`
    : ''

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${safeTitle}</title>
<link rel="stylesheet" href="${SKILL_CDN_BASE_CSS}" />
${themeCss}
<style>${COMMON_STYLE}</style>
</head>
<body data-active-index="${idx}" data-theme="${theme?.id ?? ''}">
<main class="deck">
${opts.body}
</main>
${navScript}
</body>
</html>`
}
