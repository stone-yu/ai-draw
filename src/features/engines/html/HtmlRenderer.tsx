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
import { buildHtmlSrcDoc } from '@/lib/htmlShells'
import { sanitizeHtml } from '@/lib/validators/html'

interface HtmlRendererProps {
  /** Sanitized HTML fragment (AI output). */
  html: string
  styleVariant: string
  title: string
  onChange?: (html: string) => void
  className?: string
}

export interface HtmlRendererRef {
  exportAsSvg: () => void   // alias for HTML download (keeps menu wiring stable)
  exportAsPng: () => void
  exportAsSource: () => void
  showSourceCode: () => void
  hideSourceCode: () => void
  toggleSourceCode: () => void
  openInNewWindow: () => void
}

const PLACEHOLDER = '<!-- type:architecture theme:tech-dark -->\n<article class="diagram"><h1>等待 AI 生成…</h1></article>'

export const HtmlRenderer = forwardRef<HtmlRendererRef, HtmlRendererProps>(
  function HtmlRenderer({ html, styleVariant, title, onChange, className }, ref) {
    const [showCodePanel, setShowCodePanel] = useState(false)
    const [copied, setCopied] = useState(false)
    const [editedCode, setEditedCode] = useState(html)
    const [hasChanges, setHasChanges] = useState(false)
    const iframeRef = useRef<HTMLIFrameElement | null>(null)

    // Sync editedCode when external html prop changes. This is the documented
    // "controlled vs uncontrolled editor" pattern: the prop is the source of
    // truth, but the Monaco buffer is local so the user can edit before Apply.
    useEffect(() => {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEditedCode(html)
      setHasChanges(false)
    }, [html])

    const srcDoc = useMemo(() => {
      const body = sanitizeHtml(html || PLACEHOLDER)
      return buildHtmlSrcDoc(styleVariant, body, title)
    }, [html, styleVariant, title])

    const downloadBlob = useCallback((data: string, mime: string, filename: string) => {
      const blob = new Blob([data], { type: mime })
      const href = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = href
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      setTimeout(() => URL.revokeObjectURL(href), 100)
    }, [])

    const exportAsHtml = useCallback(() => {
      if (!srcDoc) return
      downloadBlob(srcDoc, 'text/html;charset=utf-8', `diagram-${Date.now()}.html`)
    }, [srcDoc, downloadBlob])

    const exportAsSource = useCallback(() => {
      if (!html) return
      downloadBlob(html, 'text/html;charset=utf-8', `diagram-source-${Date.now()}.html`)
    }, [html, downloadBlob])

    // PNG export: rendering an HTML fragment to PNG requires html-to-image or a
    // hidden iframe + foreignObject pipeline — both nontrivial. For v2 we just
    // fall through to the HTML download path; "open in new window" + browser
    // screenshot is the documented workaround.
    const exportAsPng = useCallback(async () => {
      console.warn('[HtmlRenderer] PNG export not implemented for v2 — falling back to HTML download')
      exportAsHtml()
    }, [exportAsHtml])

    const openInNewWindow = useCallback(() => {
      const blob = new Blob([srcDoc], { type: 'text/html;charset=utf-8' })
      const href = URL.createObjectURL(blob)
      const win = window.open(href, '_blank')
      if (!win) console.warn('[HtmlRenderer] Popup blocked; preview URL:', href)
      setTimeout(() => URL.revokeObjectURL(href), 60_000)
    }, [srcDoc])

    useImperativeHandle(
      ref,
      () => ({
        exportAsSvg: exportAsHtml,
        exportAsPng,
        exportAsSource,
        showSourceCode: () => setShowCodePanel(true),
        hideSourceCode: () => setShowCodePanel(false),
        toggleSourceCode: () => setShowCodePanel((p) => !p),
        openInNewWindow,
      }),
      [exportAsHtml, exportAsPng, exportAsSource, openInNewWindow],
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
        setHasChanges(next !== html)
      },
      [html],
    )

    const handleApplyCode = useCallback(() => {
      if (editedCode.trim() && editedCode !== html && onChange) {
        onChange(editedCode)
        setHasChanges(false)
      }
    }, [editedCode, html, onChange])

    const handleResetCode = useCallback(() => {
      setEditedCode(html)
      setHasChanges(false)
    }, [html])

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
                  <span className="text-sm font-medium">HTML 源码</span>
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
                  defaultLanguage="html"
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
