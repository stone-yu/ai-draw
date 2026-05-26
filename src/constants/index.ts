import { Database, DiamondPercent, FolderOpen, GitBranch, Home, LayoutDashboard, Network, Settings } from 'lucide-react'
import type { EngineType } from '@/types'
import { DIAGRAM_THEMES, PPT_AUDIENCES, PPT_THEMES } from '@/lib/skillThemes'

export const ENGINES: { value: EngineType; label: string; description: string }[] = [
  { value: 'mermaid',    label: 'Mermaid',    description: '基于文本的图表生成，适合快速绘制结构化图表' },
  { value: 'excalidraw', label: 'Excalidraw', description: '手绘风格白板工具，自由绘制，界面简洁直观' },
  { value: 'drawio',     label: 'Draw.io',    description: '专业级图表编辑器，功能丰富，适合复杂技术文档' },
  { value: 'html',       label: 'HTML 图',    description: 'AI 生成 HTML 架构 / 技术图，12 种主题 × 7 种类型，由 AI 自动选 type' },
  { value: 'html-ppt',   label: 'HTML PPT',   description: 'AI 生成多页演讲稿，36 主题 × 6 受众场景' },
]

// 12 diagram themes for engineType === 'html' (UI helpers)
export const HTML_DIAGRAM_THEMES = DIAGRAM_THEMES
export const PPT_AUDIENCES_LIST = PPT_AUDIENCES
export const HTML_PPT_THEMES = PPT_THEMES

export const NAV_ITEMS = [
  { icon: Home, label: '系统首页', path: '/' },
  { icon: FolderOpen, label: '文件管理', path: '/projects' },
  { icon: Settings, label: '个人设置', path: '/profile' },
  { icon: LayoutDashboard, label: '管理后台', path: '/admin', adminOnly: true },
]

export const QUICK_ACTION_ROWS = [
  [
    { label: '业务流程图', icon: GitBranch, engine: 'drawio' as EngineType, prompt: { zh: '创建一个用户登录流程图，使用动画线条', en: 'Create a user login flowchart with animated lines' }, image: '' },
    { label: '系统架构图', icon: Network,  engine: 'drawio' as EngineType, prompt: { zh: '绘制一个商品系统架构图', en: 'Draw a product system architecture diagram' }, image: '' },
    { label: '数据库ER图', icon: Database, engine: 'drawio' as EngineType, prompt: { zh: '绘制一个配送系统ER图', en: 'Draw a delivery system ER diagram' }, image: '' },
  ],
  [
    { label: '复刻流程图', icon: DiamondPercent, engine: 'mermaid' as EngineType, prompt: { zh: '复刻这个流程图', en: 'Replicate this flowchart' }, image: '/quick-start-example-1.png' },
    { label: '复刻流程图', icon: DiamondPercent, engine: 'mermaid' as EngineType, prompt: { zh: '修改此图为mermaid风格', en: 'Convert this diagram to mermaid style' }, image: '/quick-start-example-1.png' },
    { label: '复刻流程图', icon: DiamondPercent, engine: 'mermaid' as EngineType, prompt: { zh: '修改此图为手绘风格', en: 'Convert this diagram to hand-drawn style' }, image: '/quick-start-example-1.png' },
  ],
  [
    { label: '任意图形',  icon: DiamondPercent, engine: 'mermaid' as EngineType, prompt: { zh: '画一只猫在敲代码', en: 'Draw a cat coding' }, image: '' },
    { label: '任意图形',  icon: DiamondPercent, engine: 'mermaid' as EngineType, prompt: { zh: '画一个IDE终端', en: 'Draw an IDE terminal' }, image: '' },
    { label: '思维导图',  icon: DiamondPercent, engine: 'mermaid' as EngineType, prompt: { zh: '绘制一个思维导图', en: 'Create a mind map' }, image: '' },
  ],
]

export const QUICK_ACTIONS = QUICK_ACTION_ROWS.flat()

/**
 * @deprecated Removed in Task 9. Kept for one task's worth of compile time
 * so CreateProjectDialog.tsx and HomePage.tsx can still import the name
 * while their bodies are rewritten in Task 9.
 */
export const HTML_STYLES = DIAGRAM_THEMES.slice(0, 4).map((t) => ({
  value: t.id,
  label: t.name,
  description: t.description,
}))
