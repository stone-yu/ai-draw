import {DocLayout} from '@/components/layout/DocLayout'
import {SimpleMarkdown} from '@/components/ui/SimpleMarkdown'
import {useSystemStore} from '@/stores/systemStore'

interface ChangelogItem {
  version: string
  date: string
  isLatest?: boolean
  content: { zh: string; en: string }
}

const CHANGELOG_DATA: ChangelogItem[] = [
  {
    version: 'v1.11.0',
    date: '2026-05-21',
    isLatest: true,
    content: {
      zh: `
#### ✨ 新增能力
- HTML 引擎升级到 ai-draw-skill v0.3：12 个主题（按 tech / business / minimalist / colorful 分组） × 7 种图类型（由 AI 自动识别）。
- 新增 **HTML-PPT** 引擎：36 个 PPT 主题 × 6 种受众场景，支持多页演讲稿、键盘 ← / → 翻页、新窗口全屏、按 slide 编辑。
- 主题 CSS 通过 jsdelivr CDN 分发（\`stone-yu/ai-draw-skill@main\`）。

#### 🛠 兼容性
- 旧 4 个 html 风格（dark-tech / flat-icon / blueprint / claude-official）通过运行时映射继续可用，旧项目无需迁移。
      `,
      en: `
#### ✨ New Features
- HTML engine upgraded to ai-draw-skill v0.3: 12 themes (grouped by tech / business / minimalist / colorful) × 7 diagram types (auto-detected by AI).
- New **HTML-PPT** engine: 36 PPT themes × 6 audience scenarios, supports multi-slide decks, keyboard ← / → navigation, full-screen new window, per-slide editing.
- Theme CSS distributed via jsdelivr CDN (\`stone-yu/ai-draw-skill@main\`).

#### 🛠 Compatibility
- The four legacy html styles (dark-tech / flat-icon / blueprint / claude-official) remain available via runtime mapping; existing projects need no migration.
      `
    }
  },
  {
    version: 'v1.10.0',
    date: '2026-05-11',
    isLatest: false,
    content: {
      zh: `
#### ✨ 新增能力
- 新增 HTML 引擎：AI 一次性输出 SVG 架构 / 技术图，前端按 4 种风格外壳（Dark Tech / Flat Icon / Blueprint / Claude Official）在沙箱 iframe 中渲染。
- 项目创建时支持选择 HTML 风格变体，创建后不可更改。
- HTML 引擎支持 Monaco SVG 源码查看 / 编辑，导出 SVG / PNG / 源码 三种格式。
- 内置 SVG 净化：脚本、\`on*\` 事件、\`javascript:\` URL 一律清除。
      `,
      en: `
#### ✨ New Features
- Added HTML engine: AI generates SVG architecture / technical diagrams in one pass; the frontend renders them inside a sandboxed iframe with one of four style shells (Dark Tech / Flat Icon / Blueprint / Claude Official).
- Style variant is selected at project creation time and cannot be changed afterwards.
- HTML engine supports Monaco SVG source code viewing / editing, and exports as SVG / PNG / source.
- Built-in SVG sanitization strips scripts, \`on*\` event handlers, and \`javascript:\` URLs.
      `
    }
  },
  {
    version: 'v1.9.6',
    date: '2026-05-11',
    isLatest: false,
    content: {
      zh: `
#### ✨ 新增能力
- 新增与 AI 对话历史存储功能。
- 新增 AI 思考过程中停止功能。
- 新增模型提供商维度设置最大输出 Tokens 限制功能。
#### 🛠 优化能力
- 优化一般模型输出质量兼容的鲁棒性。
      `,
      en: `
#### ✨ New Features
- Added AI chat history persistence.
- Added a stop button to interrupt AI generation while it is streaming.
- Added per-provider max output tokens setting.
#### 🛠 Improvements
- Improved robustness when handling general models with varying output quality.
      `
    }
  },
  {
    version: 'v1.9.2',
    date: '2026-02-24',
    isLatest: false,
    content: {
      zh: `
#### 🛠 优化能力
- 优化AI对话编辑文件能力。
    `,
      en: `
####  🛠 Improvements
- Optimize the AI's ability to edit dialogue files.
    `
    }
  },{
    version: 'v1.9.0',
    date: '2026-01-28',
    isLatest: false,
    content: {
      zh: `
#### ✨ 新增能力
- 多语言支持。
- 支持使用本地drawio组件。
    `,
      en: `
#### ✨ New Features
- The system supports multiple languages.
- Support using local drawio components.
    `
    }
  },{
    version: 'v1.8.0',
    date: '2026-01-21',
    isLatest: false,
    content: {
      zh: `
#### ✨ 新增能力
- AI模型配置，增加获取模型列表功能。
- 增加文件排序和分页功能。
#### 🛠 优化能力
- 优化本地模式下，模型信息传输的安全性。
    `,
      en: `
#### ✨ New Features
- AI model configuration: added model list retrieval function.
- Added file sorting and pagination features.
#### 🛠 Improvements
- Enhanced security of model information transmission in local mode.
    `
    }
  },
  {
    version: 'v1.7.0',
    date: '2026-01-17',
    isLatest: false,
    content: {
      zh: `
#### ✨ 新增能力
- 支持本地存储模式，保护隐私，无需登录即可使用。
- 增加管理员端使用情况统计能力。
#### 🛠 优化能力
- 修复本地和云端切换导致的用户登录状态变化问题。
- 优化云端模式文件和配置存储方式，将json文件改为数据库模式，兼容升级过程中的数据迁移。
- 优化模型返回图表信息不标准导致图表渲染异常问题。
      `,
      en: `
#### ✨ New Features
- Support for local storage mode to protect privacy, no login required.
- Added administrator-side usage statistics capabilities.
#### 🛠 Improvements
- Fixed user login status changes caused by switching between local and cloud modes.
- Optimized cloud mode file and configuration storage method, changed from JSON files to database mode, compatible with data migration during upgrades.
- Optimized chart rendering issues caused by non-standard chart information returned by models.
      `
    }
  },
  {
    version: 'v1.6.0',
    date: '2026-01-14',
    isLatest: false,
    content: {
      zh: `
#### ✨ 新增能力
- 支持动态绘图，ai对话过程中，动态生成图表，进度可见。
      `,
      en: `
#### ✨ New Features
- Support for dynamic drawing, generating charts dynamically during AI conversations with visible progress.
      `
    }
  },
  {
    version: 'v1.2.0',
    date: '2025-12-30',
    isLatest: false,
    content: {
      zh: `
#### ✨ 新增能力
- 增加用户注册登录功能，支持多用户管理。
- 支持云端同步模式，多端协作（需登录）。
      `,
      en: `
#### ✨ New Features
- Added user registration and login functionality, supporting multi-user management.
- Support for cloud synchronization mode, multi-device collaboration (login required).
      `
    }
  },
  {
    version: 'v1.1.0',
    date: '2025-12-30',
    isLatest: false,
    content: {
      zh: `
#### ✨ 新增能力
- 文件管理支持分组设置。
      `,
      en: `
#### ✨ New Features
- File management supports grouping settings.
      `
    }
  },
  {
    version: 'v1.0.0',
    date: '2025-12-29',
    isLatest: false,
    content: {
      zh: `
AI Draw 正式发布！带来全新的智能绘图体验。

#### ✨ 核心功能
- 集成 **Mermaid**, **Excalidraw**, **Draw.io** 三大主流绘图引擎。
- 支持自然语言对话生成图表，所想即所得。
- 支持多轮对话修改，精准控制图表细节。

#### 🛠 基础能力
- 支持文件管理。
- 历史版本管理，支持随时回滚。
      `,
      en: `
AI Draw is officially released! Bringing a brand new intelligent drawing experience.

#### ✨ Core Features
- Integrated **Mermaid**, **Excalidraw**, **Draw.io** three mainstream drawing engines.
- Support for natural language conversation to generate charts, what you think is what you get.
- Support for multi-turn conversation modification, precise control of chart details.

#### 🛠 Basic Capabilities
- Support for file management.
- Historical version management, support for rollback at any time.
      `
    }
  }
]

export function ChangelogPage() {
  const language = useSystemStore((state) => state.language)
  const i18nTexts = useSystemStore((state) => state.i18nTexts)

  return (
    <DocLayout title={i18nTexts.homeChangelog[language]}>
      <div className="space-y-12">
        {CHANGELOG_DATA.map((item) => (
          <div key={item.version} className="relative pl-8 border-l border-slate-200">
            <div className={`absolute -left-1.5 top-1.5 h-3 w-3 rounded-full border-2 border-white ${
              item.isLatest ? 'bg-primary ring-4 ring-primary/10' : 'bg-slate-300'
            }`}></div>
            <div className="mb-2 flex items-center gap-3">
              <span className="text-lg font-bold text-slate-900">{item.version}</span>
              {item.isLatest && (
                <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-medium">Latest</span>
              )}
              <span className="text-sm text-slate-500">{item.date}</span>
            </div>
            <SimpleMarkdown content={item.content[language]} />
          </div>
        ))}
      </div>
    </DocLayout>
  )
}

