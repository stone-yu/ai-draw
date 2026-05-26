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
  // Stub — replaced with real ppt prompt in Task 7
  'html-ppt': (ctx) => buildHtmlSystemPrompt(ctx.styleVariant ?? 'dark-tech'),
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

/**
 * Build user prompt for initial generation
 * @param userInput - User's description
 * @param useTwoPhase - Whether to use two-phase generation (for drawio/excalidraw) or single-phase (for mermaid)
 * @param phase - Phase of two-phase generation ('elements' or 'links'), ignored if useTwoPhase is false
 * @param elementsOutput - Output from elements phase, required for 'links' phase
 */
export function buildInitialPrompt(
  userInput: string,
  useTwoPhase: boolean,
  phase?: 'elements' | 'links',
  elementsOutput?: string
): string {
  // Single-phase generation (for mermaid)
  if (!useTwoPhase) {
    return `用户需求：
"""
${userInput}
"""

根据以上需求，生成完整的图表代码。`
  }

  // Two-phase generation (for drawio/excalidraw)
  if (phase === 'elements') {
    return `用户需求：
"""
${userInput}
"""

根据以上需求，识别并列出所有必要的图表节点和组件。
仅输出包含节点/形状的数据结构，暂不创建任何连接或连线。`
  }

  return `原始需求：
"""
${userInput}
"""

已生成的元素：
"""
${elementsOutput}
"""

根据这些元素，建立它们之间的逻辑连接、箭头和层级关系。
输出最终完整的图表代码。`
}

/**
 * Build user prompt for secondary editing
 */
export function buildEditPrompt(
  currentCode: string,
  userInput: string
): string {
  // 提取当前图表中的 cell ID 列表，帮助 AI 了解可用元素
  const cellIds = extractCellIds(currentCode)
  const cellIdsList = cellIds.length > 0
    ? `当前图表中的元素 ID：${cellIds.slice(0, 20).join(', ')}${cellIds.length > 20 ? ' ...' : ''}`
    : '当前图表暂无可见元素'

  return `当前图表 XML 内容：
\`\`\`xml
${currentCode}
\`\`\`

${cellIdsList}

用户修改请求："""${userInput}"""

根据用户修改请求进行修改。

## 修改指南
判断修改范围，选择合适的方式：

### 小修改（推荐局部修改）
如果只是修改文字、颜色、位置，或添加/删除少量元素，使用局部修改格式：
\`<edit_operations>[{"operation": "update|add|delete", "cell_id": "...", "new_xml": "..."}]</edit_operations>\`

示例 - 修改节点文字：
<edit_operations>
[{"operation": "update", "cell_id": "3", "new_xml": "<mxCell id=\\"3\\" value=\\"新文本\\" style=\\"rounded=1;whiteSpace=wrap;html=1;\\" vertex=\\"1\\" parent=\\"1\\">\\n  <mxGeometry x=\\"100\\" y=\\"100\\" width=\\"120\\" height=\\"60\\" as=\\"geometry\\"/>\\n</mxCell>"}]
</edit_operations>

示例 - 删除节点：
<edit_operations>
[{"operation": "delete", "cell_id": "5"}]
</edit_operations>

示例 - 添加新节点：
<edit_operations>
[{"operation": "add", "cell_id": "new1", "new_xml": "<mxCell id=\\"new1\\" value=\\"新节点\\" style=\\"rounded=1;whiteSpace=wrap;html=1;\\" vertex=\\"1\\" parent=\\"1\\">\\n  <mxGeometry x=\\"400\\" y=\\"200\\" width=\\"120\\" height=\\"60\\" as=\\"geometry\\"/>\\n</mxCell>"}]
</edit_operations>

### 大修改（全量重新生成）
如果用户要求完全重新设计、大幅结构调整，直接输出完整的 XML。

请输出 <plan>...</plan> 和修改内容。`
}

/**
 * Extract cell IDs from draw.io XML for reference
 */
function extractCellIds(xml: string): string[] {
  const ids: string[] = []
  const idPattern = /<mxCell[^>]*\bid=["']([^"']+)["'][^>]*>/g
  let match
  while ((match = idPattern.exec(xml)) !== null) {
    const id = match[1]
    // Skip root cells (0 and 1)
    if (id !== '0' && id !== '1') {
      ids.push(id)
    }
  }
  return ids
}

/**
 * Extract code from AI response
 * Handles markdown code blocks and plain text
 */
export function extractCode(response: string, engineType: EngineType): string {
  let code = response.trim()

  // Reasoning models (DeepSeek R1, Qwen QwQ, etc.) emit a <think>...</think>
  // block before their real answer. The block often contains pseudo-SVG
  // examples and natural-language code sketches; if we don't strip it first,
  // the greedy <svg> regex below grabs from the first <svg-looking thing in
  // the thinking down to the real </svg>, polluting the result with prose.
  // Strategy: if a </think> appears anywhere, discard everything up to and
  // including it. Works whether or not the opening <think> tag is present.
  const lastThinkClose = code.lastIndexOf('</think>')
  if (lastThinkClose !== -1) {
    code = code.slice(lastThinkClose + '</think>'.length).trim()
  }

  // Remove plan if present
  const planMatch = code.match(/<plan>[\s\S]*?<\/plan>/)
  if (planMatch) {
    code = code.replace(planMatch[0], '').trim()
  }

  // For html engine, prefer the outermost <svg>...</svg> block in the response.
  // Use a greedy match so nested <svg> (e.g., icon glyphs inside the main svg)
  // do not cause us to truncate at the first inner </svg>.
  if (engineType === 'html') {
    const svgMatch = code.match(/<svg\b[\s\S]*<\/svg\s*>/i)
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
  // This removes trailing markers like [done], extra text, or incomplete data
  if (engineType === 'excalidraw') {
    code = truncateAfterCompleteJSON(code)
  }

  return code
}

/**
 * Truncate string after the first complete JSON structure (array or object)
 * This removes any trailing content like [done], extra text, etc.
 */
function truncateAfterCompleteJSON(text: string): string {
  text = text.trim()
  if (!text) return text

  // Determine if it's an array or object
  const firstChar = text[0]
  if (firstChar !== '[' && firstChar !== '{') {
    return text // Not JSON, return as-is
  }

  let depth = 0
  let inString = false
  let escapeNext = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]

    if (escapeNext) {
      escapeNext = false
      continue
    }

    if (char === '\\' && inString) {
      escapeNext = true
      continue
    }

    if (char === '"' && !escapeNext) {
      inString = !inString
      continue
    }

    if (inString) continue

    if (char === '[' || char === '{') {
      depth++
    } else if (char === ']' || char === '}') {
      depth--
      if (depth === 0) {
        // Found the end of the complete JSON structure
        return text.substring(0, i + 1).trim()
      }
    }
  }

  // If we didn't find a complete structure, return the whole text
  return text
}
