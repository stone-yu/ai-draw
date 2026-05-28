import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import { cn } from '@/lib/utils'
import { sanitizeHtml } from '@/lib/validators/html'
import { buildPptSrcDoc } from '@/lib/htmlPpt/srcdocBuilder'
import { parsePptHtml } from '@/lib/htmlPpt/parser'
import { SlideNav } from './SlideNav'
import { MultiSlideEditor } from './MultiSlideEditor'

interface HtmlPptRendererProps {
  html: string
  styleVariant: string
  title: string
  onChange?: (html: string) => void
  className?: string
}

export interface HtmlPptRendererRef {
  exportAsSvg: () => void   // alias: full HTML download
  exportAsPng: () => void   // not supported — falls through to HTML
  exportAsSource: () => void
  showSourceCode: () => void
  hideSourceCode: () => void
  toggleSourceCode: () => void
  openInNewWindow: () => void
}

const PLACEHOLDER = `<!-- audience:engineers theme:tokyo-night -->
<section class="slide" data-slide-title="封面"><h1>等待 AI 生成…</h1></section>`

export const HtmlPptRenderer = forwardRef<HtmlPptRendererRef, HtmlPptRendererProps>(
  function HtmlPptRenderer({ html, styleVariant, title, onChange, className }, ref) {
    const [showCodePanel, setShowCodePanel] = useState(false)
    const [activeIndex, setActiveIndex] = useState(0)
    const iframeRef = useRef<HTMLIFrameElement | null>(null)

    const sanitized = useMemo(() => sanitizeHtml(html || PLACEHOLDER), [html])
    const parsed = useMemo(() => parsePptHtml(sanitized), [sanitized])
    const total = parsed.slides.length

    const srcDoc = useMemo(
      () => buildPptSrcDoc({ themeId: styleVariant, body: sanitized, title, activeIndex: 0, includeNavScript: false }),
      [styleVariant, sanitized, title],
    )

    // Reset active index when project changes (i.e. sanitized html length jumps).
    useEffect(() => {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveIndex(0)
    }, [sanitized])

    // Sync active index into the iframe DOM. sandbox="allow-same-origin" makes
    // contentDocument.body reachable as long as srcDoc came from us (same-origin).
    useEffect(() => {
      const frame = iframeRef.current
      if (!frame) return
      const apply = () => {
        try {
          const doc = frame.contentDocument
          if (doc && doc.body) doc.body.dataset.activeIndex = String(activeIndex)
        } catch (err) {
          console.warn('[HtmlPptRenderer] cannot set active index:', err)
        }
      }
      apply()
      frame.addEventListener('load', apply, { once: true })
      return () => frame.removeEventListener('load', apply)
    }, [activeIndex, srcDoc])

    const goPrev = useCallback(() => setActiveIndex((i) => Math.max(0, i - 1)), [])
    const goNext = useCallback(() => setActiveIndex((i) => Math.min(total - 1, i + 1)), [total])

    // Keyboard navigation: ← / → / Space while the canvas has focus or is hovered.
    useEffect(() => {
      const handler = (e: KeyboardEvent) => {
        if (e.target instanceof HTMLElement) {
          const tag = e.target.tagName
          if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable) return
        }
        if (e.key === 'ArrowRight' || e.key === ' ') {
          e.preventDefault()
          goNext()
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault()
          goPrev()
        }
      }
      window.addEventListener('keydown', handler)
      return () => window.removeEventListener('keydown', handler)
    }, [goNext, goPrev])

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
      const standalone = buildPptSrcDoc({ themeId: styleVariant, body: sanitized, title, activeIndex: 0, includeNavScript: true })
      downloadBlob(standalone, 'text/html;charset=utf-8', `deck-${Date.now()}.html`)
    }, [styleVariant, sanitized, title, downloadBlob])

    const exportAsSource = useCallback(() => {
      if (!html) return
      downloadBlob(html, 'text/html;charset=utf-8', `deck-source-${Date.now()}.html`)
    }, [html, downloadBlob])

    const openInNewWindow = useCallback(() => {
      const standalone = buildPptSrcDoc({ themeId: styleVariant, body: sanitized, title, activeIndex, includeNavScript: true })
      const blob = new Blob([standalone], { type: 'text/html;charset=utf-8' })
      const href = URL.createObjectURL(blob)
      const win = window.open(href, '_blank')
      if (!win) console.warn('[HtmlPptRenderer] Popup blocked; preview URL:', href)
      setTimeout(() => URL.revokeObjectURL(href), 60_000)
    }, [styleVariant, sanitized, title, activeIndex])

    useImperativeHandle(
      ref,
      () => ({
        exportAsSvg: exportAsHtml,
        exportAsPng: exportAsHtml,
        exportAsSource,
        showSourceCode: () => setShowCodePanel(true),
        hideSourceCode: () => setShowCodePanel(false),
        toggleSourceCode: () => setShowCodePanel((p) => !p),
        openInNewWindow,
      }),
      [exportAsHtml, exportAsSource, openInNewWindow],
    )

    return (
      <div className={cn('relative h-full w-full', className)}>
        <iframe
          ref={iframeRef}
          title={`html-ppt-engine-${styleVariant}`}
          sandbox="allow-same-origin"
          srcDoc={srcDoc}
          className="h-full w-full border-0"
        />

        <SlideNav
          current={activeIndex}
          total={total}
          onPrev={goPrev}
          onNext={goNext}
          onExport={exportAsHtml}
          onOpenInNewWindow={openInNewWindow}
        />

        {showCodePanel && (
          <MultiSlideEditor
            html={html}
            onApply={(next) => {
              if (onChange) onChange(next)
              setShowCodePanel(false)
            }}
            onClose={() => setShowCodePanel(false)}
          />
        )}
      </div>
    )
  },
)
