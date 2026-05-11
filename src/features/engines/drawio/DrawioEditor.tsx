import {forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState} from 'react'
import {DrawIoEmbed, type DrawIoEmbedRef, type EventAutoSave, type EventExport, type EventSave} from 'react-drawio'
import {cn} from '@/lib/utils'
import {Button} from '@/components/ui/Button'
import Editor from '@monaco-editor/react'
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,} from '@/components/ui/Tooltip'
import {Check, Copy, Play, Undo2, X} from 'lucide-react'
import {useSystemStore} from '@/stores/systemStore'

type ExportFormat = 'svg' | 'png'

// Guard against mid-stream XML that would make drawio's iframe loader either
// (a) call atob() on non-base64 (empty <diagram> body), or (b) hit libxml2's
// "attributes construct error" on a malformed attribute (unescaped &, unclosed
// quote, etc.). Cheap two-pass: shape check + DOMParser sanity check.
function isDrawioLoadSafe(xml: string): boolean {
  if (!xml) return false
  const trimmed = xml.trim()
  if (!trimmed) return false

  // Shape check: protect drawio's atob path on <diagram> with non-XML body.
  let shapeOk = false
  if (trimmed.includes('<mxGraphModel')) {
    shapeOk = true
  } else {
    const diagramMatch = trimmed.match(/<diagram\b[^>]*>([\s\S]*?)<\/diagram>/i)
    if (!diagramMatch) {
      shapeOk = !trimmed.includes('<diagram')
    } else {
      const inner = diagramMatch[1].trim()
      if (inner.startsWith('<')) shapeOk = true
      else if (inner) shapeOk = /^[A-Za-z0-9+/=\s]+$/.test(inner) && inner.replace(/\s+/g, '').length % 4 === 0
    }
  }
  if (!shapeOk) return false

  // Parse check: if our DOMParser rejects it, drawio's libxml2 will too.
  try {
    const doc = new DOMParser().parseFromString(trimmed, 'text/xml')
    if (doc.getElementsByTagName('parsererror').length > 0) return false
  } catch {
    return false
  }
  return true
}

interface DrawioEditorProps {
  data: string // XML string
  onChange?: (data: string) => void
  onExport?: (data: EventExport) => void
  onSave?: (data: EventSave) => void
  className?: string
  darkMode?: boolean
  ui?: 'min' | 'sketch'
}

export interface DrawioEditorRef {
  load: (xml: string) => void
  exportDiagram: (format?: 'xmlsvg' | 'png' | 'svg') => void
  exportAsSvg: () => void
  exportAsPng: () => void
  exportAsSource: () => void
  showSourceCode: () => void
  hideSourceCode: () => void
  toggleSourceCode: () => void
  getThumbnail: () => Promise<string>
}

export const DrawioEditor = forwardRef<DrawioEditorRef, DrawioEditorProps>(
  function DrawioEditor({ data, onChange, onExport, className, darkMode: _darkMode = false, ui = 'min' }, ref) {
    const drawioConfig = useSystemStore((state) => state.drawioConfig)
    const language = useSystemStore((state) => state.language)
    const drawioRef = useRef<DrawIoEmbedRef | null>(null)
    const [isReady, setIsReady] = useState(false)
    const [showCodePanel, setShowCodePanel] = useState(false)
    const [copied, setCopied] = useState(false)
    const [editedCode, setEditedCode] = useState(data)
    const [hasChanges, setHasChanges] = useState(false)
    const lastSavedXmlRef = useRef<string | null>(null)

    // Remount key + initial-xml-for-iframe state. Used to force drawio's iframe
    // to fully reinitialize (and run its built-in auto-fit) on the first
    // transition from empty template to real AI-generated content. Subsequent
    // edits go through the imperative load() path, preserving the user's pan.
    const [iframeKey, setIframeKey] = useState(0)
    const [iframeInitialXml, setIframeInitialXml] = useState<string>(() => data || '')
    const hasRemountedForFirstContentRef = useRef(false)
    const previousDataRef = useRef('')

    const hasRealContent = (xml: string): boolean => {
      if (!xml) return false
      return (xml.match(/<mxCell\b/g) || []).length > 2
    }

    // 动态计算 Draw.io 的 base URL
    const drawioBaseUrl = drawioConfig.useLocalDrawio && drawioConfig.drawioBaseUrl
      ? drawioConfig.drawioBaseUrl
      : (import.meta.env.VITE_DRAWIO_BASE_URL || 'https://embed.diagrams.net')

    // 将语言代码映射到 Draw.io 支持的语言代码
    const drawioLang = language === 'zh' ? 'zh' : 'en'

    // 使用 ref 来跟踪导出请求，避免状态更新的时序问题
    const saveResolverRef = useRef<{
      resolver: ((data: string) => void) | null
      format: ExportFormat | null
    }>({ resolver: null, format: null })

    // 用于获取缩略图的 resolver
    const thumbnailResolverRef = useRef<((data: string) => void) | null>(null)

    // Sync editedCode and drawio content when data prop changes
    useEffect(() => {
      setEditedCode(data)
      setHasChanges(false)

      // Detect first empty→content transition. drawio's iframe auto-fits content
      // only during initialization; an imperative load() on an already-running
      // iframe doesn't reset the viewport. So we force a fresh init via remount
      // (key change) exactly once, the first time real content shows up.
      //
      // Gate the trigger on isReady=true: when the iframe is still warming up
      // (initial mount), the library will load the xml prop natively during
      // its first init — no need to force a second remount on top of that.
      const prevHadContent = hasRealContent(previousDataRef.current)
      const nowHasContent = hasRealContent(data)
      previousDataRef.current = data
      if (isReady && !hasRemountedForFirstContentRef.current && !prevHadContent && nowHasContent) {
        console.log('[DrawioEditor] Remounting iframe for first content transition; cells=', (data.match(/<mxCell\b/g) || []).length)
        hasRemountedForFirstContentRef.current = true
        setIframeInitialXml(data)
        setIframeKey(k => k + 1)
        return
      }

      // Subsequent loads: imperative path. Preserves the user's current pan/zoom.
      if (isReady && drawioRef.current) {
        // If data matches what we just saved, don't reload to avoid flicker/loop
        if (data === lastSavedXmlRef.current) {
          return
        }
        // If the data is exactly what we asked the iframe to load during init,
        // the library will handle it via the xml prop; skip imperative load.
        if (data === iframeInitialXml) {
          return
        }

        if (data) {
          // Guard against half-streamed XML that would make drawio's loader call
          // atob() on a non-base64 string and pop "Failed to execute 'atob'" alert.
          if (!isDrawioLoadSafe(data)) {
            return
          }
          try {
            drawioRef.current.load({ xml: data })
          } catch (err) {
            console.warn('[DrawioEditor] load() threw, skipping frame:', err)
          }
        } else {
          // Load default empty graph to ensure editor is initialized
          const emptyGraph = '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel>'
          drawioRef.current.load({ xml: emptyGraph })
        }
      }
    }, [data, isReady, iframeInitialXml])

    // When iframe remounts, the old isReady flag is stale; reset so handleLoad
    // can fire again for the new iframe instance.
    useEffect(() => {
      if (iframeKey > 0) setIsReady(false)
    }, [iframeKey])

    // Handle export event - 处理导出回调
    const handleExportCallback = useCallback((exportData: EventExport) => {
      // 如果有待处理的缩略图请求，优先处理
      if (thumbnailResolverRef.current) {
        thumbnailResolverRef.current(exportData.data)
        thumbnailResolverRef.current = null
        return
      }

      // 如果有待处理的文件保存请求，优先处理
      if (saveResolverRef.current.resolver) {
        const format = saveResolverRef.current.format
        saveResolverRef.current.resolver(exportData.data)
        saveResolverRef.current = { resolver: null, format: null }

        // 对于 png/svg 格式，处理完毕后直接返回
        if (format === 'png' || format === 'svg') {
          return
        }
      }

      // 调用外部的 onExport 回调（如果有）
      onExport?.(exportData)
    }, [onExport])

    // 保存图表到文件的核心函数
    const saveDiagramToFile = useCallback((filename: string, format: ExportFormat) => {
      if (!drawioRef.current || !isReady) {
        console.warn('Draw.io editor not ready')
        return
      }

      // 设置 resolver，在导出回调中处理
      saveResolverRef.current = {
        resolver: (exportData: string) => {
          let href: string
          let extension: string

          if (format === 'png') {
            // PNG 数据是 base64 data URL
            if (exportData.startsWith('data:')) {
              href = exportData
            } else {
              href = `data:image/png;base64,${exportData}`
            }
            extension = '.png'
          } else {
            // SVG 格式
            if (exportData.startsWith('data:')) {
              href = exportData
            } else if (exportData.startsWith('<svg') || exportData.startsWith('<?xml')) {
              // 原始 SVG 内容 - 创建 blob URL
              const blob = new Blob([exportData], { type: 'image/svg+xml' })
              href = URL.createObjectURL(blob)
            } else {
              // 假设是 base64 编码的 SVG
              href = `data:image/svg+xml;base64,${exportData}`
            }
            extension = '.svg'
          }

          // 执行下载
          const link = document.createElement('a')
          link.href = href
          link.download = `${filename}${extension}`
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)

          // 延迟释放 blob URL
          if (href.startsWith('blob:')) {
            setTimeout(() => URL.revokeObjectURL(href), 100)
          }
        },
        format,
      }

      // 触发导出 - 回调会在 handleExportCallback 中处理
      drawioRef.current.exportDiagram({ format })
    }, [isReady])

    // Export as SVG
    const exportAsSvg = useCallback(() => {
      saveDiagramToFile(`diagram-${Date.now()}`, 'svg')
    }, [saveDiagramToFile])

    // Export as PNG
    const exportAsPng = useCallback(() => {
      saveDiagramToFile(`diagram-${Date.now()}`, 'png')
    }, [saveDiagramToFile])

    // Export as source (.drawio file - XML format)
    const exportAsSource = useCallback(() => {
      if (!data) return

      const blob = new Blob([data], { type: 'application/xml' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `diagram-${Date.now()}.drawio`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    }, [data])

    // Get thumbnail as PNG data URL
    const getThumbnail = useCallback((): Promise<string> => {
      return new Promise((resolve) => {
        if (!drawioRef.current || !isReady) {
          resolve('')
          return
        }

        // 设置超时，防止无限等待
        const timeout = setTimeout(() => {
          thumbnailResolverRef.current = null
          resolve('')
        }, 5000)

        thumbnailResolverRef.current = (exportData: string) => {
          clearTimeout(timeout)
          // 确保返回的是 data URL 格式
          if (exportData.startsWith('data:')) {
            resolve(exportData)
          } else if (exportData && /^[A-Za-z0-9+/=]+$/.test(exportData)) {
            // 有效的 base64 字符串
            resolve(`data:image/png;base64,${exportData}`)
          } else {
            // 无效数据，返回空字符串
            console.warn('[getThumbnail] Invalid export data format, expected base64 or data URL')
            resolve('')
          }
        }

        // 触发 PNG 导出
        drawioRef.current.exportDiagram({ format: 'png' })
      })
    }, [isReady])

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      load: (xml: string) => {
        if (drawioRef.current) {
          drawioRef.current.load({ xml })
        }
      },
      exportDiagram: (format: 'xmlsvg' | 'png' | 'svg' = 'xmlsvg') => {
        if (drawioRef.current) {
          drawioRef.current.exportDiagram({ format })
        }
      },
      exportAsSvg,
      exportAsPng,
      exportAsSource,
      showSourceCode: () => setShowCodePanel(true),
      hideSourceCode: () => setShowCodePanel(false),
      toggleSourceCode: () => setShowCodePanel(prev => !prev),
      getThumbnail,
    }), [exportAsSvg, exportAsPng, exportAsSource, getThumbnail])

    // Handle drawio load event
    const handleLoad = useCallback(() => {
      setIsReady(true)
    }, [])

    // Handle autosave event - 自动监听数值变化
    const handleAutoSave = useCallback((data: EventAutoSave) => {
      if (!data.xml) return
      // 在外部 props.data 变更触发 load() 时，drawio iframe 内部会先短暂 reset
      // 再渲染新内容，期间会上报一份默认空图（仅含 id="0"/id="1" 两个根 cell）。
      // 如果让它走完 onChange 链路，会污染 lastSavedXmlRef 并使 useEffect 跳过真正的 reload，
      // 导致流式生成结束后画布"消失"。
      const cellCount = (data.xml.match(/<mxCell\b/g) || []).length
      if (cellCount <= 2) {
        return
      }
      lastSavedXmlRef.current = data.xml
      onChange?.(data.xml)
    }, [onChange])

    // Copy code handler
    const handleCopyCode = useCallback(async () => {
      try {
        await navigator.clipboard.writeText(editedCode)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch (err) {
        console.error('Failed to copy code:', err)
      }
    }, [editedCode])

    // Handle code edit (for Monaco Editor)
    const handleCodeChange = useCallback((value: string | undefined) => {
      const newCode = value || ''
      setEditedCode(newCode)
      setHasChanges(newCode !== data)
    }, [data])

    // Apply code changes
    const handleApplyCode = useCallback(() => {
      if (editedCode.trim() && editedCode !== data) {
        // Load the new XML into draw.io
        if (drawioRef.current) {
          drawioRef.current.load({ xml: editedCode })
        }
        // Notify parent of change
        if (onChange) {
          onChange(editedCode)
        }
        setHasChanges(false)
      }
    }, [editedCode, data, onChange])

    // Reset code to original
    const handleResetCode = useCallback(() => {
      setEditedCode(data)
      setHasChanges(false)
    }, [data])

    return (
      <TooltipProvider>
        <div className={cn('relative h-full w-full', className)}>
          <DrawIoEmbed
            key={iframeKey}
            ref={drawioRef}
            baseUrl={drawioBaseUrl}
            xml={iframeInitialXml || undefined}
            onLoad={handleLoad}
            onAutoSave={handleAutoSave}
            onExport={handleExportCallback}
            autosave={true}

            configuration={{
              // 隐藏底部页面管理栏
              css: `.geFooterContainer, .geTabContainer, .geTabbedDiagram { display: none !important; }
              .geMenubarContainer {background:#fff !important; }`
            }}
            urlParameters={{
              ui,
              spin: true,
              libraries: false,
              saveAndExit: false,
              noExitBtn: true,
              noSaveBtn: true,
              lang: drawioLang
            }}

          />
          {!isReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80">
              <div className="text-center">
                <div className="mb-2 h-8 w-8 animate-spin rounded-full border-2 border-primary border-r-transparent mx-auto" />
                <p className="text-sm text-muted">Loading Draw.io...</p>
              </div>
            </div>
          )}

          {/* Code Panel */}
          {showCodePanel && (
            <div className="absolute bottom-4 right-4 z-10 w-96 max-h-[70%] flex flex-col border border-border bg-surface shadow-lg">
              {/* Panel Header */}
              <div className="flex items-center justify-between border-b border-border px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Draw.io XML 源码</span>
                  {hasChanges && (
                    <span className="text-xs text-amber-500">• 未保存</span>
                  )}
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
              {/* Code Editor */}
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
              {/* Panel Footer */}
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
  }
)
