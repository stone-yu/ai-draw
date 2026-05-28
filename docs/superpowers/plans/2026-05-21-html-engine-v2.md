# HTML Engine v2 + HTML PPT Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the existing `html` engine from a 4-handwritten-shell pipeline to the ai-draw-skill v0.3 architecture (12 diagram themes × 7 diagram types via CDN CSS), and add a new `html-ppt` engine for multi-slide presentations (36 PPT themes × 6 audiences).

**Architecture:**
- AI now emits a complete HTML fragment (not just SVG) that uses skill theme CSS classes. The frontend wraps it in a sandboxed iframe with a `<link>` to the right jsdelivr-hosted theme CSS file.
- `html-ppt` produces one HTML deck containing many `<section class="slide">` elements. The iframe runs without scripts; parent React controls pagination by mutating `iframe.contentDocument.body.dataset.activeIndex` and a CSS attribute-selector hides non-active slides. "New window preview" opens a separate window that *does* include a small inline navigation script so it works offline.
- Legacy `styleVariant` values (`dark-tech`/`flat-icon`/`blueprint`/`claude-official`) keep working via a runtime mapping table — no Dexie migration.

**Tech Stack:** React 19 + TypeScript + Vite + Dexie 4 (v2 schema, no bump) + Zustand + Monaco. CDN: `cdn.jsdelivr.net/gh/stone-yu/ai-draw-skill@main/assets/`. No new npm deps. Verification: `pnpm run build` + `pnpm run lint` + manual browser smoke (no unit test framework in this repo).

**Source spec:** `docs/superpowers/specs/2026-05-21-html-engine-v2-design.md`

---

## File Structure

**New files:**
- `src/lib/skillThemes/diagram-themes.ts` — 12 diagram theme const + DiagramTheme interface
- `src/lib/skillThemes/ppt-themes.ts` — 36 PPT theme const + PptTheme interface
- `src/lib/skillThemes/ppt-decks.ts` — 15 deck templates (id + audience + section structure)
- `src/lib/skillThemes/legacy-mapping.ts` — old 4 → new 12 mapping + normalize helper
- `src/lib/skillThemes/index.ts` — barrel exports
- `src/lib/htmlPpt/parser.ts` — DOMParser-based slide splitter / joiner
- `src/lib/htmlPpt/srcdocBuilder.ts` — iframe srcdoc for ppt (no scripts) + standalone exporter (with nav script)
- `src/lib/prompts/htmlPpt.ts` — buildHtmlPptSystemPrompt
- `src/features/engines/html-ppt/HtmlPptRenderer.tsx` — iframe + nav + export
- `src/features/engines/html-ppt/SlideNav.tsx` — bottom navigation bar
- `src/features/engines/html-ppt/MultiSlideEditor.tsx` — Monaco tabs per slide
- `src/components/layout/PptAudienceDialog.tsx` — 2-step (audience → theme) picker

**Heavily modified files:**
- `src/types/index.ts` — `EngineType` + `+ 'html-ppt'`, `Project.styleVariant` broaden to `string`, add `pptAudience`, deprecate-but-keep `HtmlStyleVariant`
- `src/constants/index.ts` — add html-ppt to ENGINES, replace HTML_STYLES content
- `src/lib/htmlShells/index.ts` — collapse to a single `buildHtmlSrcDoc(theme, htmlFragment, title)`
- `src/lib/validators/html.ts` — replace `sanitizeSvg` with `sanitizeHtml` + CDN whitelist
- `src/lib/prompts/html.ts` — rewrite for skill 12-theme architecture and AI-picks-type
- `src/lib/promptBuilder.ts` — add html-ppt resolver, extend PromptCtx with `pptAudience`/`theme`
- `src/lib/thumbnail.ts` — html/html-ppt thumbnail (use placeholder, no SVG conversion)
- `src/services/projectRepository.ts` — default styleVariant and pptAudience for new projects
- `src/features/engines/html/HtmlRenderer.tsx` — sanitize as HTML, edit HTML in Monaco, export HTML
- `src/features/editor/CanvasArea.tsx` — wire html-ppt engine
- `src/stores/editorStore.ts` — broaden `selectStyleVariant` return type, add `selectPptAudience`
- `src/components/layout/CreateProjectDialog.tsx` — 12-theme cards grouped by family + 2-stage PPT picker
- `src/components/layout/ImportProjectDialog.tsx` — exclude `html-ppt` from importable engines
- `src/pages/HomePage.tsx` — replace 4-style picker with 12-theme picker; add ppt 2-stage dialog
- `src/pages/EditorPage.tsx` — show "新窗口预览" + "导出 HTML" for html-ppt
- `src/hooks/useAIGenerate.ts` — pass pptAudience to PromptCtx, sanitize as HTML, drop SVG-specific paths

**Files to delete (move logic into the new single shell):**
- `src/lib/htmlShells/darkTech.ts`
- `src/lib/htmlShells/flatIcon.ts`
- `src/lib/htmlShells/blueprint.ts`
- `src/lib/htmlShells/claudeOfficial.ts`

---

## Task 1: Skill Theme Metadata + Legacy Mapping

**Files:**
- Create: `src/lib/skillThemes/diagram-themes.ts`
- Create: `src/lib/skillThemes/ppt-themes.ts`
- Create: `src/lib/skillThemes/ppt-decks.ts`
- Create: `src/lib/skillThemes/legacy-mapping.ts`
- Create: `src/lib/skillThemes/index.ts`

This task is data-only; it does not affect runtime yet. It establishes the constants that later tasks consume.

- [ ] **Step 1: Create `diagram-themes.ts` with 12 themes**

Create `src/lib/skillThemes/diagram-themes.ts`:

```ts
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
```

- [ ] **Step 2: Create `ppt-themes.ts` with 36 themes**

Create `src/lib/skillThemes/ppt-themes.ts`:

```ts
import { SKILL_CDN_BASE } from './diagram-themes'

export type PptAudience = 'engineers' | 'execs' | 'xhs' | 'students' | 'vc' | 'internal'

export interface PptTheme {
  id: string
  name: string
  audienceTags: PptAudience[]
  cdnPath: string
  description: string
}

const T = (id: string, name: string, audienceTags: PptAudience[], description: string): PptTheme => ({
  id,
  name,
  audienceTags,
  cdnPath: `${SKILL_CDN_BASE}/themes-ppt/${id}.css`,
  description,
})

export const PPT_THEMES: PptTheme[] = [
  // 商务 / 投资人 / 路演
  T('pitch-deck-vc',    'Pitch Deck VC',    ['vc', 'execs'],          'YC 风白底 + 蓝紫渐变 + 大留白，融资路演首选'),
  T('corporate-clean',  'Corporate Clean',  ['execs', 'internal'],    '纯白 + 海军蓝 + Inter，董事会 / B2B'),
  T('swiss-grid',       'Swiss Grid',       ['execs', 'internal'],    '瑞士网格 + Helvetica 感，严肃排版'),
  T('editorial-serif',  'Editorial Serif',  ['execs', 'xhs'],         '杂志风 Playfair 衬线 + 奶油底'),
  T('minimal-white',    'Minimal White',    ['internal', 'execs', 'students'], '极简白，Inter，极低阴影'),

  // 技术 / 工程 / 分享
  T('tokyo-night',      'Tokyo Night',      ['engineers'],            'Tokyo Night 蓝夜，偏冷技术分享'),
  T('dracula',          'Dracula',          ['engineers'],            '经典 Dracula 紫红，代码密集分享'),
  T('catppuccin-mocha', 'Catppuccin Mocha', ['engineers'],            'catppuccin 深色，长时间观看友好'),
  T('catppuccin-latte', 'Catppuccin Latte', ['engineers'],            'catppuccin 浅色，开发者极客友好'),
  T('terminal-green',   'Terminal Green',   ['engineers'],            '绿屏终端 + 等宽 + 发光文字'),
  T('blueprint-ppt',    'Blueprint',        ['engineers'],            '蓝图工程 + 网格底纹 + 蒙太奇字体'),
  T('nord',             'Nord',             ['engineers'],            '北欧清冷蓝白'),
  T('gruvbox-dark',     'Gruvbox Dark',     ['engineers'],            '温暖复古深色，*nix / Terminal'),
  T('solarized-light',  'Solarized Light',  ['engineers', 'students'],'经典低眩光配色，工作坊 / 教学'),
  T('rose-pine',        'Rose Pine',        ['engineers', 'xhs'],     '玫瑰松柔和暗色，设计+开发交界'),

  // 小红书 / 卡片 / 营销
  T('xiaohongshu-white','XHS White',        ['xhs'],                  '小红书白底 + 暖红 accent + 衬线标题'),
  T('soft-pastel',      'Soft Pastel',      ['xhs', 'students'],      '柔和马卡龙三色渐变'),
  T('magazine-bold',    'Magazine Bold',    ['xhs', 'execs'],         '奶油底 + 超大 Playfair + 橙色 spot'),
  T('rainbow-gradient', 'Rainbow Gradient', ['xhs'],                  '白底 + 彩虹流动渐变 accent'),
  T('aurora',           'Aurora',           ['xhs', 'vc'],            '极光渐变 + blur + saturate'),
  T('sunset-warm',      'Sunset Warm',      ['xhs'],                  '橘 / 珊瑚 / 琥珀三色渐变'),
  T('arctic-cool',      'Arctic Cool',      ['execs', 'internal'],    '蓝 / 青 / 石板灰浅色版'),

  // 学术 / 报告 / 论文
  T('academic-paper-ppt', 'Academic Paper', ['students', 'internal'], '论文白 + 衬线正文 + 黑墨 + 蓝链接'),
  T('engineering-whiteprint', 'Engineering Whiteprint', ['engineers', 'students'], '白底 + 坐标纸网格 + 海军墨线'),
  T('news-broadcast',   'News Broadcast',   ['execs', 'internal'],    '白底 + 红色竖条 + Oswald 大写'),

  // 赛博 / 强烈 / 发布会
  T('cyberpunk-neon-ppt','Cyberpunk Neon',  ['engineers', 'vc'],      '纯黑 + 霓虹粉青黄 + 发光'),
  T('vaporwave',        'Vaporwave',        ['xhs'],                  '深紫 + 粉红青蓝渐变 + 晕染光斑'),
  T('y2k-chrome',       'Y2K Chrome',       ['xhs'],                  '银铬渐变 + 彩虹 accent + 大圆角'),
  T('neo-brutalism-ppt','Neo Brutalism',    ['vc', 'engineers'],      '厚描边 + 硬阴影 + 明黄 accent'),
  T('retro-tv',         'Retro TV',         ['xhs'],                  '暖奶油 + CRT 扫描线 + 琥珀橙'),

  // 极简 / 克制
  T('japanese-minimal', 'Japanese Minimal', ['execs', 'internal'],    '象牙白 + 朱红 accent + 极大留白'),
  T('sharp-mono',       'Sharp Mono',       ['vc', 'execs'],          '纯黑白 + Archivo Black + 硬阴影'),

  // 设计师 / 创意
  T('bauhaus',          'Bauhaus',          ['xhs', 'students'],      '几何 + 红黄蓝原色'),
  T('memphis-pop',      'Memphis Pop',      ['xhs'],                  '孟菲斯波普背景点 + 大字标题'),
  T('midcentury',       'Midcentury',       ['xhs'],                  '奶油底 + 芥末/青/焦橙 + 锐利几何'),
  T('glassmorphism-ppt','Glassmorphism',    ['execs', 'vc'],          '毛玻璃 + 多色光斑背景'),
]

export const DEFAULT_PPT_THEME: Record<PptAudience, string> = {
  engineers: 'tokyo-night',
  execs:     'corporate-clean',
  xhs:       'xiaohongshu-white',
  students:  'academic-paper-ppt',
  vc:        'pitch-deck-vc',
  internal:  'minimal-white',
}

export const PPT_AUDIENCES: { id: PptAudience; label: string; description: string }[] = [
  { id: 'engineers', label: '技术分享',    description: '工程师 / 内部技术分享 / Tech talk' },
  { id: 'execs',     label: '高管汇报',    description: '董事会 / 高管 / 季度业务回顾' },
  { id: 'xhs',       label: '小红书',      description: '社交媒体卡片 / 营销 / 生活方式' },
  { id: 'students',  label: '学术 / 教学', description: '论文 / 课件 / 工作坊' },
  { id: 'vc',        label: '投资人路演',  description: 'Pitch / 融资 / 创业大赛' },
  { id: 'internal',  label: '内部汇报',    description: '周报 / OKR / 团队对齐' },
]

export function findPptTheme(id: string): PptTheme | undefined {
  return PPT_THEMES.find((t) => t.id === id)
}

export function pptThemesForAudience(audience: PptAudience): PptTheme[] {
  return PPT_THEMES.filter((t) => t.audienceTags.includes(audience))
}
```

- [ ] **Step 3: Create `ppt-decks.ts` (deck templates)**

Create `src/lib/skillThemes/ppt-decks.ts`:

```ts
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
```

- [ ] **Step 4: Create `legacy-mapping.ts`**

Create `src/lib/skillThemes/legacy-mapping.ts`:

```ts
import { DEFAULT_DIAGRAM_THEME, findDiagramTheme } from './diagram-themes'

export const LEGACY_HTML_THEME_MAP: Record<string, string> = {
  'dark-tech':       'tech-dark',
  'flat-icon':       'saas-modern',
  'blueprint':       'blueprint',
  'claude-official': 'xhs-soft',
}

export function normalizeHtmlTheme(value: string | undefined | null): string {
  if (!value) return DEFAULT_DIAGRAM_THEME
  const mapped = LEGACY_HTML_THEME_MAP[value] ?? value
  return findDiagramTheme(mapped) ? mapped : DEFAULT_DIAGRAM_THEME
}
```

- [ ] **Step 5: Create barrel `index.ts`**

Create `src/lib/skillThemes/index.ts`:

```ts
export * from './diagram-themes'
export * from './ppt-themes'
export * from './ppt-decks'
export * from './legacy-mapping'
```

- [ ] **Step 6: Verify TS compiles**

Run: `pnpm run build`
Expected: build succeeds. No runtime callers yet, so no behavior change.

- [ ] **Step 7: Commit**

```bash
git add src/lib/skillThemes/
git commit -m "feat(skill-themes): add 12 diagram + 36 PPT theme metadata + legacy mapping"
```

---

## Task 2: Types and Store Widening

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/stores/editorStore.ts`

- [ ] **Step 1: Broaden `EngineType` and `Project` shape**

Edit `src/types/index.ts`. Replace lines 1–30 with:

```ts
import type { PptAudience } from '@/lib/skillThemes'

// Engine Types
export type EngineType = 'mermaid' | 'excalidraw' | 'drawio' | 'html' | 'html-ppt'

/**
 * HTML / HTML-PPT theme id. Now a free-form string because we accept
 * skill v0.3's 12 diagram themes + 36 ppt themes plus the 4 legacy
 * values (mapped at render time via normalizeHtmlTheme).
 *
 * Kept as a string union alias for grep-ability; do NOT add new
 * enum members here.
 */
export type HtmlStyleVariant = string

// Group
export interface Group {
  id: string
  name: string
  createdAt: Date
  updatedAt: Date
  projectCount?: number
}

// Project
export interface Project {
  id: string
  title: string
  engineType: EngineType
  /** html: 12 themes (or legacy 4); html-ppt: 36 themes */
  styleVariant?: string
  /** Only set for engineType === 'html-ppt' */
  pptAudience?: PptAudience
  thumbnail: string
  groupId?: string
  createdAt: Date
  updatedAt: Date
}
```

- [ ] **Step 2: Widen editor store selectors**

Edit `src/stores/editorStore.ts`. Replace the imports and the two selector helpers at the bottom (lines 1–2 and 82–89) with:

```ts
// at the top of the file, replace the import line
import { create } from 'zustand'
import type { Project, EngineType } from '@/types'
import type { PptAudience } from '@/lib/skillThemes'
```

```ts
// at the bottom, replace selectStyleVariant and add selectPptAudience
export const selectEngineType = (state: EditorState): EngineType | null =>
  state.currentProject?.engineType ?? null

export const selectIsEmpty = (state: EditorState): boolean =>
  !state.currentContent || state.currentContent.trim() === ''

export const selectStyleVariant = (state: EditorState): string | null =>
  state.currentProject?.styleVariant ?? null

export const selectPptAudience = (state: EditorState): PptAudience | null =>
  state.currentProject?.pptAudience ?? null
```

(The local `HtmlStyleVariant` import is no longer needed in this file; remove it.)

- [ ] **Step 3: Verify TS compiles**

Run: `pnpm run build`
Expected: build succeeds. Existing code using `HtmlStyleVariant` keeps compiling because the alias is now `string`. CanvasArea's `styleVariant ?? 'dark-tech'` fallback still works (it's a `string ?? string`).

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts src/stores/editorStore.ts
git commit -m "feat(types): add 'html-ppt' EngineType + broaden styleVariant + add pptAudience"
```

---

## Task 3: Sanitizer + Single Shell Builder

Now rewrite the HTML shell pipeline. The old 4 hand-written shells go away; a single generic `buildHtmlSrcDoc(themeId, htmlFragment, title)` replaces them. The sanitizer is extended to handle arbitrary HTML (not just SVG) with a CDN `<link>` whitelist.

**Files:**
- Modify: `src/lib/validators/html.ts`
- Modify: `src/lib/htmlShells/index.ts`
- Delete: `src/lib/htmlShells/{darkTech,flatIcon,blueprint,claudeOfficial}.ts`

- [ ] **Step 1: Replace `src/lib/validators/html.ts`**

Overwrite the file with:

```ts
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
```

- [ ] **Step 2: Replace `src/lib/htmlShells/index.ts` with single generic shell**

Overwrite the file with:

```ts
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
```

- [ ] **Step 3: Delete the 4 legacy shell files**

Run:
```bash
rm src/lib/htmlShells/darkTech.ts src/lib/htmlShells/flatIcon.ts src/lib/htmlShells/blueprint.ts src/lib/htmlShells/claudeOfficial.ts
```

- [ ] **Step 4: Verify TS compiles**

Run: `pnpm run build`
Expected: TS will complain in callers that import `buildSrcDoc` from `@/lib/htmlShells` (HtmlRenderer). That's fixed in Task 5. Skip the build for now.

Actually run `pnpm run lint` instead — lint will surface unused imports but no compile errors yet because nothing else has been changed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/validators/html.ts src/lib/htmlShells/
git commit -m "refactor(html): single shell builder + HTML-aware sanitizer with CDN whitelist"
```

---

## Task 4: HTML Engine Prompt Rewrite

The v1 prompt told AI "output an SVG fragment". The v2 prompt tells AI to:
- pick a `diagramType` based on the user's request
- emit a complete HTML fragment (article + nested elements)
- use the skill theme's CSS classes
- prepend a comment with `type:<diagramType> theme:<themeId>`

**Files:**
- Modify: `src/lib/prompts/html.ts`

- [ ] **Step 1: Overwrite `src/lib/prompts/html.ts`**

```ts
import { findDiagramTheme, normalizeHtmlTheme } from '@/lib/skillThemes'

export function buildHtmlSystemPrompt(themeId: string): string {
  const normalized = normalizeHtmlTheme(themeId)
  const theme = findDiagramTheme(normalized)!

  return `你是一名专业的可视化工程师，按 ai-draw-skill v0.3 规范，把用户的自然语言描述渲染成一份精致的 HTML 图。

## 输出契约（强约束）

1) 第一行必须是注释，**严格按这个格式**（无空格变体）：
   <!-- type:<diagram-type> theme:${theme.id} -->
   其中 <diagram-type> 你自己在以下 7 个里挑一个最合适的：
   - architecture（系统架构 / 部署 / 微服务 / 三层）
   - knowledge-graph（关系网 / 引用网 / 概念图）
   - flowchart（流程 / 工作流 / 步骤）
   - sequence（时序 / 调用链 / 谁调谁）
   - mindmap（思维导图 / 大纲）
   - class（类图 / OO / 继承）
   - er（实体关系 / 数据库表）

2) 第二部分是 HTML 片段：
   - 不要 \`<html>\` / \`<head>\` / \`<body>\` 外壳，外壳由前端注入；
   - 不要 \`<script>\` / on* 事件 / javascript: 链接；
   - 不要 \`<link rel="stylesheet">\`，主题 CSS 由前端注入；
   - 只允许内联 \`<style>\`（用于局部覆盖）；
   - 整段用 \`<article class="diagram <diagram-type>-diagram">...</article>\` 作为外层容器。

3) 优先复用主题 CSS 提供的 class（如 \`.node\` / \`.edge\` / \`.layer\` / \`.legend\` / \`.kg\` / \`.mindmap-root\`）。不确定时可以创建语义化 class，并在内联 \`<style>\` 里给它定义颜色 / 边框等。

4) 数值（坐标 / 宽高 / 角度）必须用真实数字，不要写占位字面量（如 \`x="x"\`）。

5) 禁止输出 \`<think>\` / 推理块 / 任何 Markdown 围栏。直接给注释行 + HTML 片段。

## 主题：${theme.name}
- 主题 id：${theme.id}
- 风格说明：${theme.description}
- 推荐图类型：${theme.recommendedTypes.join(' / ')}

## 布局准则
- 自顶向下或自左向右组织信息层级；同层节点对齐；线条尽量不交叉。
- 关键节点可加图标占位（用 emoji 或单字母代替图标），不引用外部图片。
- 在 \`<article>\` 的第一个子元素位置加 \`<h1>\` 写标题；如有需要紧跟一个 \`<p class="subtitle">\`。
- 复杂关系（sequence / class / er / knowledge-graph）允许用嵌入的内联 \`<svg viewBox=...>\`，所有 SVG 数值必须是真实数字。
`
}
```

- [ ] **Step 2: Verify TS compiles**

Run: `pnpm run lint`
Expected: lint passes for this file. `pnpm run build` still fails elsewhere — that's expected.

- [ ] **Step 3: Commit**

```bash
git add src/lib/prompts/html.ts
git commit -m "feat(prompt): rewrite html prompt for skill 12 themes + AI-picks-type + HTML output"
```

---

## Task 5: HtmlRenderer v2 (HTML output, not SVG)

The renderer now treats `currentContent` as a sanitized HTML fragment. Monaco edits HTML. Exports include "Copy HTML", "Download HTML", "Download PNG (screenshot)".

**Files:**
- Modify: `src/features/engines/html/HtmlRenderer.tsx`

- [ ] **Step 1: Rewrite `src/features/engines/html/HtmlRenderer.tsx`**

Overwrite the file with:

```tsx
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import Editor from '@monaco-editor/react'
import { Check, Copy, Play, Undo2, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/Tooltip'
import { cn } from '@/lib/utils'
import { buildHtmlSrcDoc } from '@/lib/htmlShells'
import { sanitizeHtml } from '@/lib/validators/html'

interface HtmlRendererProps {
  /** Sanitized HTML fragment (AI output). */
  html: string
  styleVariant: string
  title: string
  onChange?: (html: string) => void
  className?: string
}

export interface HtmlRendererRef {
  exportAsSvg: () => void   // alias for HTML download (keeps menu wiring stable)
  exportAsPng: () => void
  exportAsSource: () => void
  showSourceCode: () => void
  hideSourceCode: () => void
  toggleSourceCode: () => void
  openInNewWindow: () => void
}

const PLACEHOLDER = '<!-- type:architecture theme:tech-dark -->\n<article class="diagram"><h1>等待 AI 生成…</h1></article>'

export const HtmlRenderer = forwardRef<HtmlRendererRef, HtmlRendererProps>(
  function HtmlRenderer({ html, styleVariant, title, onChange, className }, ref) {
    const [showCodePanel, setShowCodePanel] = useState(false)
    const [copied, setCopied] = useState(false)
    const [editedCode, setEditedCode] = useState(html)
    const [hasChanges, setHasChanges] = useState(false)
    const iframeRef = useRef<HTMLIFrameElement | null>(null)

    useEffect(() => {
      setEditedCode(html)
      setHasChanges(false)
    }, [html])

    const srcDoc = useMemo(() => {
      const body = sanitizeHtml(html || PLACEHOLDER)
      return buildHtmlSrcDoc(styleVariant, body, title)
    }, [html, styleVariant, title])

    const downloadBlob = useCallback((data: string, mime: string, filename: string) => {
      const blob = new Blob([data], { type: mime })
      const href = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = href
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      setTimeout(() => URL.revokeObjectURL(href), 100)
    }, [])

    const exportAsHtml = useCallback(() => {
      if (!srcDoc) return
      downloadBlob(srcDoc, 'text/html;charset=utf-8', `diagram-${Date.now()}.html`)
    }, [srcDoc, downloadBlob])

    const exportAsSource = useCallback(() => {
      if (!html) return
      downloadBlob(html, 'text/html;charset=utf-8', `diagram-source-${Date.now()}.html`)
    }, [html, downloadBlob])

    // PNG export: screenshot the iframe contents via html-to-image-like approach
    // is complex. For v2 we render the standalone HTML in a hidden iframe and
    // use canvas drawImage on a foreignObject SVG. Skipping for now — fall
    // through to "open in new window" guidance instead.
    const exportAsPng = useCallback(async () => {
      console.warn('[HtmlRenderer] PNG export not implemented for v2 — use new-window preview + browser screenshot')
      exportAsHtml()
    }, [exportAsHtml])

    const openInNewWindow = useCallback(() => {
      const blob = new Blob([srcDoc], { type: 'text/html;charset=utf-8' })
      const href = URL.createObjectURL(blob)
      const win = window.open(href, '_blank')
      if (!win) console.warn('[HtmlRenderer] Popup blocked; preview URL:', href)
      setTimeout(() => URL.revokeObjectURL(href), 60_000)
    }, [srcDoc])

    useImperativeHandle(
      ref,
      () => ({
        exportAsSvg: exportAsHtml,
        exportAsPng,
        exportAsSource,
        showSourceCode: () => setShowCodePanel(true),
        hideSourceCode: () => setShowCodePanel(false),
        toggleSourceCode: () => setShowCodePanel((p) => !p),
        openInNewWindow,
      }),
      [exportAsHtml, exportAsPng, exportAsSource, openInNewWindow],
    )

    const handleCopyCode = useCallback(async () => {
      try {
        await navigator.clipboard.writeText(editedCode)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch (err) {
        console.error('Failed to copy code:', err)
      }
    }, [editedCode])

    const handleCodeChange = useCallback(
      (value: string | undefined) => {
        const next = value || ''
        setEditedCode(next)
        setHasChanges(next !== html)
      },
      [html],
    )

    const handleApplyCode = useCallback(() => {
      if (editedCode.trim() && editedCode !== html && onChange) {
        onChange(editedCode)
        setHasChanges(false)
      }
    }, [editedCode, html, onChange])

    const handleResetCode = useCallback(() => {
      setEditedCode(html)
      setHasChanges(false)
    }, [html])

    return (
      <TooltipProvider>
        <div className={cn('relative h-full w-full', className)}>
          <iframe
            ref={iframeRef}
            title={`html-engine-${styleVariant}`}
            sandbox="allow-same-origin"
            srcDoc={srcDoc}
            className="h-full w-full border-0"
          />

          {showCodePanel && (
            <div className="absolute bottom-4 right-4 z-10 w-96 max-h-[70%] flex flex-col border border-border bg-surface shadow-lg">
              <div className="flex items-center justify-between border-b border-border px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">HTML 源码</span>
                  {hasChanges && <span className="text-xs text-amber-500">• 未保存</span>}
                </div>
                <div className="flex items-center gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCopyCode}
                        className="h-7 w-7 p-0"
                      >
                        {copied ? (
                          <Check className="h-3.5 w-3.5 text-green-500" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{copied ? '已复制' : '复制代码'}</TooltipContent>
                  </Tooltip>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowCodePanel(false)}
                    className="h-7 w-7 p-0"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="flex-1 min-h-0 overflow-hidden">
                <Editor
                  height="300px"
                  defaultLanguage="html"
                  value={editedCode}
                  onChange={handleCodeChange}
                  theme="vs"
                  options={{
                    minimap: { enabled: false },
                    fontSize: 13,
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    wordWrap: 'on',
                    automaticLayout: true,
                    tabSize: 2,
                    padding: { top: 8, bottom: 8 },
                    scrollbar: {
                      verticalScrollbarSize: 8,
                      horizontalScrollbarSize: 8,
                    },
                  }}
                />
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-border px-3 py-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleResetCode}
                      disabled={!hasChanges}
                      className="gap-1.5"
                    >
                      <Undo2 className="h-3.5 w-3.5" />
                      <span className="text-xs">重置</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>重置为原始代码</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleApplyCode}
                      disabled={!hasChanges || !editedCode.trim()}
                      className="gap-1.5"
                    >
                      <Play className="h-3.5 w-3.5" />
                      <span className="text-xs">应用</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>应用代码更改</TooltipContent>
                </Tooltip>
              </div>
            </div>
          )}
        </div>
      </TooltipProvider>
    )
  },
)
```

- [ ] **Step 2: Update CanvasArea to pass `html` prop name and broaden styleVariant typing**

Edit `src/features/editor/CanvasArea.tsx`. Find the `case 'html':` block in `renderEngine()` (around line 227) and replace with:

```tsx
case 'html':
  return (
    <HtmlRenderer
      ref={htmlRef}
      key={projectKey}
      html={currentContent}
      styleVariant={styleVariant ?? 'tech-dark'}
      title={currentProject?.title || ''}
      onChange={handleContentChange}
    />
  )
```

(The fallback string changes from `'dark-tech'` to `'tech-dark'` — both are accepted via `normalizeHtmlTheme`, but the new default reflects the new naming.)

- [ ] **Step 3: Verify build**

Run: `pnpm run build`
Expected: build now succeeds (validators re-export still provides legacy names).

- [ ] **Step 4: Manual smoke**

Run dev server: `pnpm run dev` and open `http://localhost:8787`.
1. Open an existing html project from the recent list (uses legacy `dark-tech` variant)
2. Confirm the diagram renders with the new `tech-dark` theme CSS (loaded from jsdelivr — check Network tab)
3. Click "源码" toggle, confirm Monaco shows the SVG content from the legacy project
4. Confirm "新窗口预览" still opens a working preview

Expected: existing legacy projects load with mapped theme. (They may look different from before — that's the cost of the upgrade and is documented in spec §11.)

- [ ] **Step 5: Commit**

```bash
git add src/features/engines/html/HtmlRenderer.tsx src/features/editor/CanvasArea.tsx
git commit -m "feat(html): rewrite HtmlRenderer for skill v0.3 (HTML output + CDN theme injection)"
```

---

## Task 6: PPT Engine — Parser, Builder, Renderer

Adds the new `html-ppt` engine end-to-end except for UI integration (Task 8).

**Files:**
- Create: `src/lib/htmlPpt/parser.ts`
- Create: `src/lib/htmlPpt/srcdocBuilder.ts`
- Create: `src/features/engines/html-ppt/HtmlPptRenderer.tsx`
- Create: `src/features/engines/html-ppt/SlideNav.tsx`
- Create: `src/features/engines/html-ppt/MultiSlideEditor.tsx`

- [ ] **Step 1: Create slide parser**

Create `src/lib/htmlPpt/parser.ts`:

```ts
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
```

- [ ] **Step 2: Create srcdoc builder (in-app, no script)**

Create `src/lib/htmlPpt/srcdocBuilder.ts`:

```ts
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
```

- [ ] **Step 3: Create `SlideNav.tsx`**

Create `src/features/engines/html-ppt/SlideNav.tsx`:

```tsx
import { ChevronLeft, ChevronRight, Download, Expand } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface SlideNavProps {
  current: number
  total: number
  onPrev: () => void
  onNext: () => void
  onExport: () => void
  onOpenInNewWindow: () => void
}

export function SlideNav({ current, total, onPrev, onNext, onExport, onOpenInNewWindow }: SlideNavProps) {
  return (
    <div className="pointer-events-auto absolute bottom-3 left-1/2 z-10 -translate-x-1/2 flex items-center gap-2 rounded-full border border-border bg-surface/90 px-3 py-1.5 shadow-md backdrop-blur-md">
      <Button variant="ghost" size="sm" onClick={onPrev} disabled={current <= 0} className="h-7 w-7 p-0">
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="min-w-[3.5rem] text-center text-xs font-medium tabular-nums">
        {total === 0 ? '0 / 0' : `${current + 1} / ${total}`}
      </span>
      <Button variant="ghost" size="sm" onClick={onNext} disabled={current >= total - 1} className="h-7 w-7 p-0">
        <ChevronRight className="h-4 w-4" />
      </Button>
      <div className="mx-1 h-4 w-px bg-border" />
      <Button variant="ghost" size="sm" onClick={onOpenInNewWindow} className="h-7 gap-1.5 px-2 text-xs">
        <Expand className="h-3.5 w-3.5" /> 全屏
      </Button>
      <Button variant="ghost" size="sm" onClick={onExport} className="h-7 gap-1.5 px-2 text-xs">
        <Download className="h-3.5 w-3.5" /> HTML
      </Button>
    </div>
  )
}
```

- [ ] **Step 4: Create `MultiSlideEditor.tsx`**

Create `src/features/engines/html-ppt/MultiSlideEditor.tsx`:

```tsx
import { useCallback, useMemo, useState } from 'react'
import Editor from '@monaco-editor/react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { joinSlides, parsePptHtml, type ParsedSlide } from '@/lib/htmlPpt/parser'

interface MultiSlideEditorProps {
  html: string
  onApply: (newHtml: string) => void
  onClose: () => void
}

export function MultiSlideEditor({ html, onApply, onClose }: MultiSlideEditorProps) {
  const parsed = useMemo(() => parsePptHtml(html), [html])
  const [draftSlides, setDraftSlides] = useState<ParsedSlide[]>(parsed.slides)
  const [draftRaw, setDraftRaw] = useState<string>(html)
  const [activeTab, setActiveTab] = useState<number>(0)

  const fallback = parsed.fallback

  const handleSlideChange = useCallback((value: string | undefined) => {
    const next = value || ''
    setDraftSlides((prev) => prev.map((s) => (s.index === activeTab ? { ...s, html: next } : s)))
  }, [activeTab])

  const handleApply = useCallback(() => {
    if (fallback) {
      onApply(draftRaw)
    } else {
      onApply(joinSlides(parsed.headerComment, draftSlides))
    }
  }, [fallback, draftRaw, draftSlides, parsed.headerComment, onApply])

  return (
    <div className="absolute bottom-4 right-4 z-10 w-[28rem] max-h-[70%] flex flex-col border border-border bg-surface shadow-lg">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-sm font-medium">HTML PPT 源码</span>
        <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0">
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {fallback && (
        <div className="border-b border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-700">
          无法按 slide 解析，已退回到整段 HTML 编辑。
        </div>
      )}

      {!fallback && (
        <div className="flex flex-wrap gap-1 border-b border-border px-2 py-2">
          {draftSlides.map((s) => (
            <button
              key={s.index}
              onClick={() => setActiveTab(s.index)}
              className={`rounded-md px-2 py-1 text-xs ${activeTab === s.index ? 'bg-primary text-surface' : 'bg-muted/40 hover:bg-muted'}`}
            >
              Slide {s.index + 1}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 min-h-0">
        <Editor
          height="320px"
          defaultLanguage="html"
          value={fallback ? draftRaw : draftSlides.find((s) => s.index === activeTab)?.html ?? ''}
          onChange={(v) => (fallback ? setDraftRaw(v || '') : handleSlideChange(v))}
          theme="vs"
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            automaticLayout: true,
            tabSize: 2,
          }}
        />
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-border px-3 py-2">
        <Button variant="ghost" size="sm" onClick={onClose} className="rounded-full">取消</Button>
        <Button size="sm" onClick={handleApply} className="rounded-full bg-primary text-surface">应用</Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Create `HtmlPptRenderer.tsx`**

Create `src/features/engines/html-ppt/HtmlPptRenderer.tsx`:

```tsx
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import { cn } from '@/lib/utils'
import { sanitizeHtml } from '@/lib/validators/html'
import { buildPptSrcDoc } from '@/lib/htmlPpt/srcdocBuilder'
import { parsePptHtml } from '@/lib/htmlPpt/parser'
import { SlideNav } from './SlideNav'
import { MultiSlideEditor } from './MultiSlideEditor'

interface HtmlPptRendererProps {
  html: string
  styleVariant: string
  title: string
  onChange?: (html: string) => void
  className?: string
}

export interface HtmlPptRendererRef {
  exportAsSvg: () => void   // alias: full HTML download
  exportAsPng: () => void   // not supported — falls through to HTML
  exportAsSource: () => void
  showSourceCode: () => void
  hideSourceCode: () => void
  toggleSourceCode: () => void
  openInNewWindow: () => void
}

const PLACEHOLDER = `<!-- audience:engineers theme:tokyo-night -->
<section class="slide" data-slide-title="封面"><h1>等待 AI 生成…</h1></section>`

export const HtmlPptRenderer = forwardRef<HtmlPptRendererRef, HtmlPptRendererProps>(
  function HtmlPptRenderer({ html, styleVariant, title, onChange, className }, ref) {
    const [showCodePanel, setShowCodePanel] = useState(false)
    const [activeIndex, setActiveIndex] = useState(0)
    const iframeRef = useRef<HTMLIFrameElement | null>(null)

    const sanitized = useMemo(() => sanitizeHtml(html || PLACEHOLDER), [html])
    const parsed = useMemo(() => parsePptHtml(sanitized), [sanitized])
    const total = parsed.slides.length

    const srcDoc = useMemo(
      () => buildPptSrcDoc({ themeId: styleVariant, body: sanitized, title, activeIndex: 0, includeNavScript: false }),
      [styleVariant, sanitized, title],
    )

    // Reset active index when project changes (i.e. sanitized html length jumps).
    useEffect(() => {
      setActiveIndex(0)
    }, [sanitized])

    // Sync active index into the iframe DOM. sandbox="allow-same-origin" makes
    // contentDocument.body reachable as long as srcDoc came from us (same-origin).
    useEffect(() => {
      const frame = iframeRef.current
      if (!frame) return
      const apply = () => {
        try {
          const doc = frame.contentDocument
          if (doc && doc.body) doc.body.dataset.activeIndex = String(activeIndex)
        } catch (err) {
          console.warn('[HtmlPptRenderer] cannot set active index:', err)
        }
      }
      apply()
      // Also re-apply on iframe load — first paint can finish after the effect runs.
      frame.addEventListener('load', apply, { once: true })
      return () => frame.removeEventListener('load', apply)
    }, [activeIndex, srcDoc])

    const goPrev = useCallback(() => setActiveIndex((i) => Math.max(0, i - 1)), [])
    const goNext = useCallback(() => setActiveIndex((i) => Math.min(total - 1, i + 1)), [total])

    // Keyboard navigation: capture arrow keys while the canvas has focus or is hovered.
    useEffect(() => {
      const handler = (e: KeyboardEvent) => {
        if (e.target instanceof HTMLElement) {
          const tag = e.target.tagName
          if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable) return
        }
        if (e.key === 'ArrowRight' || e.key === ' ') {
          e.preventDefault()
          goNext()
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault()
          goPrev()
        }
      }
      window.addEventListener('keydown', handler)
      return () => window.removeEventListener('keydown', handler)
    }, [goNext, goPrev])

    const downloadBlob = useCallback((data: string, mime: string, filename: string) => {
      const blob = new Blob([data], { type: mime })
      const href = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = href
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      setTimeout(() => URL.revokeObjectURL(href), 100)
    }, [])

    const exportAsHtml = useCallback(() => {
      // Exported deck gets its own nav script so it's usable offline.
      const standalone = buildPptSrcDoc({ themeId: styleVariant, body: sanitized, title, activeIndex: 0, includeNavScript: true })
      downloadBlob(standalone, 'text/html;charset=utf-8', `deck-${Date.now()}.html`)
    }, [styleVariant, sanitized, title, downloadBlob])

    const exportAsSource = useCallback(() => {
      if (!html) return
      downloadBlob(html, 'text/html;charset=utf-8', `deck-source-${Date.now()}.html`)
    }, [html, downloadBlob])

    const openInNewWindow = useCallback(() => {
      const standalone = buildPptSrcDoc({ themeId: styleVariant, body: sanitized, title, activeIndex, includeNavScript: true })
      const blob = new Blob([standalone], { type: 'text/html;charset=utf-8' })
      const href = URL.createObjectURL(blob)
      const win = window.open(href, '_blank')
      if (!win) console.warn('[HtmlPptRenderer] Popup blocked; preview URL:', href)
      setTimeout(() => URL.revokeObjectURL(href), 60_000)
    }, [styleVariant, sanitized, title, activeIndex])

    useImperativeHandle(
      ref,
      () => ({
        exportAsSvg: exportAsHtml,
        exportAsPng: exportAsHtml,
        exportAsSource,
        showSourceCode: () => setShowCodePanel(true),
        hideSourceCode: () => setShowCodePanel(false),
        toggleSourceCode: () => setShowCodePanel((p) => !p),
        openInNewWindow,
      }),
      [exportAsHtml, exportAsSource, openInNewWindow],
    )

    return (
      <div className={cn('relative h-full w-full', className)}>
        <iframe
          ref={iframeRef}
          title={`html-ppt-engine-${styleVariant}`}
          sandbox="allow-same-origin"
          srcDoc={srcDoc}
          className="h-full w-full border-0"
        />

        <SlideNav
          current={activeIndex}
          total={total}
          onPrev={goPrev}
          onNext={goNext}
          onExport={exportAsHtml}
          onOpenInNewWindow={openInNewWindow}
        />

        {showCodePanel && (
          <MultiSlideEditor
            html={html}
            onApply={(next) => {
              if (onChange) onChange(next)
              setShowCodePanel(false)
            }}
            onClose={() => setShowCodePanel(false)}
          />
        )}
      </div>
    )
  },
)
```

- [ ] **Step 6: Verify TS compiles**

Run: `pnpm run build`
Expected: build succeeds. No callers yet, so no runtime behavior change.

- [ ] **Step 7: Commit**

```bash
git add src/lib/htmlPpt/ src/features/engines/html-ppt/
git commit -m "feat(html-ppt): renderer + slide nav + multi-slide monaco editor + parser/builder"
```

---

## Task 7: PPT Prompt + PromptBuilder Wiring

**Files:**
- Create: `src/lib/prompts/htmlPpt.ts`
- Modify: `src/lib/prompts/index.ts`
- Modify: `src/lib/promptBuilder.ts`

- [ ] **Step 1: Create `src/lib/prompts/htmlPpt.ts`**

```ts
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
```

- [ ] **Step 2: Update `src/lib/prompts/index.ts`**

Replace with:

```ts
export { mermaidSystemPrompt } from './mermaid'
export { drawioSystemPrompt } from './drawio'
export { excalidrawSystemPrompt } from './excalidraw'
export { buildHtmlSystemPrompt } from './html'
export { buildHtmlPptSystemPrompt } from './htmlPpt'
```

- [ ] **Step 3: Update `src/lib/promptBuilder.ts`**

Replace the top of the file (imports + `PromptCtx` + `SYSTEM_PROMPTS` + `getSystemPrompt`) with:

```ts
import type { EngineType } from '@/types'
import type { PptAudience } from '@/lib/skillThemes'
import {
  drawioSystemPrompt,
  excalidrawSystemPrompt,
  mermaidSystemPrompt,
  buildHtmlSystemPrompt,
  buildHtmlPptSystemPrompt,
} from './prompts'

export interface PromptCtx {
  /** Diagram theme for `html`, ppt theme for `html-ppt`. */
  styleVariant?: string
  /** Only for `html-ppt`. */
  pptAudience?: PptAudience
}

type PromptEntry = string | ((ctx: PromptCtx) => string)

export const SYSTEM_PROMPTS: Record<EngineType, PromptEntry> = {
  mermaid: mermaidSystemPrompt,
  excalidraw: excalidrawSystemPrompt,
  drawio: drawioSystemPrompt,
  html: (ctx) => buildHtmlSystemPrompt(ctx.styleVariant ?? 'tech-dark'),
  'html-ppt': (ctx) => buildHtmlPptSystemPrompt(ctx.pptAudience ?? 'engineers', ctx.styleVariant),
}

export function getSystemPrompt(engineType: EngineType, ctx: PromptCtx = {}): string {
  const entry = SYSTEM_PROMPTS[engineType]
  return typeof entry === 'function' ? entry(ctx) : entry
}
```

Also update the `extractCode` block in the same file — html and html-ppt both want HTML extraction (find the outer `<article>` for html or the first `<!-- ... -->` + everything up to last `</section>` for html-ppt). Replace the `engineType === 'html'` block (around line 181–190) with:

```ts
  if (engineType === 'html') {
    // Prefer outer <article>; fall back to any <!-- type:... --> ... last closing tag.
    const articleMatch = code.match(/<article\b[\s\S]*<\/article\s*>/i)
    if (articleMatch) return articleMatch[0].trim()
    const headerIdx = code.indexOf('<!--')
    if (headerIdx >= 0) return code.slice(headerIdx).trim()
    const fenced = code.match(/```(?:html|xml|svg)?\n?([\s\S]*?)```/i)
    if (fenced) return fenced[1].trim()
    return code
  }

  if (engineType === 'html-ppt') {
    // Find <!-- audience:... --> header then everything ending at last </section>.
    const headerIdx = code.search(/<!--\s*audience:/i)
    const lastSectionClose = code.toLowerCase().lastIndexOf('</section>')
    if (lastSectionClose >= 0) {
      const start = headerIdx >= 0 ? headerIdx : code.search(/<section\b/i)
      if (start >= 0) return code.slice(start, lastSectionClose + '</section>'.length).trim()
    }
    const fenced = code.match(/```(?:html)?\n?([\s\S]*?)```/i)
    if (fenced) return fenced[1].trim()
    return code
  }
```

- [ ] **Step 4: Verify TS compiles**

Run: `pnpm run build`
Expected: succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/lib/prompts/ src/lib/promptBuilder.ts
git commit -m "feat(prompt): add html-ppt prompt builder + audience/theme PromptCtx wiring"
```

---

## Task 8: ProjectRepository / Constants / CanvasArea / useAIGenerate / Thumbnail

Wire the new engine into project creation, CanvasArea, AI generation, and thumbnail.

**Files:**
- Modify: `src/services/projectRepository.ts`
- Modify: `src/constants/index.ts`
- Modify: `src/features/editor/CanvasArea.tsx`
- Modify: `src/hooks/useAIGenerate.ts`
- Modify: `src/lib/thumbnail.ts`

- [ ] **Step 1: Update `src/services/projectRepository.ts`**

Replace the `create` body (lines 18–84). New signature accepts `pptAudience`, and defaults both fields for engines that need them:

```ts
  async create(data: {
    title: string
    engineType: EngineType
    styleVariant?: string
    pptAudience?: PptAudience
    thumbnail?: string
    groupId?: string
  }): Promise<Project> {
    const mode = useStorageModeStore.getState().mode
    const now = new Date()

    // Defaults: html → tech-dark; html-ppt → engineers / tokyo-night
    let styleVariant: string | undefined = data.styleVariant
    let pptAudience: PptAudience | undefined = data.pptAudience
    if (data.engineType === 'html') {
      styleVariant = styleVariant ?? 'tech-dark'
    } else if (data.engineType === 'html-ppt') {
      pptAudience = pptAudience ?? 'engineers'
      styleVariant = styleVariant ?? DEFAULT_PPT_THEME[pptAudience]
    } else {
      styleVariant = undefined
      pptAudience = undefined
    }

    const project: Project = {
      id: uuidv4(),
      title: data.title,
      engineType: data.engineType,
      styleVariant,
      pptAudience,
      thumbnail: data.thumbnail || '',
      groupId: data.groupId,
      createdAt: now,
      updatedAt: now,
    }

    if (mode === 'local') {
      await db.projects.add(project)
      const localUserId = useStorageModeStore.getState().localUserId
      authService.logFileCreation({
        userId: localUserId,
        userType: 'local',
        fileId: project.id,
        fileTitle: project.title,
      })
      return project
    }

    const response = await fetch(`${API_BASE}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authService.getAuthHeader() },
      body: JSON.stringify(project),
    })
    if (!response.ok) throw new Error('Failed to create project')

    const user = useAuthStore.getState().user
    if (user) {
      authService.logFileCreation({
        userId: user.id,
        userType: 'cloud',
        fileId: project.id,
        fileTitle: project.title,
      })
    }
    return project
  },
```

Also fix the import at the top:

```ts
import { v4 as uuidv4 } from 'uuid'
import type { EngineType, Project } from '@/types'
import { DEFAULT_PPT_THEME, type PptAudience } from '@/lib/skillThemes'
import { authService } from './authService'
import { useStorageModeStore } from '@/stores/storageModeStore'
import { useAuthStore } from '@/stores/authStore'
import { db } from './db'
```

(Remove `HtmlStyleVariant` import.)

- [ ] **Step 2: Update `src/constants/index.ts`**

Replace the existing file:

```ts
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
```

(The old `HTML_STYLES` export is removed; callers will switch to `HTML_DIAGRAM_THEMES`.)

- [ ] **Step 3: Wire `html-ppt` into CanvasArea**

Edit `src/features/editor/CanvasArea.tsx`. Add import + ref + switch cases.

At the top, add the import (after the existing HtmlRenderer import):
```tsx
import { HtmlPptRenderer, type HtmlPptRendererRef } from '@/features/engines/html-ppt/HtmlPptRenderer'
```

Add a new ref alongside `htmlRef`:
```tsx
const htmlPptRef = useRef<HtmlPptRendererRef | null>(null)
```

In each of the 6 switch statements in `useImperativeHandle`, add a `case 'html-ppt':` branch that delegates to `htmlPptRef.current?.<method>()`. The list of methods is: `exportAsSvg`, `exportAsPng`, `exportAsSource`, `showSourceCode`, `hideSourceCode`, `toggleSourceCode`. Each follows the same pattern as the `case 'html':` already in place.

Add `case 'html-ppt':` in `openInNewWindow`:
```tsx
    openInNewWindow: () => {
      if (engineType === 'html') {
        htmlRef.current?.openInNewWindow()
      } else if (engineType === 'html-ppt') {
        htmlPptRef.current?.openInNewWindow()
      }
    },
```

Add a `case 'html-ppt':` in `renderEngine()`:
```tsx
      case 'html-ppt':
        return (
          <HtmlPptRenderer
            ref={htmlPptRef}
            key={projectKey}
            html={currentContent}
            styleVariant={styleVariant ?? 'tokyo-night'}
            title={currentProject?.title || ''}
            onChange={handleContentChange}
          />
        )
```

- [ ] **Step 4: Update `src/hooks/useAIGenerate.ts`**

Find the two `getSystemPrompt(engineType, { styleVariant: currentProject.styleVariant })` calls (lines 123 and 437) and replace each with:

```ts
    const systemPrompt = getSystemPrompt(engineType, {
      styleVariant: currentProject.styleVariant,
      pptAudience: currentProject.pptAudience,
    })
```

Find the `if (engineType === 'html') { validatedCode = sanitizeSvg(validatedCode) }` blocks (two of them — lines 272–274 and 573–575). Replace `sanitizeSvg` with `sanitizeHtml`, and add a parallel branch for `html-ppt`:

```ts
      if (engineType === 'html' || engineType === 'html-ppt') {
        validatedCode = sanitizeHtml(validatedCode)
      }
```

Update the import at the top: change
```ts
import { sanitizeSvg } from '@/lib/validators/html'
```
to
```ts
import { sanitizeHtml } from '@/lib/validators/html'
```

- [ ] **Step 5: Update `src/lib/thumbnail.ts`**

Open the file. Find the function that handles engineType cases (likely `generateThumbnail`). Add cases for `'html'` and `'html-ppt'` that return a small text-only placeholder data URL (we can do better in a follow-up; for now this keeps the recent-projects grid populated without a flaky CDN round-trip).

If the file currently has `case 'html':` (added in v1) that calls `svgToDataUrl`, replace it with:

```ts
      case 'html':
      case 'html-ppt':
        // v2: HTML output cannot be turned into a thumbnail without a hidden
        // iframe + html2canvas. Skip for now — return empty and let UI fall
        // back to the Logo placeholder.
        return ''
```

If you don't see a `case 'html'` (means the v1 logic lives somewhere else), grep for `generateHtmlThumbnail` and remove its body / make it return `''`.

- [ ] **Step 6: Verify build + lint**

Run: `pnpm run build && pnpm run lint`
Expected: both pass. There will be a few unused-import warnings — clean them up inline.

- [ ] **Step 7: Commit**

```bash
git add src/services/projectRepository.ts src/constants/index.ts src/features/editor/CanvasArea.tsx src/hooks/useAIGenerate.ts src/lib/thumbnail.ts
git commit -m "feat(html-ppt): wire engine into repo / canvas / ai generate / thumbnail"
```

---

## Task 9: UI — CreateProjectDialog, HomePage, PPT Audience Dialog

**Files:**
- Create: `src/components/layout/PptAudienceDialog.tsx`
- Modify: `src/components/layout/CreateProjectDialog.tsx`
- Modify: `src/components/layout/ImportProjectDialog.tsx`
- Modify: `src/pages/HomePage.tsx`

- [ ] **Step 1: Create `PptAudienceDialog`**

Create `src/components/layout/PptAudienceDialog.tsx`:

```tsx
import { useEffect, useMemo, useState } from 'react'
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui'
import {
  PPT_AUDIENCES,
  pptThemesForAudience,
  DEFAULT_PPT_THEME,
  type PptAudience,
} from '@/lib/skillThemes'

interface PptAudienceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialAudience?: PptAudience
  initialTheme?: string
  /** Called when the user clicks 确认 after choosing both. */
  onConfirm: (audience: PptAudience, themeId: string) => void
}

export function PptAudienceDialog({ open, onOpenChange, initialAudience = 'engineers', initialTheme, onConfirm }: PptAudienceDialogProps) {
  const [audience, setAudience] = useState<PptAudience>(initialAudience)
  const [themeId, setThemeId] = useState<string>(initialTheme ?? DEFAULT_PPT_THEME[initialAudience])
  const themes = useMemo(() => pptThemesForAudience(audience), [audience])

  useEffect(() => {
    if (open) {
      setAudience(initialAudience)
      setThemeId(initialTheme ?? DEFAULT_PPT_THEME[initialAudience])
    }
  }, [open, initialAudience, initialTheme])

  useEffect(() => {
    // When audience changes, snap themeId to the default for that audience if
    // the previous selection is no longer in the audience's recommended list.
    if (!themes.find((t) => t.id === themeId)) {
      setThemeId(DEFAULT_PPT_THEME[audience])
    }
  }, [audience, themes, themeId])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>新建 HTML PPT</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <div className="mb-2 text-sm font-medium">1. 受众场景</div>
            <div className="grid grid-cols-3 gap-2">
              {PPT_AUDIENCES.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAudience(a.id)}
                  className={`rounded-xl border p-3 text-left transition ${audience === a.id ? 'border-primary bg-primary/5' : 'border-border bg-muted/30 hover:border-primary/50'}`}
                >
                  <div className="text-sm font-medium">{a.label}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{a.description}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 text-sm font-medium">2. 主题（共 {themes.length} 个）</div>
            <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
              {themes.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setThemeId(t.id)}
                  className={`rounded-xl border p-3 text-left transition ${themeId === t.id ? 'border-primary bg-primary/5' : 'border-border bg-muted/30 hover:border-primary/50'}`}
                >
                  <div className="text-sm font-medium">{t.name}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{t.description}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-full">取消</Button>
          <Button onClick={() => onConfirm(audience, themeId)} className="rounded-full bg-primary text-surface hover:bg-primary/90">
            使用「{PPT_AUDIENCES.find((a) => a.id === audience)?.label} · {themes.find((t) => t.id === themeId)?.name}」继续
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Update `CreateProjectDialog.tsx`**

Replace the entire file with:

```tsx
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui'
import { ENGINES, HTML_DIAGRAM_THEMES } from '@/constants'
import { ProjectRepository } from '@/services/projectRepository'
import { GroupRepository } from '@/services/groupRepository'
import type { EngineType, Group } from '@/types'
import {
  DEFAULT_DIAGRAM_THEME,
  DEFAULT_PPT_THEME,
  pptThemesForAudience,
  PPT_AUDIENCES,
  type DiagramThemeFamily,
  type PptAudience,
} from '@/lib/skillThemes'
import { useSystemStore } from '@/stores/systemStore'

interface CreateProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const FAMILY_ORDER: DiagramThemeFamily[] = ['tech', 'business', 'minimalist', 'colorful']
const FAMILY_LABEL: Record<DiagramThemeFamily, string> = {
  tech: '技术风',
  business: '商务',
  minimalist: '极简',
  colorful: '彩色 / 设计',
}

export function CreateProjectDialog({ open, onOpenChange }: CreateProjectDialogProps) {
  const navigate = useNavigate()
  const defaultEngine = useSystemStore((state) => state.defaultEngine)
  const language = useSystemStore((state) => state.language)
  const i18nTexts = useSystemStore((state) => state.i18nTexts)
  const [title, setTitle] = useState(i18nTexts.dialogUntitled[language])
  const [engine, setEngine] = useState<EngineType>(defaultEngine)
  const [htmlTheme, setHtmlTheme] = useState<string>(DEFAULT_DIAGRAM_THEME)
  const [pptAudience, setPptAudience] = useState<PptAudience>('engineers')
  const [pptTheme, setPptTheme] = useState<string>(DEFAULT_PPT_THEME.engineers)
  const [groupId, setGroupId] = useState<string>('uncategorized')
  const [groups, setGroups] = useState<Group[]>([])
  const [isCreating, setIsCreating] = useState(false)

  const themesByFamily = useMemo(() => {
    const groups: Record<DiagramThemeFamily, typeof HTML_DIAGRAM_THEMES> = { tech: [], business: [], minimalist: [], colorful: [] }
    for (const t of HTML_DIAGRAM_THEMES) groups[t.family].push(t)
    return groups
  }, [])

  const audienceThemes = useMemo(() => pptThemesForAudience(pptAudience), [pptAudience])

  useEffect(() => {
    if (open) {
      loadGroups()
      setEngine(defaultEngine)
      setHtmlTheme(DEFAULT_DIAGRAM_THEME)
      setPptAudience('engineers')
      setPptTheme(DEFAULT_PPT_THEME.engineers)
    }
  }, [open, defaultEngine])

  useEffect(() => {
    if (!audienceThemes.find((t) => t.id === pptTheme)) {
      setPptTheme(DEFAULT_PPT_THEME[pptAudience])
    }
  }, [pptAudience, audienceThemes, pptTheme])

  const loadGroups = async () => {
    try {
      const data = await GroupRepository.getAll()
      setGroups(data)
    } catch (error) {
      console.error('Failed to load groups:', error)
    }
  }

  const handleCreate = async () => {
    if (!title.trim()) return
    setIsCreating(true)
    try {
      const styleVariant =
        engine === 'html' ? htmlTheme : engine === 'html-ppt' ? pptTheme : undefined
      const pptAudienceField = engine === 'html-ppt' ? pptAudience : undefined
      const project = await ProjectRepository.create({
        title: title.trim(),
        engineType: engine,
        styleVariant,
        pptAudience: pptAudienceField,
        groupId: groupId === 'uncategorized' ? undefined : groupId,
      })
      onOpenChange(false)
      setTitle(i18nTexts.dialogUntitled[language])
      setGroupId('uncategorized')
      navigate(`/editor/${project.id}`)
    } catch (error) {
      console.error('Failed to create project:', error)
    } finally {
      setIsCreating(false)
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setTitle(i18nTexts.dialogUntitled[language])
      setEngine(defaultEngine)
      setHtmlTheme(DEFAULT_DIAGRAM_THEME)
      setPptAudience('engineers')
      setPptTheme(DEFAULT_PPT_THEME.engineers)
      setGroupId('uncategorized')
    }
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{i18nTexts.dialogNewFile[language]}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <label className="mb-2 block text-sm font-medium">{i18nTexts.dialogFileName[language]}</label>
            <Input
              placeholder={i18nTexts.dialogFileNamePlaceholder[language]}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="rounded-xl"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">{i18nTexts.dialogGroup[language]}</label>
            <Select value={groupId} onValueChange={setGroupId}>
              <SelectTrigger className="w-full rounded-xl"><SelectValue placeholder={i18nTexts.dialogSelectGroup[language]} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="uncategorized">{i18nTexts.projectsUncategorized[language]}</SelectItem>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">{i18nTexts.dialogEngine[language]}</label>
            <Select value={engine} onValueChange={(v) => setEngine(v as EngineType)}>
              <SelectTrigger className="w-full rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ENGINES.map((e) => (<SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>))}
              </SelectContent>
            </Select>
            <p className="mt-2 text-xs text-muted-foreground">{ENGINES.find((e) => e.value === engine)?.description}</p>
          </div>

          {engine === 'html' && (
            <div className="max-h-72 overflow-y-auto pr-1">
              <label className="mb-2 block text-sm font-medium">主题（12 个）</label>
              {FAMILY_ORDER.map((fam) => (
                <div key={fam} className="mb-3">
                  <div className="mb-1 text-xs text-muted-foreground">{FAMILY_LABEL[fam]}</div>
                  <div className="grid grid-cols-2 gap-2">
                    {themesByFamily[fam].map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setHtmlTheme(t.id)}
                        className={`rounded-xl border p-2 text-left transition ${htmlTheme === t.id ? 'border-primary bg-primary/5' : 'border-border bg-muted/30 hover:border-primary/50'}`}
                      >
                        <div className="text-sm font-medium">{t.name}</div>
                        <div className="mt-1 text-[10px] text-muted-foreground line-clamp-2">{t.description}</div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <p className="mt-1 text-xs text-muted-foreground">创建后主题不可更改，如需切换请新建项目。</p>
            </div>
          )}

          {engine === 'html-ppt' && (
            <div className="max-h-80 overflow-y-auto pr-1">
              <label className="mb-2 block text-sm font-medium">1. 受众场景</label>
              <div className="grid grid-cols-3 gap-2">
                {PPT_AUDIENCES.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setPptAudience(a.id)}
                    className={`rounded-xl border p-2 text-left transition ${pptAudience === a.id ? 'border-primary bg-primary/5' : 'border-border bg-muted/30 hover:border-primary/50'}`}
                  >
                    <div className="text-sm font-medium">{a.label}</div>
                    <div className="mt-1 text-[10px] text-muted-foreground">{a.description}</div>
                  </button>
                ))}
              </div>

              <label className="mb-2 mt-4 block text-sm font-medium">2. 主题（{audienceThemes.length} 个）</label>
              <div className="grid grid-cols-2 gap-2">
                {audienceThemes.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setPptTheme(t.id)}
                    className={`rounded-xl border p-2 text-left transition ${pptTheme === t.id ? 'border-primary bg-primary/5' : 'border-border bg-muted/30 hover:border-primary/50'}`}
                  >
                    <div className="text-sm font-medium">{t.name}</div>
                    <div className="mt-1 text-[10px] text-muted-foreground line-clamp-2">{t.description}</div>
                  </button>
                ))}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">创建后受众和主题不可更改。</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-full">{i18nTexts.dialogCancel[language]}</Button>
          <Button onClick={handleCreate} disabled={isCreating} className="rounded-full bg-primary text-surface hover:bg-primary/90">
            {isCreating ? i18nTexts.dialogCreating[language] : i18nTexts.dialogCreate[language]}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 3: Update `ImportProjectDialog.tsx` to exclude html-ppt**

Open `src/components/layout/ImportProjectDialog.tsx`. Find where the engine list / engine guard is computed. If it currently filters out `'html'`, extend the filter to also exclude `'html-ppt'`. Example diff (your actual file may have a different filter expression — apply the same logic):

```ts
// Before
const importable = ENGINES.filter((e) => e.value !== 'html')

// After
const importable = ENGINES.filter((e) => e.value !== 'html' && e.value !== 'html-ppt')
```

If you can't find an existing filter, grep for `import.*html` inside the file and add the guard wherever appropriate.

- [ ] **Step 4: Update `HomePage.tsx` quick-start dialogs**

Find the existing block at the top of HomePage state (around lines 91–94):

```ts
  const [previewProject, setPreviewProject] = useState<Project | null>(null)
  const [isAnnouncementOpen, setIsAnnouncementOpen] = useState(true)
  const [quickStartHtmlStyle, setQuickStartHtmlStyle] = useState<HtmlStyleVariant>('dark-tech')
  const [isStyleDialogOpen, setIsStyleDialogOpen] = useState(false)
```

Replace with:

```ts
  const [previewProject, setPreviewProject] = useState<Project | null>(null)
  const [isAnnouncementOpen, setIsAnnouncementOpen] = useState(true)
  const [quickStartHtmlTheme, setQuickStartHtmlTheme] = useState<string>('tech-dark')
  const [isHtmlThemeDialogOpen, setIsHtmlThemeDialogOpen] = useState(false)
  const [isPptDialogOpen, setIsPptDialogOpen] = useState(false)
```

Then update imports at the top of the file: remove the `HTML_STYLES` import and `HtmlStyleVariant` import, add:

```ts
import { HTML_DIAGRAM_THEMES } from '@/constants'
import { type PptAudience } from '@/lib/skillThemes'
import { PptAudienceDialog } from '@/components/layout/PptAudienceDialog'
```

Update `handleQuickStart` (~line 186) to branch on both new engines:

```tsx
  const handleQuickStart = () => {
    if (!prompt.trim()) return
    if (storageMode === 'cloud' && !isAuthenticated()) {
      navigate('/login')
      return
    }
    if (defaultEngine === 'html') {
      setIsHtmlThemeDialogOpen(true)
      return
    }
    if (defaultEngine === 'html-ppt') {
      setIsPptDialogOpen(true)
      return
    }
    executeQuickStart()
  }
```

Update `executeQuickStart` signature to accept `audience` too:

```tsx
  const executeQuickStart = async (themeOverride?: string, audienceOverride?: PptAudience) => {
    setIsLoading(true)
    try {
      const themeForHtml = themeOverride ?? quickStartHtmlTheme
      const themeForPpt = themeOverride
      const audienceForPpt = audienceOverride ?? 'engineers'
      const styleVariant =
        defaultEngine === 'html' ? themeForHtml :
        defaultEngine === 'html-ppt' ? themeForPpt :
        undefined
      const project = await ProjectRepository.create({
        title: `Untitled-${Date.now()}`,
        engineType: defaultEngine,
        styleVariant,
        pptAudience: defaultEngine === 'html-ppt' ? audienceForPpt : undefined,
      })
      // ...keep the rest of the function body identical (attachments handling, navigate) ...
```

Keep the attachment-handling block and `navigate(...)` call as they are.

Find the JSX block that renders the old `<Dialog ...>` (the "选择 HTML 风格" dialog, around lines 817–863). Replace it entirely with two new dialogs:

```tsx
      {/* HTML diagram theme picker (only shown when quick-start engine is html) */}
      <Dialog open={isHtmlThemeDialogOpen} onOpenChange={setIsHtmlThemeDialogOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <div className="space-y-4 py-2">
            <div>
              <h3 className="text-base font-semibold text-primary">选择 HTML 主题</h3>
              <p className="mt-1 text-xs text-muted-foreground">创建后主题不可更改。</p>
            </div>
            <div className="grid max-h-64 grid-cols-2 gap-2 overflow-y-auto pr-1">
              {HTML_DIAGRAM_THEMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setQuickStartHtmlTheme(t.id)}
                  className={`rounded-xl border p-3 text-left transition ${quickStartHtmlTheme === t.id ? 'border-primary bg-primary/5' : 'border-border bg-muted/30 hover:border-primary/50'}`}
                >
                  <div className="text-sm font-medium">{t.name}</div>
                  <div className="mt-1 text-[10px] text-muted-foreground line-clamp-2">{t.description}</div>
                </button>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsHtmlThemeDialogOpen(false)} className="rounded-full">取消</Button>
              <Button
                size="sm"
                onClick={() => {
                  setIsHtmlThemeDialogOpen(false)
                  executeQuickStart(quickStartHtmlTheme)
                }}
                className="rounded-full bg-primary text-surface hover:bg-primary/90"
              >
                使用「{HTML_DIAGRAM_THEMES.find((t) => t.id === quickStartHtmlTheme)?.name}」继续
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* HTML PPT audience + theme picker */}
      <PptAudienceDialog
        open={isPptDialogOpen}
        onOpenChange={setIsPptDialogOpen}
        onConfirm={(audience, themeId) => {
          setIsPptDialogOpen(false)
          executeQuickStart(themeId, audience)
        }}
      />
```

- [ ] **Step 5: Verify build + dev smoke**

Run: `pnpm run build && pnpm run lint`
Expected: both pass.

Run: `pnpm run dev` and open `http://localhost:8787`. Manually verify:
1. CreateProjectDialog: select engine = HTML, see 12 themes grouped by family
2. Same dialog: select engine = HTML PPT, see audience grid + audience-specific theme list
3. Switch audience between engineers / xhs and verify theme list updates
4. Create project with HTML PPT (audience=engineers, theme=tokyo-night). Confirm new project lands in editor.

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/PptAudienceDialog.tsx src/components/layout/CreateProjectDialog.tsx src/components/layout/ImportProjectDialog.tsx src/pages/HomePage.tsx
git commit -m "feat(ui): 12-theme grid for html + audience/theme 2-stage picker for html-ppt"
```

---

## Task 10: EditorPage Export Menu + Final Smoke

**Files:**
- Modify: `src/pages/EditorPage.tsx`

- [ ] **Step 1: Surface "新窗口预览" + "导出 HTML" for html-ppt**

Open `src/pages/EditorPage.tsx`. Find the section that conditionally renders the new-window-preview button (added in commit 06413da — it currently checks `engineType === 'html'`). Update the check to include `html-ppt`:

```tsx
{(engineType === 'html' || engineType === 'html-ppt') && (
  <Button onClick={handleOpenInNewWindow} ...>...</Button>
)}
```

Find the export menu / dropdown that lists SVG / PNG / Source. For `html-ppt`, the renderer's `exportAsSvg` is aliased to "download full HTML deck" and `exportAsPng` is a no-op alias. Update the labels conditionally so the menu item for `html-ppt` reads "导出 HTML deck" instead of "导出 SVG". Concretely:

```tsx
const isPpt = engineType === 'html-ppt'

// In the menu:
<MenuItem onClick={handleExportSvg}>
  {isPpt ? '导出 HTML deck' : engineType === 'html' ? '导出 HTML' : '导出 SVG'}
</MenuItem>
{!isPpt && (
  <MenuItem onClick={handleExportPng}>导出 PNG</MenuItem>
)}
<MenuItem onClick={handleExportSource}>导出源码</MenuItem>
```

If the menu's actual structure differs (e.g. uses a `<Select>` or `<Button>` group), apply the same conditional labelling without restructuring the component.

- [ ] **Step 2: Verify build**

Run: `pnpm run build`
Expected: succeeds.

- [ ] **Step 3: Full manual E2E smoke**

Run `pnpm run dev`. Step through these scenarios — every one of them should pass before merging.

1. **HTML new project (tech-dark, full flow):**
   - Create project, engine=HTML, theme=Tech Dark
   - Editor opens. Type "画一个三层 Web 应用架构" + send
   - Watch SSE stream — should see HTML fragment with `<article class="diagram architecture-diagram">`
   - iframe renders dark-themed architecture diagram with CDN-loaded CSS (check Network panel for jsdelivr request)

2. **HTML theme switch via new project:**
   - Create another project with theme=Cyberpunk Neon, prompt "Linux 内核网络栈"
   - Confirm renders with neon palette

3. **HTML PPT (engineers + tokyo-night):**
   - Create project, engine=HTML PPT, audience=engineers, theme=Tokyo Night
   - Type "做一个 8 页分布式追踪系统技术分享" + send
   - Iframe shows first slide
   - Press → twice, expect slide 2 → 3 fade through
   - Click SlideNav 全屏 button → new window opens with deck + script-driven nav (← / → still work)

4. **HTML PPT source-edit by slide:**
   - Click 源码 button
   - Multi-slide editor opens; tabs labelled Slide 1 … Slide N
   - Click Slide 3, change one heading
   - Click 应用; iframe re-renders with edit; advance to slide 3 to verify

5. **HTML PPT export:**
   - Click SlideNav "HTML" download
   - Open downloaded .html in a new browser tab; ← / → still work

6. **Legacy html project:**
   - From recent-files grid (or projects page), open a legacy `dark-tech` project created before this upgrade
   - Confirm it renders with `tech-dark` theme (mapped at runtime)
   - Source editor shows the legacy SVG content; can still be saved as-is

7. **HomePage quick-start (defaultEngine=html):**
   - Profile → set defaultEngine to "HTML 图"
   - On homepage, type prompt + Send → 12-theme picker dialog appears
   - Pick a theme → confirm enters editor

8. **HomePage quick-start (defaultEngine=html-ppt):**
   - Profile → set defaultEngine to "HTML PPT"
   - On homepage, type prompt + Send → 2-stage audience+theme dialog appears
   - Pick audience + theme → confirm enters editor

9. **AI key optional (regression):**
   - Storage mode = local with no AI_API_KEY configured
   - Generate works (fallback to default model or local provider)

- [ ] **Step 4: Update CHANGELOG**

Open `src/pages/docs/ChangelogPage.tsx`. Add a new entry at the top:

```ts
{
  version: 'v1.11.0',
  date: '2026-05-21',
  changes: [
    'html 引擎升级到 ai-draw-skill v0.3：12 个主题（按 tech / business / minimalist / colorful 分组） × 7 种图类型（由 AI 自动识别）',
    '新增 html-ppt 引擎：36 个 PPT 主题 × 6 种受众场景，支持多页演讲稿、键盘 ← / → 翻页、新窗口全屏、按 slide 编辑',
    '主题 CSS 通过 jsdelivr CDN 分发（stone-yu/ai-draw-skill@main）',
    '旧 4 个 html 风格（dark-tech / flat-icon / blueprint / claude-official）通过运行时映射继续可用，旧项目无需迁移',
  ],
},
```

- [ ] **Step 5: Commit**

```bash
git add src/pages/EditorPage.tsx src/pages/docs/ChangelogPage.tsx
git commit -m "feat(editor): expose new-window + export-HTML for html-ppt + v1.11.0 changelog"
```

---

## Self-Review Checklist

Run mentally after Task 10:

- [ ] All 12 sections of the spec have at least one task implementing them (§3 types→Task 2; §4 metadata→Task 1; §5 CDN→Tasks 1+3; §6 prompts→Tasks 4+7; §7 renderers→Tasks 5+6; §8 UI→Task 9 + Task 10; §9 security→Task 3; §10 file changes→spread across Tasks 1–10; §11 risks→addressed in Task 5 step 4 smoke; §12 verification→Task 10 step 3; §13 phasing→this plan structure)
- [ ] No "TODO" / "TBD" / "implement appropriate handling" / placeholder strings
- [ ] All types referenced in later tasks (`PptAudience`, `DiagramTheme`, `PptTheme`, etc.) are defined in Task 1
- [ ] `sanitizeHtml` is defined in Task 3 step 1 and consumed in Tasks 5 / 6 / 8
- [ ] `normalizeHtmlTheme` is defined in Task 1 step 4 and consumed in Tasks 3 / 4
- [ ] `buildHtmlSrcDoc` consumed by HtmlRenderer (Task 5), `buildPptSrcDoc` consumed by HtmlPptRenderer (Task 6)
- [ ] PromptCtx has `pptAudience` field used by useAIGenerate (Task 8 step 4) and consumed by buildHtmlPptSystemPrompt (Task 7 step 1)
- [ ] CanvasArea has a switch case for `html-ppt` in every public method (Task 8 step 3)
- [ ] Legacy 4 styleVariant values map correctly: `dark-tech` → `tech-dark`, `flat-icon` → `saas-modern`, `blueprint` → `blueprint`, `claude-official` → `xhs-soft` (verified in Task 1 step 4 + Task 10 step 3 scenario 6)
