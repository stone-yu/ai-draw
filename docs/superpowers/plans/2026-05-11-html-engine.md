# HTML Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new `html` engine that lets users generate architecture / technical diagrams as SVG via AI, then render them through one of 4 style-specific HTML shells in a sandboxed iframe.

**Architecture:** AI emits a self-contained `<svg>` (no HTML wrapper). The project stores SVG text; the frontend renders by injecting that SVG into a per-variant HTML shell (`darkTech | flatIcon | blueprint | claudeOfficial`) inside a sandboxed iframe. Style is a project-level attribute, picked at creation and immutable. The 4 existing engines (mermaid/excalidraw/drawio) are untouched.

**Tech Stack:** React 19 + TypeScript + Vite + Dexie 4 + Zustand + Monaco. No new dependencies. Verification is `pnpm run build` + `pnpm run lint` + manual smoke (no unit test framework in this repo).

**Source spec:** `docs/superpowers/specs/2026-05-11-html-engine-design.md`

---

## Task 1: Extend Types

**Files:**
- Modify: `src/types/index.ts:1-3, 14-22`

- [ ] **Step 1: Add `'html'` to EngineType and add HtmlStyleVariant + Project.styleVariant**

Replace the `EngineType` line and the `Project` interface:

```ts
// Engine Types
export type EngineType = 'mermaid' | 'excalidraw' | 'drawio' | 'html'

// HTML Engine style variants — picked at project creation, immutable after
export type HtmlStyleVariant =
  | 'dark-tech'
  | 'flat-icon'
  | 'blueprint'
  | 'claude-official'

// ...keep Group as-is...

// Project
export interface Project {
  id: string
  title: string
  engineType: EngineType
  styleVariant?: HtmlStyleVariant // only when engineType === 'html'
  thumbnail: string
  groupId?: string
  createdAt: Date
  updatedAt: Date
}
```

- [ ] **Step 2: Verify TS compiles**

Run: `pnpm run build`
Expected: build succeeds (other files reference Project — they all continue to compile because `styleVariant` is optional).

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(types): add 'html' EngineType and HtmlStyleVariant"
```

---

## Task 2: Dexie Migration for styleVariant

**Files:**
- Modify: `src/lib/db.ts`

- [ ] **Step 1: Add a new Dexie version**

Replace `src/lib/db.ts` contents with:

```ts
import Dexie, { type EntityTable } from 'dexie'
import type { Project, VersionHistory } from '@/types'

/**
 * AI Diagram Hub Database
 * Using Dexie.js for IndexedDB management
 */
class DiagramHubDB extends Dexie {
  projects!: EntityTable<Project, 'id'>
  versionHistory!: EntityTable<VersionHistory, 'id'>

  constructor() {
    super('DiagramHubDB')

    // v1: original schema
    this.version(1).stores({
      projects: 'id, title, engineType, createdAt, updatedAt',
      versionHistory: 'id, projectId, timestamp',
    })

    // v2: add styleVariant for html engine projects. No data migration needed
    // because the field is optional and old rows simply have it undefined.
    this.version(2).stores({
      projects: 'id, title, engineType, styleVariant, createdAt, updatedAt',
      versionHistory: 'id, projectId, timestamp',
    })
  }
}

// Singleton database instance
export const db = new DiagramHubDB()
```

- [ ] **Step 2: Verify build**

Run: `pnpm run build`
Expected: success.

- [ ] **Step 3: Commit**

```bash
git add src/lib/db.ts
git commit -m "feat(db): bump Dexie to v2 with styleVariant index"
```

---

## Task 3: ProjectRepository — Pass-through styleVariant

**Files:**
- Modify: `src/services/projectRepository.ts:18-49`

- [ ] **Step 1: Extend the `create` signature and project literal**

Replace the `create` method body (only the part that builds `project` and signature):

```ts
  async create(data: {
    title: string
    engineType: EngineType
    styleVariant?: import('@/types').HtmlStyleVariant
    thumbnail?: string
    groupId?: string
  }): Promise<Project> {
    const mode = useStorageModeStore.getState().mode
    const now = new Date()
    const project: Project = {
      id: uuidv4(),
      title: data.title,
      engineType: data.engineType,
      styleVariant: data.styleVariant,
      thumbnail: data.thumbnail || '',
      groupId: data.groupId,
      createdAt: now,
      updatedAt: now,
    }
    // ...rest of create unchanged
```

(The rest of `create` — local `db.projects.add(project)` / cloud POST — needs no change; both pass the entire `project` object through.)

- [ ] **Step 2: Verify build**

Run: `pnpm run build`
Expected: success.

- [ ] **Step 3: Commit**

```bash
git add src/services/projectRepository.ts
git commit -m "feat(project): accept styleVariant in create()"
```

---

## Task 4: Editor Store — selectStyleVariant Selector

**Files:**
- Modify: `src/stores/editorStore.ts:82-87`

- [ ] **Step 1: Add the selector below `selectEngineType`**

Append at end of file:

```ts
export const selectStyleVariant = (state: EditorState): import('@/types').HtmlStyleVariant | null =>
  state.currentProject?.styleVariant ?? null
```

- [ ] **Step 2: Verify build**

Run: `pnpm run build`
Expected: success.

- [ ] **Step 3: Commit**

```bash
git add src/stores/editorStore.ts
git commit -m "feat(store): add selectStyleVariant selector"
```

---

## Task 5: HTML Shell Templates (4 variants)

**Files:**
- Create: `src/lib/htmlShells/index.ts`
- Create: `src/lib/htmlShells/darkTech.ts`
- Create: `src/lib/htmlShells/flatIcon.ts`
- Create: `src/lib/htmlShells/blueprint.ts`
- Create: `src/lib/htmlShells/claudeOfficial.ts`

- [ ] **Step 1: Create `src/lib/htmlShells/index.ts`**

```ts
import type { HtmlStyleVariant } from '@/types'
import { darkTechShell } from './darkTech'
import { flatIconShell } from './flatIcon'
import { blueprintShell } from './blueprint'
import { claudeOfficialShell } from './claudeOfficial'

export type ShellFn = (svg: string, title: string) => string

export const shells: Record<HtmlStyleVariant, ShellFn> = {
  'dark-tech': darkTechShell,
  'flat-icon': flatIconShell,
  blueprint: blueprintShell,
  'claude-official': claudeOfficialShell,
}

export function buildSrcDoc(
  variant: HtmlStyleVariant,
  svg: string,
  title: string,
): string {
  const fn = shells[variant]
  if (!fn) {
    throw new Error(`Unknown HtmlStyleVariant: ${variant}`)
  }
  return fn(svg, title)
}

/**
 * Escape a string for safe insertion into HTML text content.
 * The title comes from user input; SVG comes from validated AI output.
 */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
```

- [ ] **Step 2: Create `src/lib/htmlShells/darkTech.ts`** (Cocoon-derived dark professional)

```ts
import { escapeHtml } from './index'

export function darkTechShell(svg: string, title: string): string {
  const safeTitle = escapeHtml(title || 'Architecture Diagram')
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${safeTitle}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />
<style>
  html, body { margin: 0; padding: 0; height: 100%; background: #020617; }
  body {
    font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
    color: #e2e8f0;
    background-image:
      linear-gradient(rgba(148,163,184,0.08) 1px, transparent 1px),
      linear-gradient(90deg, rgba(148,163,184,0.08) 1px, transparent 1px);
    background-size: 40px 40px;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 24px;
    box-sizing: border-box;
  }
  .header { width: 100%; max-width: 1200px; padding-bottom: 16px; }
  .header h1 {
    font-size: 16px;
    font-weight: 600;
    letter-spacing: 0.04em;
    color: #f1f5f9;
    margin: 0;
  }
  .diagram-card {
    width: 100%;
    max-width: 1200px;
    background: rgba(15,23,42,0.6);
    border: 1px solid rgba(148,163,184,0.15);
    border-radius: 12px;
    padding: 24px;
    box-sizing: border-box;
  }
  .diagram-card svg { width: 100%; height: auto; display: block; }
</style>
</head>
<body>
  <div class="header"><h1>${safeTitle}</h1></div>
  <div class="diagram-card">${svg}</div>
</body>
</html>`
}
```

- [ ] **Step 3: Create `src/lib/htmlShells/flatIcon.ts`** (Fireworks style-1 white, Inter)

```ts
import { escapeHtml } from './index'

export function flatIconShell(svg: string, title: string): string {
  const safeTitle = escapeHtml(title || 'Technical Diagram')
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${safeTitle}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
<style>
  html, body { margin: 0; padding: 0; height: 100%; background: #ffffff; }
  body {
    font-family: 'Inter', system-ui, -apple-system, Segoe UI, sans-serif;
    color: #0f172a;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 32px;
    box-sizing: border-box;
  }
  .header { width: 100%; max-width: 1100px; padding-bottom: 12px; }
  .header h1 { font-size: 18px; font-weight: 600; margin: 0; color: #111827; }
  .diagram-card {
    width: 100%;
    max-width: 1100px;
    background: #ffffff;
    padding: 16px 0;
  }
  .diagram-card svg { width: 100%; height: auto; display: block; }
</style>
</head>
<body>
  <div class="header"><h1>${safeTitle}</h1></div>
  <div class="diagram-card">${svg}</div>
</body>
</html>`
}
```

- [ ] **Step 4: Create `src/lib/htmlShells/blueprint.ts`** (Fireworks style-3 blueprint)

```ts
import { escapeHtml } from './index'

export function blueprintShell(svg: string, title: string): string {
  const safeTitle = escapeHtml(title || 'Architecture Blueprint')
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${safeTitle}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
<style>
  html, body { margin: 0; padding: 0; height: 100%; background: #0a1628; }
  body {
    font-family: 'Inter', system-ui, sans-serif;
    color: #bfdbfe;
    background-image:
      linear-gradient(rgba(96,165,250,0.10) 1px, transparent 1px),
      linear-gradient(90deg, rgba(96,165,250,0.10) 1px, transparent 1px);
    background-size: 32px 32px;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 24px;
    box-sizing: border-box;
  }
  .header { width: 100%; max-width: 1200px; padding-bottom: 12px; }
  .header h1 {
    font-size: 16px;
    font-weight: 500;
    color: #dbeafe;
    margin: 0;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  .diagram-card {
    width: 100%;
    max-width: 1200px;
    border: 1px solid rgba(96,165,250,0.35);
    border-radius: 8px;
    padding: 20px;
    background: rgba(8,17,33,0.6);
    box-sizing: border-box;
  }
  .diagram-card svg { width: 100%; height: auto; display: block; }
</style>
</head>
<body>
  <div class="header"><h1>${safeTitle}</h1></div>
  <div class="diagram-card">${svg}</div>
</body>
</html>`
}
```

- [ ] **Step 5: Create `src/lib/htmlShells/claudeOfficial.ts`** (Fireworks style-6 warm cream)

```ts
import { escapeHtml } from './index'

export function claudeOfficialShell(svg: string, title: string): string {
  const safeTitle = escapeHtml(title || 'Diagram')
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${safeTitle}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
<style>
  html, body { margin: 0; padding: 0; height: 100%; background: #f8f6f3; }
  body {
    font-family: 'Inter', system-ui, sans-serif;
    color: #1f1d1a;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 32px;
    box-sizing: border-box;
  }
  .header { width: 100%; max-width: 1100px; padding-bottom: 12px; }
  .header h1 { font-size: 18px; font-weight: 600; margin: 0; color: #2a2724; }
  .diagram-card {
    width: 100%;
    max-width: 1100px;
    background: #ffffff;
    border: 1px solid rgba(34,30,26,0.08);
    border-radius: 10px;
    padding: 24px;
    box-sizing: border-box;
  }
  .diagram-card svg { width: 100%; height: auto; display: block; }
</style>
</head>
<body>
  <div class="header"><h1>${safeTitle}</h1></div>
  <div class="diagram-card">${svg}</div>
</body>
</html>`
}
```

- [ ] **Step 6: Verify build**

Run: `pnpm run build`
Expected: success.

- [ ] **Step 7: Commit**

```bash
git add src/lib/htmlShells/
git commit -m "feat(html): add 4 HTML shell templates (dark-tech, flat-icon, blueprint, claude-official)"
```

---

## Task 6: SVG Validator + Sanitizer

**Files:**
- Create: `src/lib/validators/html.ts`
- Modify: `src/lib/validators/index.ts`

- [ ] **Step 1: Create `src/lib/validators/html.ts`**

```ts
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
  cleaned = cleaned.replace(/\s+on[a-zA-Z]+\s*=\s*[^\s>]+/g, '')

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

  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(withoutProlog, 'image/svg+xml')
    const parserError = doc.querySelector('parsererror')
    if (parserError) {
      return { valid: false, error: 'Malformed SVG: ' + (parserError.textContent || 'parse error') }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'SVG parse failed'
    return { valid: false, error: message }
  }

  return { valid: true }
}
```

- [ ] **Step 2: Wire `html` into `validateContent`**

Modify `src/lib/validators/index.ts:117-131` so the switch handles `'html'`:

```ts
import { validateHtmlSvg } from './html'

// ...existing functions unchanged...

export async function validateContent(
  content: string,
  engineType: EngineType
): Promise<ValidationResult> {
  switch (engineType) {
    case 'mermaid':
      return validateMermaid(content)
    case 'excalidraw':
      return validateExcalidraw(content)
    case 'drawio':
      return validateDrawio(content)
    case 'html':
      return validateHtmlSvg(content)
    default:
      return { valid: false, error: `Unknown engine type: ${engineType}` }
  }
}
```

- [ ] **Step 3: Verify build**

Run: `pnpm run build`
Expected: success.

- [ ] **Step 4: Commit**

```bash
git add src/lib/validators/
git commit -m "feat(validators): add SVG sanitize + validateHtmlSvg for html engine"
```

---

## Task 7: HTML Prompt Module

**Files:**
- Create: `src/lib/prompts/html.ts`
- Modify: `src/lib/prompts/index.ts`

- [ ] **Step 1: Create `src/lib/prompts/html.ts`**

```ts
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
```

- [ ] **Step 2: Export from prompts index**

Replace `src/lib/prompts/index.ts`:

```ts
export { mermaidSystemPrompt } from './mermaid'
export { drawioSystemPrompt } from './drawio'
export { excalidrawSystemPrompt } from './excalidraw'
export { buildHtmlSystemPrompt } from './html'
```

- [ ] **Step 3: Verify build**

Run: `pnpm run build`
Expected: success.

- [ ] **Step 4: Commit**

```bash
git add src/lib/prompts/
git commit -m "feat(prompts): add html system prompt with 4 style variants"
```

---

## Task 8: promptBuilder — Support Function-Style Entries

**Files:**
- Modify: `src/lib/promptBuilder.ts:1-11`

- [ ] **Step 1: Replace the imports + SYSTEM_PROMPTS block**

Replace lines 1-11 with:

```ts
import type { EngineType, HtmlStyleVariant } from '@/types'
import {
  drawioSystemPrompt,
  excalidrawSystemPrompt,
  mermaidSystemPrompt,
  buildHtmlSystemPrompt,
} from './prompts'

export interface PromptCtx {
  styleVariant?: HtmlStyleVariant
}

type PromptEntry = string | ((ctx: PromptCtx) => string)

/**
 * System prompts for different engines. Use getSystemPrompt() to resolve.
 */
export const SYSTEM_PROMPTS: Record<EngineType, PromptEntry> = {
  mermaid: mermaidSystemPrompt,
  excalidraw: excalidrawSystemPrompt,
  drawio: drawioSystemPrompt,
  html: (ctx) => buildHtmlSystemPrompt(ctx.styleVariant ?? 'dark-tech'),
}

/**
 * Resolve a system prompt for the given engine.
 */
export function getSystemPrompt(
  engineType: EngineType,
  ctx: PromptCtx = {},
): string {
  const entry = SYSTEM_PROMPTS[engineType]
  return typeof entry === 'function' ? entry(ctx) : entry
}
```

- [ ] **Step 2: Verify build (expect failures in useAIGenerate — fixed in next task)**

Run: `pnpm run build`
Expected: build fails because `useAIGenerate.ts` still does `SYSTEM_PROMPTS[engineType]` as a string. We will fix that next; this is intentional.

- [ ] **Step 3: Do NOT commit yet** — wait for Task 9 (combine commits to keep build green per-commit).

---

## Task 9: useAIGenerate — Use getSystemPrompt with styleVariant

**Files:**
- Modify: `src/hooks/useAIGenerate.ts:9, 121-122, 428-429`

- [ ] **Step 1: Update import line 9**

Replace:

```ts
import {buildEditPrompt, buildInitialPrompt, extractCode, SYSTEM_PROMPTS,} from '@/lib/promptBuilder'
```

with:

```ts
import {buildEditPrompt, buildInitialPrompt, extractCode, getSystemPrompt,} from '@/lib/promptBuilder'
```

- [ ] **Step 2: Replace the two `SYSTEM_PROMPTS[engineType]` call sites**

Inside `generate` (around line 121-122):

```ts
    const engineType = currentProject.engineType
    const systemPrompt = getSystemPrompt(engineType, {
      styleVariant: currentProject.styleVariant,
    })
```

Inside `retryLast` (around line 428-429):

```ts
    const engineType = currentProject.engineType
    const systemPrompt = getSystemPrompt(engineType, {
      styleVariant: currentProject.styleVariant,
    })
```

- [ ] **Step 3: Verify build now succeeds**

Run: `pnpm run build`
Expected: success.

- [ ] **Step 4: Commit Tasks 8 + 9 together**

```bash
git add src/lib/promptBuilder.ts src/hooks/useAIGenerate.ts
git commit -m "feat(prompts): switch SYSTEM_PROMPTS to resolver and pass styleVariant"
```

---

## Task 10: extractCode — Handle SVG output

**Files:**
- Modify: `src/lib/promptBuilder.ts:134-166` (the `extractCode` function)

- [ ] **Step 1: Add an svg fence pattern and an html-specific extractor**

Replace the `extractCode` function body with:

```ts
export function extractCode(response: string, engineType: EngineType): string {
  let code = response.trim()

  // Remove plan if present
  const planMatch = code.match(/<plan>[\s\S]*?<\/plan>/)
  if (planMatch) {
    code = code.replace(planMatch[0], '').trim()
  }

  // For html engine, prefer the first <svg>...</svg> block in the response —
  // tolerates stray prose or fences without false-positive extraction.
  if (engineType === 'html') {
    const svgMatch = code.match(/<svg\b[\s\S]*?<\/svg\s*>/i)
    if (svgMatch) {
      return svgMatch[0].trim()
    }
    // Fallback: strip fences only.
    const fenced = code.match(/```(?:svg|xml|html)?\n?([\s\S]*?)```/i)
    if (fenced) return fenced[1].trim()
    return code
  }

  // Remove markdown code blocks if present
  const codeBlockPatterns = [
    /```mermaid\n?([\s\S]*?)```/i,
    /```json\n?([\s\S]*?)```/i,
    /```xml\n?([\s\S]*?)```/i,
    /```\n?([\s\S]*?)```/,
  ]

  for (const pattern of codeBlockPatterns) {
    const match = code.match(pattern)
    if (match) {
      code = match[1].trim()
      break
    }
  }

  // For JSON-based engines (excalidraw), truncate after the complete JSON structure
  if (engineType === 'excalidraw') {
    code = truncateAfterCompleteJSON(code)
  }

  return code
}
```

- [ ] **Step 2: Verify build**

Run: `pnpm run build`
Expected: success.

- [ ] **Step 3: Commit**

```bash
git add src/lib/promptBuilder.ts
git commit -m "feat(prompts): teach extractCode to pull SVG block for html engine"
```

---

## Task 11: HtmlRenderer Component (skeleton)

**Files:**
- Create: `src/features/engines/html/HtmlRenderer.tsx`

- [ ] **Step 1: Create the file**

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
import { buildSrcDoc } from '@/lib/htmlShells'
import { sanitizeSvg } from '@/lib/validators/html'
import type { HtmlStyleVariant } from '@/types'

interface HtmlRendererProps {
  svg: string
  styleVariant: HtmlStyleVariant
  title: string
  onChange?: (svg: string) => void
  className?: string
}

export interface HtmlRendererRef {
  exportAsSvg: () => void
  exportAsPng: () => void
  exportAsSource: () => void
  showSourceCode: () => void
  hideSourceCode: () => void
  toggleSourceCode: () => void
}

export const HtmlRenderer = forwardRef<HtmlRendererRef, HtmlRendererProps>(
  function HtmlRenderer({ svg, styleVariant, title, onChange, className }, ref) {
    const [showCodePanel, setShowCodePanel] = useState(false)
    const [copied, setCopied] = useState(false)
    const [editedCode, setEditedCode] = useState(svg)
    const [hasChanges, setHasChanges] = useState(false)
    const iframeRef = useRef<HTMLIFrameElement | null>(null)

    // Sync editedCode when external svg prop changes
    useEffect(() => {
      setEditedCode(svg)
      setHasChanges(false)
    }, [svg])

    // Build srcDoc once per (svg, styleVariant, title)
    const srcDoc = useMemo(() => {
      const clean = sanitizeSvg(svg || '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 60"></svg>')
      return buildSrcDoc(styleVariant, clean, title)
    }, [svg, styleVariant, title])

    const downloadBlob = useCallback((data: string, mime: string, ext: string) => {
      const blob = new Blob([data], { type: mime })
      const href = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = href
      link.download = `diagram-${Date.now()}${ext}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      setTimeout(() => URL.revokeObjectURL(href), 100)
    }, [])

    const exportAsSvg = useCallback(() => {
      if (!svg) return
      downloadBlob(svg, 'image/svg+xml', '.svg')
    }, [svg, downloadBlob])

    const exportAsSource = useCallback(() => {
      if (!svg) return
      downloadBlob(svg, 'image/svg+xml', '.svg')
    }, [svg, downloadBlob])

    const exportAsPng = useCallback(async () => {
      if (!svg) return
      try {
        const encoded = btoa(unescape(encodeURIComponent(svg)))
        const dataUrl = `data:image/svg+xml;base64,${encoded}`
        const img = new Image()
        img.crossOrigin = 'anonymous'
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve()
          img.onerror = () => reject(new Error('Failed to load SVG for PNG export'))
          img.src = dataUrl
        })

        const canvas = document.createElement('canvas')
        const targetWidth = 1920
        const ratio = (img.height || 1) / (img.width || 1)
        canvas.width = targetWidth
        canvas.height = Math.round(targetWidth * ratio)
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('Canvas 2D context unavailable')
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

        const pngUrl = canvas.toDataURL('image/png', 0.92)
        const link = document.createElement('a')
        link.href = pngUrl
        link.download = `diagram-${Date.now()}.png`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      } catch (err) {
        console.error('[HtmlRenderer] PNG export failed:', err)
      }
    }, [svg])

    useImperativeHandle(
      ref,
      () => ({
        exportAsSvg,
        exportAsPng,
        exportAsSource,
        showSourceCode: () => setShowCodePanel(true),
        hideSourceCode: () => setShowCodePanel(false),
        toggleSourceCode: () => setShowCodePanel((p) => !p),
      }),
      [exportAsSvg, exportAsPng, exportAsSource],
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
        setHasChanges(next !== svg)
      },
      [svg],
    )

    const handleApplyCode = useCallback(() => {
      if (editedCode.trim() && editedCode !== svg && onChange) {
        onChange(editedCode)
        setHasChanges(false)
      }
    }, [editedCode, svg, onChange])

    const handleResetCode = useCallback(() => {
      setEditedCode(svg)
      setHasChanges(false)
    }, [svg])

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
                  <span className="text-sm font-medium">SVG 源码</span>
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
                  defaultLanguage="xml"
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

- [ ] **Step 2: Verify build**

Run: `pnpm run build`
Expected: success.

- [ ] **Step 3: Commit**

```bash
git add src/features/engines/html/HtmlRenderer.tsx
git commit -m "feat(html): add HtmlRenderer with sandboxed iframe + Monaco SVG editor"
```

---

## Task 12: Wire HtmlRenderer Into CanvasArea

**Files:**
- Modify: `src/features/editor/CanvasArea.tsx`

- [ ] **Step 1: Replace the imports and add html ref/render branch**

At the top imports area (lines 1-5), append:

```tsx
import {HtmlRenderer, type HtmlRendererRef} from '@/features/engines/html/HtmlRenderer'
```

Also import the styleVariant selector — replace line 2 with:

```tsx
import {selectEngineType, selectStyleVariant, useEditorStore} from '@/stores/editorStore'
```

- [ ] **Step 2: Add an `html` ref alongside other refs**

After line 37 (`const drawioRef = ...`), add:

```tsx
  const htmlRef = useRef<HtmlRendererRef | null>(null)
  const styleVariant = useEditorStore(selectStyleVariant)
```

- [ ] **Step 3: Add `html` cases to each switch in `useImperativeHandle`**

For every case-by-engine switch (`exportAsSvg`, `exportAsPng`, `exportAsSource`, `showSourceCode`, `hideSourceCode`, `toggleSourceCode`), add the html branch following the drawio pattern. Example for `exportAsSvg`:

```tsx
    exportAsSvg: () => {
      switch (engineType) {
        case 'mermaid':
          mermaidRef.current?.exportAsSvg()
          break
        case 'excalidraw':
          excalidrawRef.current?.exportAsSvg()
          break
        case 'drawio':
          drawioRef.current?.exportAsSvg()
          break
        case 'html':
          htmlRef.current?.exportAsSvg()
          break
      }
    },
```

Apply the same `case 'html': htmlRef.current?.<method>(); break` to all six switch blocks. Leave the `getThumbnail` switch as-is for now (Task 13 handles html thumbnails differently).

- [ ] **Step 4: Add the html branch in `renderEngine`**

In the `renderEngine` switch (around line 178-201), add before `default`:

```tsx
      case 'html':
        if (!styleVariant) {
          return (
            <div className="flex h-full items-center justify-center text-muted">
              缺少风格变体（styleVariant）
            </div>
          )
        }
        return (
          <HtmlRenderer
            ref={htmlRef}
            key={projectKey}
            svg={currentContent}
            styleVariant={styleVariant}
            title={currentProject?.title || ''}
            onChange={handleContentChange}
          />
        )
```

- [ ] **Step 5: Verify build**

Run: `pnpm run build`
Expected: success.

- [ ] **Step 6: Commit**

```bash
git add src/features/editor/CanvasArea.tsx
git commit -m "feat(html): wire HtmlRenderer into CanvasArea switch"
```

---

## Task 13: Thumbnail for html Engine

**Files:**
- Modify: `src/lib/thumbnail.ts:166-189`

- [ ] **Step 1: Add `generateHtmlThumbnail` and switch case**

Add this function above `generateThumbnail`:

```ts
/**
 * Generate thumbnail from a raw SVG string (for html engine).
 * Re-uses the existing svgToDataUrl pipeline.
 */
export async function generateHtmlThumbnail(svg: string): Promise<string> {
  if (!svg.trim()) return ''
  try {
    return await svgToDataUrl(svg)
  } catch (error) {
    console.error('Failed to generate HTML thumbnail:', error)
    return ''
  }
}
```

Then update the switch in `generateThumbnail` (around lines 177-188):

```ts
  switch (engineType) {
    case 'mermaid':
      return generateMermaidThumbnail(content)
    case 'excalidraw':
      return generateExcalidrawThumbnail(content)
    case 'drawio':
      return ''
    case 'html':
      return generateHtmlThumbnail(content)
    default:
      return ''
  }
```

- [ ] **Step 2: Verify build**

Run: `pnpm run build`
Expected: success.

- [ ] **Step 3: Commit**

```bash
git add src/lib/thumbnail.ts
git commit -m "feat(html): add SVG thumbnail generation for html engine"
```

---

## Task 14: ENGINES Constant + i18n Label

**Files:**
- Modify: `src/constants/index.ts:4-8`

- [ ] **Step 1: Append html to ENGINES**

Replace the `ENGINES` definition with:

```ts
export const ENGINES: { value: EngineType; label: string; description: string }[] = [
  { value: 'mermaid', label: 'Mermaid', description: '基于文本的图表生成，适合快速绘制结构化图表' },
  { value: 'excalidraw', label: 'Excalidraw', description: '手绘风格白板工具，自由绘制，界面简洁直观' },
  { value: 'drawio', label: 'Draw.io', description: '专业级图表编辑器，功能丰富，适合复杂技术文档' },
  { value: 'html', label: 'HTML 图', description: 'AI 生成 SVG 架构/技术图，4 种精选视觉风格，自带 HTML 外壳' },
]
```

- [ ] **Step 2: Verify build**

Run: `pnpm run build`
Expected: success.

- [ ] **Step 3: Commit**

```bash
git add src/constants/index.ts
git commit -m "feat(constants): expose html engine in ENGINES list"
```

---

## Task 15: CreateProjectDialog — Style Picker

**Files:**
- Modify: `src/components/layout/CreateProjectDialog.tsx`

- [ ] **Step 1: Add styleVariant state, style options, and engine select**

The dialog currently shows the engine as read-only text (using `defaultEngine`). For html-engine workflow, we need (1) an engine `<Select>` so the user can choose `html`, and (2) a style picker visible only when engine is `html`.

Replace the full file with:

```tsx
import {useEffect, useState} from 'react'
import {useNavigate} from 'react-router-dom'
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
import {ENGINES} from '@/constants'
import {ProjectRepository} from '@/services/projectRepository'
import {GroupRepository} from '@/services/groupRepository'
import type {EngineType, Group, HtmlStyleVariant} from '@/types'

import {useSystemStore} from '@/stores/systemStore'

interface CreateProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const HTML_STYLES: { value: HtmlStyleVariant; label: string; description: string }[] = [
  { value: 'dark-tech', label: 'Dark Tech', description: '暗色背景 + JetBrains Mono + 网格，适合架构图' },
  { value: 'flat-icon', label: 'Flat Icon', description: '简洁白底 Inter，适合文档/博客' },
  { value: 'blueprint', label: 'Blueprint', description: '蓝图暗底 + 青色描边，技术示意感' },
  { value: 'claude-official', label: 'Claude Official', description: '暖米色调，柔和友好' },
]

export function CreateProjectDialog({ open, onOpenChange }: CreateProjectDialogProps) {
  const navigate = useNavigate()
  const defaultEngine = useSystemStore((state) => state.defaultEngine)
  const language = useSystemStore((state) => state.language)
  const i18nTexts = useSystemStore((state) => state.i18nTexts)
  const [title, setTitle] = useState(i18nTexts.dialogUntitled[language])
  const [engine, setEngine] = useState<EngineType>(defaultEngine)
  const [styleVariant, setStyleVariant] = useState<HtmlStyleVariant>('dark-tech')
  const [groupId, setGroupId] = useState<string>('uncategorized')
  const [groups, setGroups] = useState<Group[]>([])
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => {
    if (open) {
      loadGroups()
      setEngine(defaultEngine)
      setStyleVariant('dark-tech')
    }
  }, [open, defaultEngine])

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
      const project = await ProjectRepository.create({
        title: title.trim(),
        engineType: engine,
        styleVariant: engine === 'html' ? styleVariant : undefined,
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
      setStyleVariant('dark-tech')
      setGroupId('uncategorized')
    }
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="rounded-2xl">
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
              <SelectTrigger className="w-full rounded-xl">
                <SelectValue placeholder={i18nTexts.dialogSelectGroup[language]} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="uncategorized">{i18nTexts.projectsUncategorized[language]}</SelectItem>
                {groups.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">{i18nTexts.dialogEngine[language]}</label>
            <Select value={engine} onValueChange={(v) => setEngine(v as EngineType)}>
              <SelectTrigger className="w-full rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ENGINES.map((e) => (
                  <SelectItem key={e.value} value={e.value}>
                    {e.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-2 text-xs text-muted-foreground">
              {ENGINES.find((e) => e.value === engine)?.description}
            </p>
          </div>

          {engine === 'html' && (
            <div>
              <label className="mb-2 block text-sm font-medium">风格</label>
              <div className="grid grid-cols-2 gap-2">
                {HTML_STYLES.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setStyleVariant(s.value)}
                    className={`rounded-xl border p-3 text-left transition ${
                      styleVariant === s.value
                        ? 'border-primary bg-primary/5'
                        : 'border-border bg-muted/30 hover:border-primary/50'
                    }`}
                  >
                    <div className="text-sm font-medium">{s.label}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{s.description}</div>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                创建后风格不可更改，如需切换请新建项目。
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-full"
          >
            {i18nTexts.dialogCancel[language]}
          </Button>
          <Button
            onClick={handleCreate}
            disabled={isCreating}
            className="rounded-full bg-primary text-surface hover:bg-primary/90"
          >
            {isCreating ? i18nTexts.dialogCreating[language] : i18nTexts.dialogCreate[language]}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `pnpm run build`
Expected: success.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/CreateProjectDialog.tsx
git commit -m "feat(create): engine select + html style picker"
```

---

## Task 16: ImportProjectDialog — Defer to Out-of-scope

The spec marks robust .svg / .html import as out-of-scope for the first pass.

**Files:**
- Modify: `src/components/layout/ImportProjectDialog.tsx`

- [ ] **Step 1: Verify the import dialog gracefully handles html projects**

Open the file. If it has a `switch (engineType)` or `engineType === ...` chain, ensure no path crashes when `engineType === 'html'`. If the dialog imports a fixed set of file extensions (`.mermaid`, `.excalidraw`, `.drawio`), do not add new extensions in this PR — instead, ensure the dialog hides the `html` engine option from its picker if any.

Concretely:

- If the dialog enumerates engine choices, scope them to non-html engines for now:

```tsx
const importableEngines = ENGINES.filter((e) => e.value !== 'html')
```

- If the dialog accepts any engine, leave it but skip wiring `styleVariant` (importing html projects without a chosen style is out-of-scope).

- [ ] **Step 2: Verify build**

Run: `pnpm run build`
Expected: success.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/ImportProjectDialog.tsx
git commit -m "chore(import): exclude html engine from import for now (out-of-scope)"
```

---

## Task 17: CHANGELOG

**Files:**
- Modify: `CHANGELOG.md` (top of file)

- [ ] **Step 1: Read existing CHANGELOG header to match style**

Run: `head -20 CHANGELOG.md` and note the date/version format.

- [ ] **Step 2: Prepend a new entry**

Add a section directly below the latest entry header:

```markdown
## v1.10.0 — 2026-05-11

### Added
- 新增 `html` 引擎：AI 生成 SVG 架构/技术图，前端按 4 种风格外壳渲染（Dark Tech / Flat Icon / Blueprint / Claude Official）
- 项目创建时支持选择 HTML 风格变体（创建后不可改）
- HTML 引擎支持 Monaco SVG 源码查看 / 编辑，导出 SVG / PNG / 源码
- 内置 SVG 净化：脚本、`on*` 事件、`javascript:` URL 一律清除

### Internal
- Dexie schema 升级至 v2，新增 `Project.styleVariant`
- `SYSTEM_PROMPTS` 改造为可接受 `PromptCtx` 的解析器，供风格 prompt 使用
```

- [ ] **Step 3: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs(changelog): add v1.10.0 entry for html engine"
```

---

## Task 18: Final Verification (manual smoke test)

This task is not a code change but a structured manual verification before opening a PR.

- [ ] **Step 1: Lint and build clean**

```bash
pnpm run lint
pnpm run build
```

Expected: both succeed with no errors.

- [ ] **Step 2: Smoke test — start dev**

```bash
pnpm run dev
```

Open `http://localhost:8787` (per CLAUDE.md note).

- [ ] **Step 3: For each of the 4 html style variants, do this round trip**

For variant in `[dark-tech, flat-icon, blueprint, claude-official]`:

1. Click "新建项目" → enter title → switch Engine to "HTML 图" → click the style card → "创建"
2. In the editor, send chat: "画一个 3 层 web 架构：前端 → API 网关 → 三个微服务 → 两个数据库 + Redis 缓存"
3. Wait for AI to finish. Verify:
   - iframe renders with the expected background/font for the style
   - SVG content has multiple nodes + arrows
4. Click 查看源码 → confirm Monaco opens with SVG → tweak one fill color → 应用 → iframe updates
5. Click 导出 SVG → download succeeds, file opens in a browser
6. Click 导出 PNG → 1920px PNG downloads, opens
7. Click 导出 源码 → .svg downloads
8. Close project, return to projects list → thumbnail visible
9. Re-open project → content preserved

- [ ] **Step 4: Regression — verify 3 existing engines still work**

Create one mermaid, one excalidraw, one drawio project. Generate via AI for each. Confirm:
- Canvas renders
- Source code panel works
- Export SVG/PNG/source works

- [ ] **Step 5: Browser DevTools — verify iframe sandbox**

In DevTools Elements panel, inspect the html-engine iframe. Confirm:
- `sandbox="allow-same-origin"` is present
- The iframe's `<script>` tags are absent (sanitizer worked) — paste a malicious test: open Monaco, replace the `<svg>` content with `<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect/></svg>` → click 应用 → confirm no alert fires.

- [ ] **Step 6: Tag the milestone (no push)**

```bash
git log --oneline main..HEAD
# Expect tasks 1-17 as separate commits (or grouped where the plan said so).
```

Do NOT push yet; the human reviewer / next phase will handle the PR.

---

## Notes for Implementers

- **No tests framework exists in this repo.** The plan deliberately omits `vitest`/`jest` tasks. If you feel a unit test would catch a sharp edge, add a lightweight Node-script-based check rather than introducing a test runner.
- **Commit boundaries follow the build-green rule.** Tasks 8 + 9 are intentionally committed together because Task 8 alone breaks the build. Every other task should leave `pnpm run build` green.
- **Style is locked after creation.** Do not add a "change style" affordance in this PR — that's out-of-scope per the spec.
- **The drawio iframe lifecycle pattern (commit 5015049) is the reference** for any iframe quirks you hit. Re-read DrawioEditor.tsx before improvising.
- **For HTML rendering, srcDoc is rebuilt via `useMemo`** keyed on `(svg, styleVariant, title)`. The iframe will re-render its document when srcDoc changes — no manual postMessage needed for the MVP.
