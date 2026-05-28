import mermaid from 'mermaid'
import { exportToBlob, restoreElements, convertToExcalidrawElements } from '@excalidraw/excalidraw'
import type { EngineType } from '@/types'
import type { PptAudience } from '@/lib/skillThemes'
import { generateHtmlCardThumbnail } from './htmlCardThumbnail'

export interface ThumbnailOpts {
  styleVariant?: string
  pptAudience?: PptAudience
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ExcalidrawElementAny = any

/**
 * Generate thumbnail from Mermaid diagram
 */
export async function generateMermaidThumbnail(code: string): Promise<string> {
  if (!code.trim()) return ''

  try {
    // Render mermaid to SVG
    const id = `thumbnail-${Date.now()}`
    const { svg } = await mermaid.render(id, code)

    // Convert SVG to PNG using canvas
    return await svgToDataUrl(svg)
  } catch (error) {
    console.error('Failed to generate Mermaid thumbnail:', error)
    return ''
  }
}

/**
 * Fix Excalidraw elements with zero dimensions
 */
function fixZeroDimensionElements(elements: ExcalidrawElementAny[]): ExcalidrawElementAny[] {
  return elements.map(element => {
    if (element.type === 'line' || element.type === 'arrow') {
      const needsFix = element.width === 0 || element.height === 0
      if (needsFix) {
        return {
          ...element,
          width: element.width === 0 ? 1 : element.width,
          height: element.height === 0 ? 1 : element.height,
        }
      }
    }
    return element
  })
}

/**
 * Generate thumbnail from Excalidraw JSON data
 */
export async function generateExcalidrawThumbnail(jsonContent: string): Promise<string> {
  if (!jsonContent.trim()) return ''

  try {
    const parsed = JSON.parse(jsonContent)

    // Support both array format and object format
    let elementsData: ExcalidrawElementAny[]
    if (Array.isArray(parsed)) {
      elementsData = parsed
    } else if (parsed.elements && Array.isArray(parsed.elements)) {
      elementsData = parsed.elements
    } else {
      console.error('Invalid Excalidraw data format')
      return ''
    }

    if (elementsData.length === 0) return ''

    // Fix zero dimension elements and restore
    const fixedElements = fixZeroDimensionElements(elementsData)
    const restoredElements = restoreElements(
      convertToExcalidrawElements(fixedElements),
      null,
      { repairBindings: true }
    )

    // Export to blob - let Excalidraw auto-calculate dimensions to fit all elements
    const blob = await exportToBlob({
      elements: restoredElements,
      appState: {
        exportWithDarkMode: false,
        exportBackground: true,
        viewBackgroundColor: '#ffffff',
      },
      files: null,
      exportPadding: 20,
    })

    // Convert blob to data URL
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch (error) {
    console.error('Failed to generate Excalidraw thumbnail:', error)
    return ''
  }
}

/**
 * v2: HTML engines (html / html-ppt) output full documents that cannot be
 * rasterized without a hidden iframe + html2canvas. Return empty and let UI
 * fall back to placeholder. Kept as a function for back-compat with callers.
 */
export async function generateHtmlThumbnail(): Promise<string> {
  return ''
}

/**
 * Convert SVG string to PNG data URL
 */
async function svgToDataUrl(svgString: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()

    // Set crossOrigin to anonymous to avoid tainted canvas
    img.crossOrigin = 'anonymous'

    // Encode SVG as base64 data URL to avoid tainted canvas issue
    const encodedSvg = btoa(unescape(encodeURIComponent(svgString)))
    const dataUrl = `data:image/svg+xml;base64,${encodedSvg}`

    img.onload = () => {
      // Create canvas with fixed dimensions for thumbnail
      const canvas = document.createElement('canvas')
      const maxWidth = 400
      const maxHeight = 300

      // Calculate aspect ratio
      let width = img.width || maxWidth
      let height = img.height || maxHeight

      if (width > maxWidth) {
        height = (maxWidth / width) * height
        width = maxWidth
      }
      if (height > maxHeight) {
        width = (maxHeight / height) * width
        height = maxHeight
      }

      canvas.width = width
      canvas.height = height

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Failed to get canvas context'))
        return
      }

      // Draw white background
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, width, height)

      // Draw image
      ctx.drawImage(img, 0, 0, width, height)

      // Convert to data URL
      try {
        const pngDataUrl = canvas.toDataURL('image/png', 0.8)
        resolve(pngDataUrl)
      } catch (e) {
        reject(new Error('Failed to export canvas: ' + (e as Error).message))
      }
    }

    img.onerror = () => {
      reject(new Error('Failed to load SVG'))
    }

    img.src = dataUrl
  })
}

/**
 * Generate thumbnail based on engine type
 * Note: For drawio, use thumbnailGetter from editorStore instead (via DrawioEditor's native export)
 */
export async function generateThumbnail(
  content: string,
  engineType: EngineType,
  opts: ThumbnailOpts = {}
): Promise<string> {
  if (!content.trim()) return ''

  switch (engineType) {
    case 'mermaid':
      return generateMermaidThumbnail(content)
    case 'excalidraw':
      return generateExcalidrawThumbnail(content)
    case 'html':
    case 'html-ppt':
      // HTML output isn't easily rasterizable without a hidden iframe + html2canvas,
      // so we generate a stylized SVG card from the theme + extracted heading instead.
      return generateHtmlCardThumbnail(content, {
        engineType,
        styleVariant: opts.styleVariant,
        pptAudience: opts.pptAudience,
      })
    case 'drawio':
      // Drawio thumbnails are generated via thumbnailGetter in editorStore
      // which uses DrawioEditor's native export for accurate rendering
      return ''
    default:
      return ''
  }
}
