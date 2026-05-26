export type DiagramThemeFamily = 'tech' | 'business' | 'minimalist' | 'colorful'

export type DiagramType =
  | 'architecture'
  | 'knowledge-graph'
  | 'flowchart'
  | 'sequence'
  | 'mindmap'
  | 'class'
  | 'er'

export interface DiagramTheme {
  id: string
  name: string
  family: DiagramThemeFamily
  cdnPath: string
  description: string
  recommendedTypes: DiagramType[]
}

const CDN_BASE = 'https://cdn.jsdelivr.net/gh/stone-yu/ai-draw-skill@main/assets'

export const SKILL_CDN_BASE = CDN_BASE
export const SKILL_CDN_BASE_CSS = `${CDN_BASE}/base.css`

export const DIAGRAM_THEMES: DiagramTheme[] = [
  {
    id: 'tech-dark',
    name: 'Tech Dark',
    family: 'tech',
    cdnPath: `${CDN_BASE}/themes-diagram/tech-dark.css`,
    description: '暗色技术风，slate-950 + 青/紫/翠语义色，JetBrains Mono',
    recommendedTypes: ['architecture', 'flowchart', 'sequence', 'knowledge-graph', 'mindmap', 'class', 'er'],
  },
  {
    id: 'blueprint',
    name: 'Blueprint',
    family: 'tech',
    cdnPath: `${CDN_BASE}/themes-diagram/blueprint.css`,
    description: '蓝图工程风，深蓝 + 白色细线 + 密网格',
    recommendedTypes: ['architecture', 'flowchart', 'class', 'er'],
  },
  {
    id: 'business-clean',
    name: 'Business Clean',
    family: 'business',
    cdnPath: `${CDN_BASE}/themes-diagram/business-clean.css`,
    description: '商务正式，米白 + 沉稳蓝/绿，Inter',
    recommendedTypes: ['architecture', 'flowchart', 'sequence', 'mindmap', 'class', 'er'],
  },
  {
    id: 'xhs-soft',
    name: 'XHS Soft',
    family: 'colorful',
    cdnPath: `${CDN_BASE}/themes-diagram/xhs-soft.css`,
    description: '小红书柔色卡片，奶白 + 粉橙 + 大圆角',
    recommendedTypes: ['flowchart', 'mindmap'],
  },
  {
    id: 'cyberpunk-neon',
    name: 'Cyberpunk Neon',
    family: 'colorful',
    cdnPath: `${CDN_BASE}/themes-diagram/cyberpunk-neon.css`,
    description: '赛博朋克霓虹，纯黑 + 品红/青/黄发光',
    recommendedTypes: ['architecture', 'knowledge-graph', 'flowchart', 'sequence'],
  },
  {
    id: 'minimal-light',
    name: 'Minimal Light',
    family: 'minimalist',
    cdnPath: `${CDN_BASE}/themes-diagram/minimal-light.css`,
    description: '极简白纸，纯白 + 黑线，无强调色无阴影',
    recommendedTypes: ['architecture', 'flowchart', 'sequence', 'mindmap', 'class', 'er'],
  },
  {
    id: 'academic-paper',
    name: 'Academic Paper',
    family: 'minimalist',
    cdnPath: `${CDN_BASE}/themes-diagram/academic-paper.css`,
    description: '学术论文，象牙白 + Source Serif + 灰线条',
    recommendedTypes: ['architecture', 'class', 'er'],
  },
  {
    id: 'hand-drawn',
    name: 'Hand Drawn',
    family: 'colorful',
    cdnPath: `${CDN_BASE}/themes-diagram/hand-drawn.css`,
    description: '手绘草图，米黄 + Caveat + rough.js 抖动笔触',
    recommendedTypes: ['mindmap', 'flowchart'],
  },
  {
    id: 'saas-modern',
    name: 'SaaS Modern',
    family: 'business',
    cdnPath: `${CDN_BASE}/themes-diagram/saas-modern.css`,
    description: '现代 SaaS 产品页，浅色 + 蓝紫橙渐变 accent + 大圆角',
    recommendedTypes: ['architecture', 'flowchart'],
  },
  {
    id: 'glassmorphism',
    name: 'Glassmorphism',
    family: 'colorful',
    cdnPath: `${CDN_BASE}/themes-diagram/glassmorphism.css`,
    description: 'Apple 毛玻璃，紫粉橙径向渐变 + 半透明卡片',
    recommendedTypes: ['architecture', 'mindmap'],
  },
  {
    id: 'linear-mode',
    name: 'Linear Mode',
    family: 'tech',
    cdnPath: `${CDN_BASE}/themes-diagram/linear-mode.css`,
    description: 'Linear app 风，近黑底 + 电光靛蓝 accent + Inter',
    recommendedTypes: ['architecture', 'flowchart', 'sequence', 'class'],
  },
  {
    id: 'neo-brutalism',
    name: 'Neo Brutalism',
    family: 'colorful',
    cdnPath: `${CDN_BASE}/themes-diagram/neo-brutalism.css`,
    description: '厚黑描边 + 硬偏移阴影 + 三原色 + Archivo Black',
    recommendedTypes: ['flowchart'],
  },
]

export const DEFAULT_DIAGRAM_THEME = 'tech-dark'

export function findDiagramTheme(id: string): DiagramTheme | undefined {
  return DIAGRAM_THEMES.find((t) => t.id === id)
}
