import type { HtmlStyleVariant } from '@/types'

interface StyleSpec {
  name: string
  background: string
  text: string
  accent: string
  fontFamily: string
  guidance: string
}

const STYLE_SPECS: Record<HtmlStyleVariant, StyleSpec> = {
  'dark-tech': {
    name: 'Dark Tech',
    background: '#020617 (slate-950) with a 40px grid pattern',
    text: '#e2e8f0',
    accent: 'semantic accents: cyan frontend, emerald backend, violet database, amber cloud, rose security',
    fontFamily: "'JetBrains Mono', monospace",
    guidance:
      'Use monospace labels, rounded rectangles (rx="6"), 1.5px strokes, semi-transparent fills, subtle glow on key nodes.',
  },
  'flat-icon': {
    name: 'Flat Icon',
    background: 'white #ffffff, no pattern',
    text: '#0f172a',
    accent: 'soft palette: #2563eb, #16a34a, #f59e0b, #7c3aed',
    fontFamily: "'Inter', sans-serif",
    guidance:
      'Use clean flat shapes, 1px borders, generous whitespace, no shadows. Suitable for blog posts and documentation.',
  },
  blueprint: {
    name: 'Blueprint',
    background: '#0a1628 with cyan grid lines',
    text: '#bfdbfe',
    accent: '#60a5fa primary, #93c5fd secondary, #fde68a highlight',
    fontFamily: "'Inter', sans-serif",
    guidance:
      'Use thin cyan strokes (#60a5fa), no fills (transparent), uppercase labels with letter-spacing, technical schematic feel.',
  },
  'claude-official': {
    name: 'Claude Official',
    background: 'warm cream #f8f6f3',
    text: '#1f1d1a',
    accent: '#cc785c primary (claude orange), neutrals',
    fontFamily: "'Inter', sans-serif",
    guidance:
      'Use rounded cards with subtle borders, warm neutral palette, friendly and editorial tone.',
  },
}

const BASE = `你是一名专业的可视化工程师，负责根据用户的自然语言描述生成一张高质量的 SVG 架构图 / 技术图。

## 输出契约（强约束）
- 只输出**一段** \`<svg ...> ... </svg>\` 片段，不要任何其它文字、注释、Markdown 围栏。
- 禁止输出 \`\`\`svg / \`\`\`xml / \`\`\`html 等代码块标记。
- 禁止输出 \`<html>\`、\`<head>\`、\`<body>\` 等 HTML 外壳标签，外壳由前端统一注入。
- 禁止使用 \`<script>\`、\`on*=\` 事件、\`javascript:\` 链接。
- 必须设置 \`viewBox\` 属性，宽高比建议 16:9 或 4:3，宽度参考值 1100。
- 字体使用下面"风格规范"指定的字体族；颜色全部使用指定的色板。

## 布局准则
- 自顶向下或自左向右组织信息层级；同层节点对齐。
- 节点之间留出足够间距，避免线条交叉。
- 用箭头/连线表达依赖、调用、数据流；箭头方向必须有语义。
- 关键节点可加图标占位（用矩形 + 单字母代替图标），不引用外部图片。

## 可访问性
- 在 \`<svg>\` 第一个子元素位置加 \`<title>\` 元素，写图表主题。
`

export function buildHtmlSystemPrompt(variant: HtmlStyleVariant): string {
  const spec = STYLE_SPECS[variant]
  return `${BASE}

## 风格规范：${spec.name}
- 背景：${spec.background}（前端外壳负责，SVG 内部使用 \`transparent\` 或与外壳一致的色）。
- 文本颜色：${spec.text}
- 字体：${spec.fontFamily}
- 配色：${spec.accent}
- 视觉指引：${spec.guidance}
`
}
