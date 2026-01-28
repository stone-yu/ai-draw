import {DocLayout} from '@/components/layout/DocLayout'
import {SimpleMarkdown} from '@/components/ui/SimpleMarkdown'
import {useSystemStore} from '@/stores/systemStore'

const MANUAL_DATA = {
  zh: `
## 欢迎使用 AI Draw

AI Draw 是一个智能绘图平台，通过自然语言对话形式，即可快速生成流程图、时序图、架构图等各类图表。无需复杂的拖拽操作，让创意即刻呈现。

## 快速开始

### 1. 选择绘图引擎
在首页顶部选择适合的绘图引擎：
- **Mermaid**: 适合快速生成结构化图表，如流程图、时序图。
- **Excalidraw**: 手绘风格白板，适合头脑风暴和草图绘制。
- **Draw.io**: 专业级图表编辑，适合复杂的工程图和架构图。

### 2. 描述你的需求
在输入框中用自然语言描述你想画的图。例如：
> "画一个用户登录注册的流程图，包含忘记密码的流程"

### 3. AI 生成与编辑
点击发送后，AI 将自动生成图表。你可以：
- 在右侧画布预览生成的图表。
- 继续对话修改图表细节。
- 手动调整图表元素。
- 导出为 PNG, SVG 或源文件。

## 进阶功能

- **文件管理**: 支持创建多个项目，自动保存历史版本，随时回溯。
- **多模式**: 支持本地存储模式（数据仅保存在浏览器）和云端同步模式。
- **导入导出**: 支持导入现有文件进行编辑，支持导出多种格式。
`,
  en: `
## Welcome to AI Draw

AI Draw is an intelligent drawing platform that allows you to quickly generate flowcharts, sequence diagrams, architecture diagrams, and various other charts through natural language dialogue. No complex drag-and-drop operations required - bring your ideas to life instantly.

## Quick Start

### 1. Choose a Drawing Engine
Select a suitable drawing engine from the top of the homepage:
- **Mermaid**: Ideal for quickly generating structured diagrams such as flowcharts and sequence diagrams.
- **Excalidraw**: Hand-drawn style whiteboard, perfect for brainstorming and sketching.
- **Draw.io**: Professional-grade diagram editing, suitable for complex engineering and architecture diagrams.

### 2. Describe Your Requirements
Use natural language to describe the diagram you want to create in the input box. For example:
> "Create a user login and registration flowchart, including the forgot password process"

### 3. AI Generation and Editing
After clicking send, AI will automatically generate the diagram. You can:
- Preview the generated diagram on the right canvas.
- Continue the conversation to modify diagram details.
- Manually adjust diagram elements.
- Export as PNG, SVG, or source files.

## Advanced Features

- **File Management**: Support for creating multiple projects, automatic history saving, and rollback at any time.
- **Multiple Modes**: Support for local storage mode (data saved only in browser) and cloud sync mode.
- **Import & Export**: Support for importing existing files for editing and exporting in multiple formats.
`
}

export function ManualPage() {
  const language = useSystemStore((state) => state.language)
  const i18nTexts = useSystemStore((state) => state.i18nTexts)

  return (
    <DocLayout title={i18nTexts.homeUserManual[language]}>
      <SimpleMarkdown content={MANUAL_DATA[language]} />
    </DocLayout>
  )
}

