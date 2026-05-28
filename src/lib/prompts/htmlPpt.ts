import {
  DEFAULT_PPT_THEME,
  decksForAudience,
  findPptTheme,
  PPT_THEMES,
  recommendDeck,
  type PptAudience,
} from '@/lib/skillThemes'

const AUDIENCE_TONE: Record<PptAudience, string> = {
  engineers: '面向工程师 / 技术分享：可以放代码片段、内部接口名、性能指标；语气理性偏冷，避免过度营销。',
  execs:     '面向高管 / 董事会：每页一个结论 + 一个关键数字；避免技术细节；强调商业影响 / ROI / 风险。',
  xhs:       '面向小红书 / 社交媒体：短句、情绪化标题、视觉冲击；每页 ≤ 80 字；多用大字 + emoji 占位。',
  students:  '面向学术 / 教学：有清晰章节；每个概念给定义 + 例子 + 反例；图示优先。',
  vc:        '面向投资人 / 路演：5–10 页讲清 problem / solution / market / metrics / team / ask；不堆术语。',
  internal:  '面向内部团队：周报 / OKR 风格；要有指标对比、风险项、下一步。',
}

export function buildHtmlPptSystemPrompt(audience: PptAudience, themeId?: string): string {
  const finalTheme = themeId && findPptTheme(themeId) ? themeId : DEFAULT_PPT_THEME[audience]
  const theme = findPptTheme(finalTheme)!
  const deck = recommendDeck(audience)
  const otherDecks = decksForAudience(audience).slice(1, 3)

  const themeList = PPT_THEMES.filter((t) => t.audienceTags.includes(audience))
    .map((t) => `- ${t.id}：${t.description}`)
    .join('\n')

  return `你是一名专业的演讲稿设计师。按 ai-draw-skill v0.3 PPT 规范，把用户描述拆成一份多页 HTML 演讲稿。

## 受众
${AUDIENCE_TONE[audience]}

## 主题：${theme.name}（${theme.id}）
${theme.description}

## 输出契约（强约束）
1) 第一行必须是注释：<!-- audience:${audience} theme:${theme.id} -->
2) 后面是 N 个 \`<section class="slide">...</section>\`（5 ≤ N ≤ 15），同级排列。
3) 不要 \`<html>\` / \`<head>\` / \`<body>\` 外壳；外壳由前端注入。
4) **禁止 \`<script>\`**、on* 事件、javascript: URL；动画请用纯 CSS。
5) 每张 slide 推荐加属性：data-slide-index="<0-based>" data-slide-title="<短标题>"。
6) 每张 slide 内容 ≤ 200 字；多用列表 / 卡片 / 大字标题；密集表格控制在 5 行内。
7) 主题 CSS 提供了 .slide / .cover / .chapter / .feature-grid / .quote / .metric 等 class，请优先复用；不确定时可加局部 \`<style>\`。
8) 不要输出 \`<think>\` / 推理块 / Markdown 围栏。

## 推荐 deck 模板（${deck.name}）
按这个 section 顺序铺：${deck.sectionStructure.join(' → ')}
${otherDecks.length ? `备选模板：${otherDecks.map((d) => d.name).join(' / ')}` : ''}

## 同 audience 可选主题（用户已锁 ${theme.id}，不要换）
${themeList}
`
}
