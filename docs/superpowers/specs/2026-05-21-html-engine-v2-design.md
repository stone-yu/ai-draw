# HTML Engine v2 + HTML PPT Engine 集成设计

- 日期：2026-05-21
- 分支：`feat/html-engine`（继续开发，未合并主分支）
- 上游参考：`~/workspace/myprojects/ai-draw-skill/`（v0.3+）
- 取代：`docs/superpowers/specs/2026-05-11-html-engine-design.md`（旧 4 风格 html 设计）

## 1. 背景与目标

5 月 11 日上线的 `html` 引擎只支持 4 个手写风格（dark-tech / flat-icon / blueprint / claude-official），AI 输出限于纯 SVG 片段，外壳由前端 4 个模板拼接。同期，参考项目 `ai-draw-skill` 已经把"画图 / PPT"两条工作流统一为：

- 12 个画图主题 × 7 种 diagram type（架构 / 知识图谱 / 流程 / 时序 / 思维导图 / 类图 / ER 图）
- 36 个 PPT 主题 × 15 个 full-deck 模板（按 audience 分组）
- 主题 CSS 通过 CDN 分发（jsdelivr → `stone-yu/ai-draw-skill@main/assets/`）
- AI 直接输出完整 HTML 片段（含 `<section class="slide">` 列表用于 PPT）

本期一次性把 ai-draw 升级到这套架构：把现 `html` 引擎换成 skill v2（12 主题 + AI 自主选 type），并新增独立的 `html-ppt` 引擎用于多页演讲稿。

成功标准：

- 用户可新建 `html` 项目，从 12 主题里挑一个，AI 根据 prompt 自动选 diagram type，渲染产出与 skill 单图模式视觉一致
- 用户可新建 `html-ppt` 项目，先选 audience，再选 PPT 主题，AI 生成完整多页 deck，iframe 可左右键翻页 + 新窗口全屏
- 旧 4 风格 html 项目在不改数据的情况下继续可打开（运行时按映射表渲染）
- 其它 3 个引擎（mermaid / excalidraw / drawio）行为零变化

## 2. 范围

### In-scope

- `EngineType` 新增 `'html-ppt'`，`'html'` 沿用但行为大改
- 12 个画图主题 + 36 个 PPT 主题元数据手写为常量（一次性同步自 skill `references/themes.md`）
- 主题 CSS 走 CDN（jsdelivr），iframe srcdoc 注入 `<link>`
- AI 输出契约从 "纯 SVG" 改为 "完整 HTML 片段"（含 `<style>` 与语义 class）
- HTML PPT 渲染：iframe + 左下角导航 + 键盘 ←/→ 翻页（父页面 postMessage 控制） + 新窗口全屏
- HTML PPT Monaco 编辑：按 `<section class="slide">` 拆 tab，每个 slide 独立编辑后重组
- HTML PPT 导出：完整 HTML 文件下载
- 旧 4 风格 styleVariant 通过运行时 mapping 表对齐到 12 新主题（无 Dexie migration）
- HomePage 快速开始：defaultEngine=html 弹主题选择对话框；defaultEngine=html-ppt 弹两步式（audience + 主题）对话框
- CreateProjectDialog：新增 html-ppt 入口；html 改为 12 主题卡片网格；html-ppt 二段选择

### Out-of-scope（明确不做）

- skill 的 `--mode site` 多页站点
- skill 的 `add` / `redo` / `export png` 子命令（ai-draw 已有 export）
- 真正的 PPT 编辑器（演讲者备注 / 动画时间轴 / 过渡）
- PDF 导出（只导 HTML）
- 当前页 PNG 截图（PPT），html-ppt 只导 HTML
- HTML PPT 的 `<script>` 支持（出于安全，sandbox 禁 scripts，动画用纯 CSS）
- 主题 CSS 离线缓存（CDN 抖动时接受白屏，先观察）
- 8 个 skill PPT 主题家族子分组（先扁平 36 个）

## 3. 数据模型

### 3.1 类型扩展

```ts
// src/types/index.ts
export type EngineType = 'mermaid' | 'excalidraw' | 'drawio' | 'html' | 'html-ppt'

// styleVariant 从 union 改成 string，运行时 normalize
// html 项目：值是 12 主题之一，或旧 4 个 legacy 值（运行时映射）
// html-ppt 项目：值是 36 主题之一
export interface Project {
  id: string
  title: string
  engineType: EngineType
  styleVariant?: string
  pptAudience?: PptAudience // 仅 html-ppt 使用
  content: string
  // ... 其它已有字段
}

export type PptAudience =
  | 'engineers'   // 技术分享
  | 'execs'       // 高管 / 董事会
  | 'xhs'         // 小红书 / 卡片
  | 'students'    // 学术 / 教学
  | 'vc'          // 投资人 / 路演
  | 'internal'    // 内部汇报 / 周报
```

### 3.2 Dexie schema

无需 v3 升级。`styleVariant` 索引在 v2 已建。`pptAudience` 不建索引（仅按 project 主键查询）。

### 3.3 Legacy styleVariant 映射

```ts
// src/lib/skillThemes/legacy-mapping.ts
export const LEGACY_HTML_THEME_MAP: Record<string, string> = {
  'dark-tech':       'tech-dark',
  'flat-icon':       'saas-modern',
  'blueprint':       'blueprint',
  'claude-official': 'xhs-soft',
}

// 渲染前 normalize：
// const theme = LEGACY_HTML_THEME_MAP[project.styleVariant ?? ''] ?? project.styleVariant ?? 'tech-dark'
```

旧项目数据不动；只在 buildSrcDoc / prompt 读取 styleVariant 的地方过一遍 normalize。

## 4. 主题元数据组织

```
src/lib/skillThemes/
├── index.ts              # 导出 + normalize 函数
├── diagram-themes.ts     # 12 个 DiagramTheme
├── ppt-themes.ts         # 36 个 PptTheme（带 audience 推荐 tag）
├── ppt-decks.ts          # 15 个 PptDeckTemplate（audience + sectionStructure）
└── legacy-mapping.ts     # 旧 4 styleVariant → 新 12 主题
```

```ts
// diagram-themes.ts 样例
export interface DiagramTheme {
  id: string                                                   // 'tech-dark'
  name: string                                                 // 'Tech Dark'
  family: 'tech' | 'business' | 'minimalist' | 'colorful'
  cdnPath: string                                              // 'themes-diagram/tech-dark.css'
  recommendedTypes: DiagramType[]                              // ['architecture', 'flowchart', ...]
  description: string
}

export const DIAGRAM_THEMES: DiagramTheme[] = [
  { id: 'tech-dark',       name: 'Tech Dark',        family: 'tech',       description: '暗色技术风' },
  { id: 'blueprint',       name: 'Blueprint',        family: 'tech',       description: '蓝图工程图' },
  { id: 'business-clean',  name: 'Business Clean',   family: 'business',   description: '商务正式米白' },
  { id: 'xhs-soft',        name: 'XHS Soft',         family: 'colorful',   description: '小红书柔色卡片' },
  { id: 'cyberpunk-neon',  name: 'Cyberpunk Neon',   family: 'colorful',   description: '赛博朋克霓虹' },
  { id: 'minimal-light',   name: 'Minimal Light',    family: 'minimalist', description: '极简白纸' },
  { id: 'academic-paper',  name: 'Academic Paper',   family: 'minimalist', description: '学术论文' },
  { id: 'hand-drawn',      name: 'Hand Drawn',       family: 'colorful',   description: '手绘草图' },
  { id: 'saas-modern',     name: 'SaaS Modern',      family: 'business',   description: '现代 SaaS' },
  { id: 'glassmorphism',   name: 'Glassmorphism',    family: 'colorful',   description: 'Apple 毛玻璃' },
  { id: 'linear-mode',     name: 'Linear Mode',      family: 'tech',       description: 'Linear 风深蓝' },
  { id: 'neo-brutalism',   name: 'Neo Brutalism',    family: 'colorful',   description: '厚描边硬阴影' },
  // cdnPath / recommendedTypes 补全
]
```

PPT 主题元数据按 audience 分组（skill themes.md 的 6 个分组：商务/技术/小红书/学术/赛博/极简/设计）：

```ts
// ppt-themes.ts 样例
export interface PptTheme {
  id: string                          // 'tokyo-night'
  name: string                        // 'Tokyo Night'
  audienceTags: PptAudience[]         // ['engineers', 'internal']
  cdnPath: string                     // 'themes-ppt/tokyo-night.css'
  description: string
}
```

15 个 full-deck 模板的 `sectionStructure` 是一个 slide 类型数组（如 `['cover', 'agenda', 'problem', 'solution', 'cta']`），仅供 prompt 注入给 AI 用，运行时不参与渲染。

## 5. CDN 资源约定

```
https://cdn.jsdelivr.net/gh/stone-yu/ai-draw-skill@main/assets/
├── base.css                       # 全局基础（reset + 排版）
├── themes-diagram/<id>.css        # 12 个
└── themes-ppt/<id>.css            # 36 个
```

**注入方式**：iframe srcdoc 的 `<head>` 拼 `<link>`：

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/stone-yu/ai-draw-skill@main/assets/base.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/stone-yu/ai-draw-skill@main/assets/themes-diagram/tech-dark.css">
```

**CDN 抖动**：本期不做缓存降级。若上线后白屏问题反馈多，再加 IndexedDB 缓存。

**前端白名单**：sanitize 时只允许 `<link>` href 以 `https://cdn.jsdelivr.net/gh/stone-yu/ai-draw-skill@` 开头的 URL，其它一律剥离。

## 6. AI 输出契约

### 6.1 html 引擎输出

**头注释**：`<!-- type:<diagram-type> theme:<theme-id> -->`（前端解析用，可选）

**Body**：完整 HTML 片段，AI 自由使用 skill 主题 CSS 提供的 class（如 `.diagram` / `.node` / `.edge` / `.legend`），允许内联 `<style>` 做局部覆盖。

```html
<!-- type:architecture theme:tech-dark -->
<article class="diagram architecture-diagram">
  <header>
    <h1>支付系统三层架构</h1>
  </header>
  <div class="layer-stack">
    <div class="layer frontend">
      <h2>前端层</h2>
      <ul class="components">
        <li class="node">Web</li>
        <li class="node">Mobile</li>
      </ul>
    </div>
    <!-- ... -->
  </div>
</article>
```

Sanitize 规则：剥离 `<script>` / `on*=` / `javascript:` URL；只保留 CDN 白名单内的 `<link>` 和 inline `<style>`。

### 6.2 html-ppt 引擎输出

**头注释**：`<!-- audience:<audience> theme:<theme-id> -->`

**Body**：`<section class="slide">` 列表（5–15 张）。每个 slide 可加 `data-slide-index` 与 `data-slide-title` 属性辅助前端导航。

```html
<!-- audience:engineers theme:tokyo-night -->
<section class="slide" data-slide-index="0" data-slide-title="封面">
  <h1>分布式追踪系统设计</h1>
  <p class="subtitle">A/B 测试场景下的全链路观测</p>
</section>
<section class="slide" data-slide-index="1" data-slide-title="议程">
  <h2>本次分享议程</h2>
  <ol>...</ol>
</section>
<!-- ... -->
```

Sanitize：同 html 引擎，外加禁所有 `<script>`（PPT 不支持脚本）。

### 6.3 Prompt 注入 audience / theme / deck 骨架

`buildHtmlPptSystemPrompt({ audience, theme, deckTemplate })` 把如下信息塞进 system prompt：

- 主题 CSS 提供的 token（`--bg` / `--text-1` / `--accent` ...）和示例 class（`.slide`, `.cover`, `.chapter`）
- audience 对应的语气提示（engineers→偏代码示例；execs→偏结论+数据；xhs→偏短句+视觉冲击）
- 推荐 deckTemplate 的 sectionStructure 骨架（如 `['cover','agenda','problem','solution','metrics','cta']`），AI 可微调但应大致遵循
- 强约束：只输出 `<section class="slide">` 序列，不输出 `<html>` 外壳；不使用 `<script>`；每页 ≤ 200 字

## 7. Renderer 设计

### 7.1 HtmlRenderer（v2）

文件：`src/features/engines/html/HtmlRenderer.tsx`（沿用，重构内部）

变更：
- `buildSrcDoc` 改为：`<head>` 注入 base.css + 主题 CSS link + 默认 viewport；`<body>` 直接放 AI 输出的 HTML 片段
- Monaco 编辑整段 HTML（不再是 SVG）
- 导出：`exportAsHtml` 取代旧 `exportAsSvg`，`exportAsPng` 改用 iframe screenshot 思路（或先做"复制 HTML 到剪贴板"，PNG 后续）
- `openInNewWindow` 保留

### 7.2 HtmlPptRenderer（新）

文件：`src/features/engines/html-ppt/HtmlPptRenderer.tsx`

```
┌────────────────────────────────────────────────────┐
│  HtmlPptRenderer                                   │
│  ┌──────────────────────────────────────────────┐  │
│  │  iframe srcdoc (sandbox="allow-same-origin") │  │
│  │   <head>  base.css + theme.css + nav.css     │  │
│  │   <body>  scrollable .deck                   │  │
│  │     <section class="slide">…</section> *N    │  │
│  │  CSS：默认隐藏非当前页，scroll-snap 单页   │  │
│  └──────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────┐  │
│  │  Bottom bar: ◀ 3 / 12 ▶  [全屏] [导出 HTML] │  │
│  └──────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────┘
```

**翻页机制**（无 script）：
- 父页面监听 `keydown` （←/→/Space）
- 通过更新 iframe 的 srcdoc 中 `body` 的 `data-active-index` 属性，配合 CSS `[data-active-index="N"] .slide:not(:nth-of-type(N+1)) { display: none }` 实现切页
- 因为 srcdoc 无法修改，采用 `iframe.contentDocument.body.dataset.activeIndex = String(i)` 直接改 DOM（sandbox `allow-same-origin` 允许父访问）

**slide 导航 UI**：父页面 React 组件 `<SlideNav>`：当前页/总页数、左右按钮、键盘提示。

**新窗口全屏预览**：把当前 srcdoc 写入新 `window.open()` 的 document，附加翻页 script（独立窗口可放 script，因为不再受主站 sandbox 限制；要明确告知用户这是离线 HTML 副本）。

**导出 HTML**：把 iframe srcdoc 内容（含 `<script>` 翻页代码）写成 Blob 触发下载。导出版可以带翻页 script，因为是给用户下载到本地的独立文件。

### 7.3 Slide Tab Monaco 编辑器

文件：`src/features/engines/html-ppt/MultiSlideEditor.tsx`

工作流：
1. 读 Project.content（整段 HTML）
2. DOMParser 解析出 `<section class="slide">` 列表
3. 每个 slide 渲染为一个 tab，tab 名固定 `Slide 1` / `Slide 2` /…（决策点 5A）
4. 用户在一个 tab 中编辑 → 监听 change → 重组整段 HTML → 写回 Project.content
5. 解析失败 fallback：整段 HTML 单 tab 编辑 + 顶部 warning banner

数据一致性：每次 tab 切换写盘一次，避免编辑中途丢失。

## 8. UI 集成

### 8.1 CreateProjectDialog

第一步：Engine select 多 2 项（HTML / HTML PPT）

**HTML 分支**：
- 露出 12 主题卡片网格，按 family 分组（tech / business / minimalist / colorful）
- 每张卡片：主题名 + 一句话描述 + 缩略图占位（暂用色块）
- 默认选中 `tech-dark`

**HTML PPT 分支**（两段式）：
- 第一段：6 个 audience 卡片（engineers / execs / xhs / students / vc / internal）
- 第二段：根据 audience 露出推荐的 PPT 主题子集（按 `audienceTags` 过滤的 36 主题）
- 默认：audience=`engineers`, theme=`tokyo-night`

### 8.2 HomePage 快速开始

`defaultEngine=html` → 发送前弹"主题选择对话框"（复用现 StylePickerDialog，列表换成 12 主题）

`defaultEngine=html-ppt` → 弹"两步对话框"：第一步选 audience，第二步选主题（带二次确认按钮）

### 8.3 EditorPage

- "新窗口预览" 按钮：html / html-ppt 都保留
- "导出" 按钮按 engine 类型展开下拉：
  - html：HTML / PNG / 源码
  - html-ppt：HTML deck（首期只这一个）

### 8.4 ENGINES 常量

`src/constants/index.ts`：
```ts
export const ENGINES = [
  { id: 'mermaid',  name: 'Mermaid',     icon: '...' },
  { id: 'excalidraw', name: 'Excalidraw', icon: '...' },
  { id: 'drawio',   name: 'Draw.io',     icon: '...' },
  { id: 'html',     name: 'HTML 图',     icon: '...' },
  { id: 'html-ppt', name: 'HTML PPT',    icon: '...' },
]
```

## 9. 安全

- iframe sandbox：
  - html：`sandbox="allow-same-origin"`（同 v1）
  - html-ppt：`sandbox="allow-same-origin"`（无 `allow-scripts`，翻页用父页面 postMessage / DOM 修改）
- Sanitize（`src/lib/validators/html.ts`，重构）：
  - 剥离所有 `<script>` 元素
  - 剥离所有 `on*=` 属性
  - 剥离 `javascript:` URL
  - 剥离 `<link>` 除非 href 以 CDN 白名单前缀开头
  - 剥离 `<iframe>` / `<object>` / `<embed>`
  - 保留 `<style>` 内联
- 新窗口预览：弹出独立文档，明确告知用户"这是独立 HTML 文件，外部资源由 CDN 加载"

## 10. 文件改动清单

### 新增（约 12 个）

```
src/lib/skillThemes/
├── index.ts
├── diagram-themes.ts
├── ppt-themes.ts
├── ppt-decks.ts
└── legacy-mapping.ts

src/lib/htmlPpt/
├── parser.ts                    # DOMParser 拆 slide
└── srcdocBuilder.ts             # iframe srcdoc 模板

src/lib/prompts/htmlPpt.ts       # buildHtmlPptSystemPrompt

src/features/engines/html-ppt/
├── HtmlPptRenderer.tsx
├── SlideNav.tsx
└── MultiSlideEditor.tsx

src/components/layout/PptAudienceDialog.tsx
```

### 修改（约 12 个）

```
src/types/index.ts                            # +'html-ppt', PptAudience, styleVariant 改 string
src/lib/prompts/html.ts                       # 重写为 skill 12 主题 + AI 自主选 type
src/lib/htmlShells/index.ts                   # 缩减到 1 个通用 buildSrcDoc
src/lib/htmlShells/<4 个旧 shell>.ts          # 删除
src/lib/promptBuilder.ts                      # 注册 html-ppt resolver
src/lib/validators/html.ts                    # 适配 HTML 而非 SVG，加 CDN 白名单
src/lib/thumbnail.ts                          # html / html-ppt 缩略图（iframe screenshot 或占位）
src/services/projectRepository.ts             # 默认 styleVariant for html-ppt
src/features/engines/html/HtmlRenderer.tsx    # 切到 HTML 输出 + 12 主题
src/features/editor/CanvasArea.tsx            # 接入 html-ppt 引擎
src/components/layout/CreateProjectDialog.tsx # 12 主题卡片 + html-ppt 二段选择
src/pages/HomePage.tsx                        # 默认 html-ppt 时弹两步对话框
src/constants/index.ts                        # ENGINES + HTML_THEMES
src/hooks/useAIGenerate.ts                    # 注入 audience/deckTemplate 到 prompt ctx
```

### 保留不动

- `src/services/db.ts`（Dexie v2 schema 已足够）
- `src/stores/*`（无 schema 变化）
- 旧 4 个 html 项目数据（运行时通过 LEGACY_HTML_THEME_MAP 映射）

## 11. 风险与缓解

| 风险 | 影响 | 缓解 |
|---|---|---|
| jsdelivr CDN 抖动 | iframe 白屏 | 本期接受；上线后观察，若问题大再加 IndexedDB 缓存 |
| AI 输出契约改变（SVG→HTML） | 旧 prompt 全部失效，需重写 | 一次性重写 `prompts/html.ts`；保留 legacy SVG 兼容渲染（如果 AI 还输出 `<svg>`，包一层 `<article class="diagram">`） |
| Slide 解析失败 | Monaco 退化为单 tab | 顶部 warning banner + 整段编辑兜底 |
| HTML PPT 文件大（30+ KB） | IndexedDB 写入慢 | 实测：50 张 slide ~80KB，IndexedDB 单 row 限制 MB 级，无问题 |
| skill 上游主题改名 | 我们的 const 数组失效 | 手抄锁版本到 `@main`；后续若上游变更，手动同步 |
| 新窗口预览的 script 注入 | 独立 HTML 文件含可执行 JS | 明确告知用户；script 仅含翻页逻辑，不含网络请求 |
| 旧项目 styleVariant 映射不准 | 视觉与原来不一致 | LEGACY_HTML_THEME_MAP 是软映射；如果反馈不对，调整映射表即可（数据不动） |

## 12. 验收

### 端到端测试 case

1. **新建 html 项目（tech-dark）**：选 12 主题里的 tech-dark，输入 "画一个三层 Web 架构"，AI 生成 HTML，iframe 正确显示暗色技术风架构图
2. **新建 html 项目（cyberpunk-neon）**：换主题，重新生成，视觉风格切换正确
3. **新建 html-ppt 项目（engineers + tokyo-night）**：输入 "做一个分布式追踪系统的 10 页技术分享"，AI 生成 10 张 slide，iframe 显示第 1 页，按 → 翻到第 2 页，再按 → 翻第 3 页
4. **键盘导航**：在 html-ppt 视图中焦点在画布，按 ←/→/Space 可翻页
5. **新窗口全屏**：点 "新窗口预览"，独立 tab 打开，依然可翻页（带 script）
6. **slide tab 编辑**：进入 html-ppt 源码视图，看到 N 个 tab，编辑 Slide 3 文字，保存，预览看到 Slide 3 内容已更新
7. **导出 HTML**：点导出，下载 .html 文件，双击在浏览器中打开，主题与翻页都正常
8. **旧 html 项目（dark-tech）打开**：取数据库里 5 月 11 日创建的 dark-tech 项目，可正常打开，视觉切到 tech-dark（运行时映射）
9. **HomePage 快速开始（defaultEngine=html）**：在首页直接输入 prompt 发送，弹"主题选择"对话框，选 saas-modern + 确认，进入创建并生成
10. **HomePage 快速开始（defaultEngine=html-ppt）**：弹两步对话框，先选 audience=execs，再选主题 corporate-clean，确认，进入创建并生成

### 非功能

- 主题切换响应时间：用户切主题（在创建对话框里）→ 预览缩略图渲染 < 200ms（CDN 命中后）
- iframe 初次加载：< 1s（CDN 命中后；首屏 base.css 12KB + 主题 CSS 3-8KB）
- 单 PPT 项目最大 slide 数：100（性能合理上限）

## 13. 实施分阶段（writing-plans 时拆）

实施时按 5 个独立 task 推进，每个 task 完成后可独立 review：

1. **主题元数据 + legacy mapping**（`skillThemes/*`）
2. **prompt 体系重写**（`prompts/html.ts` + `prompts/htmlPpt.ts` + `promptBuilder.ts`）
3. **html v2 renderer 升级**（HtmlRenderer + buildSrcDoc + sanitize + legacy 兼容）
4. **html-ppt 引擎全套**（renderer + nav + multi-slide editor + parser + 导出）
5. **UI 集成**（CreateProjectDialog 12 主题卡片 + PPT 两段对话框 + HomePage 快速开始 + EditorPage 导出菜单）

每个 task 自带 self-check（手动浏览器验证 + ESLint + tsc）。
