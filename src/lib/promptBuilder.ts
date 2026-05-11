import type {EngineType} from '@/types'
import {drawioSystemPrompt, excalidrawSystemPrompt, mermaidSystemPrompt} from './prompts'
import {stripThinkBlocks} from './xmlUtils'

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

// drawio-only: initial generation via <edit_operations> add-ops against empty canvas, so we never stream partial <mxGraphModel> to drawio's iframe loader.
export function buildInitialOperationsPrompt(userInput: string): string {
  return `当前画布为空（仅含根 cell id="0" 和 id="1"）。

用户需求："""${userInput}"""

请规划并生成图表，**必须**以局部修改格式（\`<edit_operations>\`）输出，全部为 \`add\` 操作。
- 从 cell_id="2" 开始递增分配 ID。
- 每个 add 的 new_xml 必须是单个完整 \`<mxCell ...>...</mxCell>\` 字符串，含 \`<mxGeometry .../>\` 等子元素；XML 内的双引号在 JSON 字符串里转义为 \\".
- 不要输出 \`<mxGraphModel>\` 包裹结构；不要使用 Markdown 代码块。
- 先输出 \`<plan>...</plan>\` 简述布局策略，再输出 \`<edit_operations>[...]</edit_operations>\`。

示例：
<plan>从上到下三层流程：开始 → 处理 → 结束。</plan>
<edit_operations>
[
  {"operation": "add", "cell_id": "2", "new_xml": "<mxCell id=\\"2\\" value=\\"开始\\" style=\\"ellipse;whiteSpace=wrap;html=1;fillColor=#d5e8d4;strokeColor=#82b366;\\" vertex=\\"1\\" parent=\\"1\\"><mxGeometry x=\\"200\\" y=\\"40\\" width=\\"120\\" height=\\"60\\" as=\\"geometry\\"/></mxCell>"},
  {"operation": "add", "cell_id": "3", "new_xml": "<mxCell id=\\"3\\" value=\\"处理\\" style=\\"rounded=1;whiteSpace=wrap;html=1;\\" vertex=\\"1\\" parent=\\"1\\"><mxGeometry x=\\"200\\" y=\\"160\\" width=\\"120\\" height=\\"60\\" as=\\"geometry\\"/></mxCell>"},
  {"operation": "add", "cell_id": "4", "new_xml": "<mxCell id=\\"4\\" style=\\"edgeStyle=orthogonalEdgeStyle;endArrow=classic;\\" edge=\\"1\\" parent=\\"1\\" source=\\"2\\" target=\\"3\\"><mxGeometry relative=\\"1\\" as=\\"geometry\\"/></mxCell>"}
]
</edit_operations>`
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
  let code = stripThinkBlocks(response.trim())

  // Remove plan if present
  const planMatch = code.match(/<plan>[\s\S]*?<\/plan>/)
  if (planMatch) {
    code = code.replace(planMatch[0], '').trim()
  }

  // For drawio: slice to the <mxfile> or <mxGraphModel> boundary so AI-invented
  // wrappers (<draw-diagram>...) or trailers (<summary>...) don't poison DOMParser.
  if (engineType === 'drawio') {
    const mxfileStart = code.search(/<mxfile\b/i)
    if (mxfileStart >= 0) {
      const closeIdx = code.lastIndexOf('</mxfile>')
      if (closeIdx > mxfileStart) {
        code = code.substring(mxfileStart, closeIdx + '</mxfile>'.length)
      } else {
        code = code.substring(mxfileStart)
      }
    } else {
      const mxGraphStart = code.search(/<mxGraphModel\b/i)
      if (mxGraphStart >= 0) {
        const closeIdx = code.lastIndexOf('</mxGraphModel>')
        if (closeIdx > mxGraphStart) {
          code = code.substring(mxGraphStart, closeIdx + '</mxGraphModel>'.length)
        } else {
          code = code.substring(mxGraphStart)
        }
      }
    }
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
