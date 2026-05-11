/**
 * Validators for different diagram engine outputs
 */

import type { EngineType } from '@/types'
import { validateHtmlSvg } from './html'

export interface ValidationResult {
  valid: boolean
  error?: string
}

/**
 * Mermaid code validator
 * Uses mermaid.parse() for syntax validation
 */
export async function validateMermaid(code: string): Promise<ValidationResult> {
  try {
    const mermaid = await import('mermaid')
    await mermaid.default.parse(code)
    return { valid: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid Mermaid syntax'
    return { valid: false, error: message }
  }
}

/**
 * Excalidraw JSON validator
 * Validates JSON format and required fields
 * Supports both array format (direct elements) and object format (with type/elements fields)
 */
export function validateExcalidraw(json: string): ValidationResult {
  try {
    const data = JSON.parse(json)

    // Determine elements array - support both formats:
    // 1. Direct array: [{ id, type, x, y, ... }, ...]
    // 2. Object format: { type: "excalidraw", elements: [...] }
    let elements: unknown[]

    if (Array.isArray(data)) {
      // Direct array format (AI-generated)
      elements = data
    } else if (data && typeof data === 'object') {
      // Object format with elements field
      if (!Array.isArray(data.elements)) {
        return { valid: false, error: 'Missing or invalid "elements" array' }
      }
      elements = data.elements
    } else {
      return { valid: false, error: 'Invalid format: expected array or object with elements' }
    }

    // Validate each element has required properties
    for (let i = 0; i < elements.length; i++) {
      const el = elements[i] as Record<string, unknown>

      // id is optional - Excalidraw will auto-generate if missing
      if (!el.type) {
        return { valid: false, error: `Element at index ${i} missing "type" field` }
      }
      if (typeof el.x !== 'number' || typeof el.y !== 'number') {
        return { valid: false, error: `Element at index ${i} missing or invalid "x"/"y" coordinates` }
      }
    }

    return { valid: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid JSON format'
    return { valid: false, error: message }
  }
}

/**
 * Drawio XML validator
 * Validates XML format and mxGraphModel structure
 */
export function validateDrawio(xml: string): ValidationResult {
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(xml, 'text/xml')

    // Check for parsing errors
    const parseError = doc.querySelector('parsererror')
    if (parseError) {
      return { valid: false, error: 'Invalid XML format: ' + parseError.textContent }
    }

    // Check for mxGraphModel root element
    const mxGraphModel = doc.querySelector('mxGraphModel')
    if (!mxGraphModel) {
      return { valid: false, error: 'Missing mxGraphModel root element' }
    }

    // Check for root element within mxGraphModel
    const root = mxGraphModel.querySelector('root')
    if (!root) {
      return { valid: false, error: 'Missing root element within mxGraphModel' }
    }

    // Check for at least one mxCell
    const mxCells = root.querySelectorAll('mxCell')
    if (mxCells.length === 0) {
      return { valid: false, error: 'No mxCell elements found' }
    }

    return { valid: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid XML format'
    return { valid: false, error: message }
  }
}

/**
 * Validate content based on engine type
 */
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
