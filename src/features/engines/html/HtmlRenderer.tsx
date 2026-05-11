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

    const downloadBlob = useCallback((data: string, mime: string, filename: string) => {
      const blob = new Blob([data], { type: mime })
      const href = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = href
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      if (href.startsWith('blob:')) {
        setTimeout(() => URL.revokeObjectURL(href), 100)
      }
    }, [])

    const exportAsSvg = useCallback(() => {
      if (!svg) return
      downloadBlob(svg, 'image/svg+xml', `diagram-${Date.now()}.svg`)
    }, [svg, downloadBlob])

    // For the html engine, the "source" IS the SVG — same content, distinct
    // filename so users can tell the downloads apart in their Downloads folder.
    const exportAsSource = useCallback(() => {
      if (!svg) return
      downloadBlob(svg, 'image/svg+xml', `diagram-source-${Date.now()}.svg`)
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
