import type { PptAudience } from './ppt-themes'

export type SlideSlot =
  | 'cover' | 'agenda' | 'problem' | 'solution' | 'demo' | 'how-it-works'
  | 'metrics' | 'roadmap' | 'team' | 'cta' | 'chapter' | 'compare'
  | 'timeline' | 'qna' | 'closing' | 'quote' | 'data' | 'feature-grid'

export interface PptDeckTemplate {
  id: string
  name: string
  audience: PptAudience
  sectionStructure: SlideSlot[]
  description: string
}

export const PPT_DECKS: PptDeckTemplate[] = [
  { id: 'tech-sharing',       name: '技术分享',     audience: 'engineers', sectionStructure: ['cover', 'agenda', 'problem', 'solution', 'how-it-works', 'demo', 'metrics', 'closing'], description: '40 分钟分享会标准模板' },
  { id: 'engineering-review', name: '工程评审',     audience: 'engineers', sectionStructure: ['cover', 'agenda', 'problem', 'solution', 'compare', 'metrics', 'roadmap', 'qna'],      description: '工程方案评审 / RFC' },
  { id: 'tech-deep-dive',     name: '技术深度',     audience: 'engineers', sectionStructure: ['cover', 'chapter', 'how-it-works', 'demo', 'metrics', 'chapter', 'how-it-works', 'demo', 'closing'], description: '90 分钟技术内训' },
  { id: 'exec-quarterly',     name: '季度汇报',     audience: 'execs',     sectionStructure: ['cover', 'metrics', 'data', 'roadmap', 'cta'],                                          description: '高管季度回顾' },
  { id: 'board-meeting',      name: '董事会',       audience: 'execs',     sectionStructure: ['cover', 'agenda', 'metrics', 'data', 'roadmap', 'problem', 'solution', 'cta'],         description: '董事会汇报' },
  { id: 'xhs-card',           name: '小红书图文',   audience: 'xhs',       sectionStructure: ['cover', 'feature-grid', 'feature-grid', 'quote', 'cta'],                                description: '5-9 页小红书图文' },
  { id: 'product-launch',     name: '产品发布',     audience: 'xhs',       sectionStructure: ['cover', 'problem', 'solution', 'feature-grid', 'demo', 'cta'],                          description: '面向消费者的产品发布' },
  { id: 'workshop',           name: '工作坊',       audience: 'students',  sectionStructure: ['cover', 'agenda', 'chapter', 'how-it-works', 'demo', 'chapter', 'how-it-works', 'demo', 'qna'], description: '半日工作坊 / 课件' },
  { id: 'academic-paper',     name: '论文答辩',     audience: 'students',  sectionStructure: ['cover', 'agenda', 'problem', 'solution', 'how-it-works', 'data', 'metrics', 'qna'],     description: '学术答辩' },
  { id: 'pitch-seed',         name: '种子轮路演',   audience: 'vc',        sectionStructure: ['cover', 'problem', 'solution', 'demo', 'metrics', 'team', 'roadmap', 'cta'],            description: '种子 / 天使路演' },
  { id: 'pitch-series-a',     name: 'A 轮路演',     audience: 'vc',        sectionStructure: ['cover', 'problem', 'solution', 'metrics', 'data', 'compare', 'team', 'roadmap', 'cta'], description: 'Series A 路演' },
  { id: 'demo-day',           name: 'Demo Day',     audience: 'vc',        sectionStructure: ['cover', 'problem', 'solution', 'demo', 'metrics', 'cta'],                              description: '加速器 Demo Day' },
  { id: 'weekly-report',      name: '周报',         audience: 'internal',  sectionStructure: ['cover', 'metrics', 'data', 'roadmap'],                                                 description: '团队周报 / OKR 复盘' },
  { id: 'okr-review',         name: 'OKR 复盘',     audience: 'internal',  sectionStructure: ['cover', 'agenda', 'metrics', 'compare', 'roadmap', 'cta'],                              description: '季度 OKR 复盘' },
  { id: 'all-hands',          name: '全员大会',     audience: 'internal',  sectionStructure: ['cover', 'agenda', 'metrics', 'roadmap', 'chapter', 'feature-grid', 'closing'],          description: 'All-hands 全员对齐' },
]

export function decksForAudience(audience: PptAudience): PptDeckTemplate[] {
  return PPT_DECKS.filter((d) => d.audience === audience)
}

export function recommendDeck(audience: PptAudience): PptDeckTemplate {
  const list = decksForAudience(audience)
  return list[0]
}
