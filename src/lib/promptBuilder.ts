import type {EngineType} from '@/types'
import {drawioSystemPrompt, excalidrawSystemPrompt, mermaidSystemPrompt} from './prompts'

/**
 * System prompts for different engines
 */
export const SYSTEM_PROMPTS: Record<EngineType, string> = {
  mermaid: mermaidSystemPrompt,
  excalidraw: excalidrawSystemPrompt,
  drawio: drawioSystemPrompt,
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
  return `当前图表内容：
"""
${currentCode}
"""

用户修改请求："""${userInput}"""

根据用户修改请求进行修改。

## 修改指南
1. **全量输出**：必须输出包含所有原有元素的完整 XML 代码，严禁只输出修改部分。
2. **文本格式**：确保所有包含文本的节点都有 \`whiteSpace=wrap;html=1;\` 样式。
3. **布局保持**：对于未修改的部分，尽量保持原有的坐标和布局。
4. **连线优化**：如果移动了节点，请确保连线（edge）路径重新路由，避免穿过节点。

请输出 <plan>...</plan> 和完整的 XML 代码。`
}

/**
 * Extract code from AI response
 * Handles markdown code blocks and plain text
 */
export function extractCode(response: string, engineType: EngineType): string {
  let code = response.trim()

  // Remove plan if present
  const planMatch = code.match(/<plan>[\s\S]*?<\/plan>/)
  if (planMatch) {
    code = code.replace(planMatch[0], '').trim()
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
