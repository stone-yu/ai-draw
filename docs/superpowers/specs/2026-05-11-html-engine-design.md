# HTML Engine 集成设计

- 日期：2026-05-11
- 分支：`feat/html-engine`
- 来源：Cocoon-AI/architecture-diagram-generator + yizhiyanhua-ai/fireworks-tech-graph

## 1. 背景与目标

两个外部 Claude Skill 项目分别提供"暗色架构图"与"7 种出版级技术图"的生成能力，均以 prompt + 模板的形式工作。本期把它们融合为 ai-draw 的第 4 个引擎 `html`，统一通过 SVG + HTML 外壳的方式落地，让用户用自然语言一键生成专业架构/技术图。

成功标准：

- 用户可以新建 `html` 类型项目并在创建时选定一个风格变体
- 自然语言描述 → AI 生成 SVG → 在画布按风格渲染
- 支持源码查看与编辑（Monaco）、导出 SVG / PNG / 源码三种格式
- 4 个已有引擎（mermaid / excalidraw / drawio）行为不变

## 2. 范围

### In-scope

- 新增 `EngineType = 'html'`
- 4 种风格变体：`dark-tech` / `flat-icon` / `blueprint` / `claude-official`
- 默认风格：`dark-tech`
- 风格作为项目属性，创建后只读
- 单阶段 AI 生成（参考 mermaid，`useTwoPhase=false`）
- iframe sandbox 渲染外壳，与 DrawioEditor 同款 lifecycle
- Monaco SVG 源码编辑器（可编辑，与 mermaid 一致）
- 导出 SVG / PNG / 源码 (.svg)
- 缩略图生成
- SVG 净化（去脚本/事件/危险 URL）

### Out-of-scope（明确不做）

- Fireworks 其余 4 种风格（Dark Terminal / Notion Clean / Glassmorphism / OpenAI Official）
- 两阶段生成
- 运行时切换风格并重新生成
- 14 类 diagram type 的细分模板（首期由 AI 在 prompt 引导下自适应）
- 编辑后双向同步 HTML 外壳（用户只改 SVG）
- 单文件 HTML 下载（与 SVG/PNG/源码三件套对齐即可）

## 3. 数据模型

### 3.1 类型扩展

```ts
// src/types/index.ts
export type EngineType = 'mermaid' | 'excalidraw' | 'drawio' | 'html'

export type HtmlStyleVariant =
  | 'dark-tech'
  | 'flat-icon'
  | 'blueprint'
  | 'claude-official'

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

不变量：`engineType === 'html' ⇔ styleVariant !== undefined`，创建后不可改。

### 3.2 内容存储

- `currentContent` / `VersionHistory.content` = 纯 SVG 文本（以 `<svg` 开头、`</svg>` 结尾）
- HTML 外壳模板不进数据库，由前端按 `styleVariant` 即时套用

### 3.3 IndexedDB 迁移

`projects` 表新增 `styleVariant` 列。Dexie schema 升一个版本号，迁移逻辑为 no-op（旧项目 `styleVariant` 自动为 `undefined`，与"非 html"语义一致）。

## 4. 风格外壳模板

新建 `src/lib/htmlShells/`：

```
htmlShells/
├── index.ts              // export shells: Record<HtmlStyleVariant, ShellFn>
├── darkTech.ts           // Cocoon 原版
├── flatIcon.ts           // Fireworks style-1
├── blueprint.ts          // Fireworks style-3
└── claudeOfficial.ts     // Fireworks style-6
```

签名：

```ts
export type ShellFn = (svg: string, title: string) => string
```

每个外壳返回完整 HTML（嵌入 CSS、Google Fonts CDN、SVG 占位填充）。模板特征：

| variant | 背景 | 字体 | Header 风格 |
|---|---|---|---|
| `dark-tech` | `#020617` + 40px 网格 | JetBrains Mono | 摘要卡片 + footer |
| `flat-icon` | 白 `#ffffff` | Inter | 极简标题 |
| `blueprint` | `#0a1628` 蓝图 | Inter | 极简标题 + 蓝色描边 |
| `claude-official` | 暖米 `#f8f6f3` | Inter | 极简标题 |

模板里只允许 `${title}` 与 `${svg}` 两个插值点，且 `title` 在拼接前做 HTML 转义，避免 XSS。

## 5. Prompt 与 AI 调用

### 5.1 新增 `src/lib/prompts/html.ts`

导出 `buildHtmlSystemPrompt(variant: HtmlStyleVariant): string`，组合：

- 通用部分：身份、输出契约（"只返回 `<svg ...>...</svg>`，禁止 ```svg``` fence、禁止 HTML 外壳"）、viewBox / 坐标 / 分层布局约束、可访问性
- 风格部分：每个 variant 提供颜色 token（背景/前景/强调色）、字体、节点描边/填充语义

### 5.2 promptBuilder 集成

`SYSTEM_PROMPTS` 改为支持运行时参数：

```ts
export const SYSTEM_PROMPTS: Record<EngineType, string | ((ctx: PromptCtx) => string)> = {
  mermaid: mermaidSystemPrompt,
  excalidraw: excalidrawSystemPrompt,
  drawio: drawioSystemPrompt,
  html: (ctx) => buildHtmlSystemPrompt(ctx.styleVariant!),
}
```

`useAIGenerate` 在调用点传入 `{ styleVariant }`。

### 5.3 单阶段生成

`buildInitialPrompt(userInput, useTwoPhase=false, ...)` 路径复用 mermaid 的单阶段分支，无需新增 phase。

## 6. 引擎组件

### 6.1 文件结构

```
src/features/engines/html/
├── HtmlRenderer.tsx
└── shellHost.ts          // 单一入口 buildSrcDoc(variant, svg, title) → string，内部 dispatch 到 src/lib/htmlShells
```

### 6.2 渲染策略

- iframe sandbox `sandbox="allow-same-origin"`（不允许 scripts/forms/top-nav）
- `srcDoc` = `shells[variant](svg, project.title)`
- iframe lifecycle 参照 `DrawioEditor`（commit 5015049 的硬化方式）：onLoad 后 postMessage 注册，组件卸载前清理
- 父组件 → iframe：风格变体不变只换 svg 时，只更新 srcDoc 不重建 iframe
- 切换风格不在本期范围；若未来需要，重建 iframe 即可

### 6.3 Props 与 Ref

```ts
interface HtmlRendererProps {
  svg: string
  styleVariant: HtmlStyleVariant
  title: string
  onChange: (svg: string) => void
}

interface HtmlRendererRef {
  exportAsSvg: () => void
  exportAsPng: () => void
  exportAsSource: () => void
  showSourceCode: () => void
  hideSourceCode: () => void
  toggleSourceCode: () => void
}
```

### 6.4 工具栏 / Monaco

- 浮层工具栏（与 mermaid 一致）：缩放、还原、查看源码、下载（SVG/PNG/源码）
- Monaco 编辑器：language=`xml`，可编辑，blur/Ctrl+S 触发 `onChange`
- 编辑后实时更新 iframe srcDoc

### 6.5 导出

| 格式 | 实现 |
|---|---|
| SVG | 直接 `Blob([svg], {type:'image/svg+xml'})` 下载 |
| PNG | SVG → `<img src="data:image/svg+xml;base64,...">` → canvas → toBlob |
| 源码 | 同 SVG（`.svg` 扩展名）|

PNG 走前端 canvas 路径，避免任何 `rsvg-convert` / 后端依赖。

## 7. 集成点（要改的文件）

1. `src/types/index.ts` — 类型扩展
2. `src/lib/db.ts` — Dexie schema 升级 + `Project.styleVariant`
3. `src/services/projectRepository.ts` — `create / getByProjectId / update` 透传 `styleVariant`
4. `src/lib/prompts/index.ts` — 导出 html prompt builder
5. `src/lib/prompts/html.ts` — 新文件
6. `src/lib/promptBuilder.ts` — `SYSTEM_PROMPTS` 改造，新增 ctx 参数
7. `src/lib/htmlShells/*.ts` — 4 个外壳 + index
8. `src/lib/validators/index.ts` 与 `src/lib/validators/html.ts` — SVG 净化
9. `src/lib/thumbnail.ts` — html 分支（SVG → canvas → dataURL）
10. `src/features/engines/html/HtmlRenderer.tsx` 与 `shellHost.ts` — 新文件
11. `src/features/editor/CanvasArea.tsx` — switch case 加 html，ref 转发
12. `src/stores/editorStore.ts` — 新增 `selectStyleVariant` selector（读 `currentProject?.styleVariant`），供 useAIGenerate 与 CanvasArea 消费
13. `src/hooks/useAIGenerate.ts` — 把 `styleVariant` 传入 prompt builder
14. `src/components/layout/CreateProjectDialog.tsx` — 选 html 后展示 4 张风格卡（缩略图 + 名称 + 一句描述）
15. `src/components/layout/ImportProjectDialog.tsx` — 导入 .svg / .html 时识别 html 引擎（首期可只支持 .svg + 必选风格）
16. `src/features/chat/ChatPanel.tsx` — engine 标签兼容（如果 UI 里有显式分支）
17. `src/pages/EditorPage.tsx` / `ProjectsPage.tsx` / `HomePage.tsx` / `AdminPage.tsx` — 列表筛选、图标、文案
18. CHANGELOG.md — 新增条目

## 8. 安全

- iframe `sandbox="allow-same-origin"`，不开 scripts、forms、popup
- `validators/html.ts` 在 AI 输出 → 入库前过滤：
  - 移除 `<script>...</script>` 与 `<script ... />`
  - 移除所有 `on*` 属性（onClick / onLoad 等）
  - 把 `href` / `xlink:href` 中的 `javascript:` 替换为 `#`
  - 拒绝整体不是合法 SVG 的内容（必须以 `<svg` 开头）
- 外壳模板的 `title` 插值前做 HTML 转义

## 9. 可访问性 & 性能

- iframe 加 `title` 属性、`aria-label`
- SVG 加 `<title>` 子元素
- 模板里 Google Fonts 用 `preconnect` 优化首屏
- 切项目时 iframe 重建（与 drawio 行为一致，避免 srcDoc 残留）

## 10. 测试与验证

### 单测

- `validators/html.test.ts`：脚本/事件/javascript:url 注入用例
- `htmlShells/*.test.ts`：title HTML 转义、SVG 占位正确替换

### 手工验证（每种风格至少一次）

1. 创建项目 → 选风格 → AI 描述"一个 3 层 web 架构（前端 + API 网关 + 三个微服务 + 两个数据库 + Redis 缓存）"
2. 确认渲染、风格符合预期
3. 切换源码视图 → 改一个节点颜色 → 画布同步
4. 导出 SVG、PNG、源码三种格式
5. 关项目重开 → 内容保留
6. 缩略图正确显示在 Projects 页

### 回归

- mermaid / excalidraw / drawio 三个引擎全流程仍正常
- IndexedDB 迁移后旧项目可读

## 11. 风险与缓解

| 风险 | 缓解 |
|---|---|
| AI 返回非纯 SVG（带 ```svg```、HTML 外壳） | prompt 强约束 + validator 容错（剥离 fence、提取首个 `<svg>`） |
| 风格 prompt 调出来的图不达预期 | 4 个风格各内置 1 个 few-shot 示例 SVG |
| iframe 高度自适应 | 通过 SVG viewBox + 父容器 `100%` 高度处理；不依赖 postMessage 同步高度 |
| Google Fonts CDN 故障导致字体回退 | 模板提供 `font-family: 'JetBrains Mono', monospace` 等回退栈 |
| 项目数据库迁移失败 | Dexie schema 升版 + 迁移 try/catch，旧版本字段缺失视为非 html |

## 12. 里程碑

1. **基础打通**：类型 + db 迁移 + 一个最简 dark-tech 外壳 + HtmlRenderer 能跑通"硬编码 SVG"渲染
2. **AI 链路**：html.ts prompt + promptBuilder 改造 + useAIGenerate，单风格端到端
3. **多风格**：4 个外壳 + 风格卡选择 UI + prompt 风格分支
4. **工具链**：Monaco 编辑 + 导出三件套 + 缩略图
5. **加固**：validator + 测试 + CHANGELOG

每个里程碑结束后跑回归手测。
