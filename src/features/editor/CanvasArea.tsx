import {type ForwardedRef, forwardRef, useCallback, useEffect, useImperativeHandle, useRef} from 'react'
import {selectEngineType, selectStyleVariant, useEditorStore} from '@/stores/editorStore'
import {MermaidRenderer, type MermaidRendererRef} from '@/features/engines/mermaid/MermaidRenderer'
import {ExcalidrawEditor, type ExcalidrawEditorRef} from '@/features/engines/excalidraw/ExcalidrawEditor'
import {DrawioEditor, type DrawioEditorRef} from '@/features/engines/drawio/DrawioEditor'
import {HtmlRenderer, type HtmlRendererRef} from '@/features/engines/html/HtmlRenderer'

export interface CanvasAreaRef {
  exportAsSvg: () => void
  exportAsPng: () => void
  exportAsSource: () => void
  showSourceCode: () => void
  hideSourceCode: () => void
  toggleSourceCode: () => void
  getThumbnail: () => Promise<string>
}

interface CanvasAreaProps {
  onReady?: () => void
}

export const CanvasArea = forwardRef<CanvasAreaRef, CanvasAreaProps>(function CanvasArea(props: CanvasAreaProps, ref: ForwardedRef<CanvasAreaRef>) {
  const { onReady } = props
  const currentContent = useEditorStore((s) => s.currentContent)
  const currentProject = useEditorStore((s) => s.currentProject)
  const engineType = useEditorStore(selectEngineType)
  const isLoading = useEditorStore((s) => s.isLoading)
  const setContent = useEditorStore((s) => s.setContent)
  const setThumbnailGetter = useEditorStore((s) => s.setThumbnailGetter)

  // Use projectId as key to force remount when switching projects
  // This prevents Excalidraw from using its internal localStorage cache
  const projectKey = currentProject?.id || 'no-project'

  // Refs for each engine
  const mermaidRef = useRef<MermaidRendererRef | null>(null)
  const excalidrawRef = useRef<ExcalidrawEditorRef | null>(null)
  const drawioRef = useRef<DrawioEditorRef | null>(null)
  const htmlRef = useRef<HtmlRendererRef | null>(null)
  const styleVariant = useEditorStore(selectStyleVariant)

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    exportAsSvg: () => {
      switch (engineType) {
        case 'mermaid':
          mermaidRef.current?.exportAsSvg()
          break
        case 'excalidraw':
          excalidrawRef.current?.exportAsSvg()
          break
        case 'drawio':
          drawioRef.current?.exportAsSvg()
          break
        case 'html':
          htmlRef.current?.exportAsSvg()
          break
      }
    },
    exportAsPng: () => {
      switch (engineType) {
        case 'mermaid':
          mermaidRef.current?.exportAsPng()
          break
        case 'excalidraw':
          excalidrawRef.current?.exportAsPng()
          break
        case 'drawio':
          drawioRef.current?.exportAsPng()
          break
        case 'html':
          htmlRef.current?.exportAsPng()
          break
      }
    },
    exportAsSource: () => {
      switch (engineType) {
        case 'mermaid':
          mermaidRef.current?.exportAsSource()
          break
        case 'excalidraw':
          excalidrawRef.current?.exportAsSource()
          break
        case 'drawio':
          drawioRef.current?.exportAsSource()
          break
        case 'html':
          htmlRef.current?.exportAsSource()
          break
      }
    },
    showSourceCode: () => {
      switch (engineType) {
        case 'mermaid':
          mermaidRef.current?.showSourceCode()
          break
        case 'excalidraw':
          excalidrawRef.current?.showSourceCode()
          break
        case 'drawio':
          drawioRef.current?.showSourceCode()
          break
        case 'html':
          htmlRef.current?.showSourceCode()
          break
      }
    },
    hideSourceCode: () => {
      switch (engineType) {
        case 'mermaid':
          mermaidRef.current?.hideSourceCode()
          break
        case 'excalidraw':
          excalidrawRef.current?.hideSourceCode()
          break
        case 'drawio':
          drawioRef.current?.hideSourceCode()
          break
        case 'html':
          htmlRef.current?.hideSourceCode()
          break
      }
    },
    toggleSourceCode: () => {
      switch (engineType) {
        case 'mermaid':
          mermaidRef.current?.toggleSourceCode()
          break
        case 'excalidraw':
          excalidrawRef.current?.toggleSourceCode()
          break
        case 'drawio':
          drawioRef.current?.toggleSourceCode()
          break
        case 'html':
          htmlRef.current?.toggleSourceCode()
          break
      }
    },
    getThumbnail: async () => {
      if (engineType === 'drawio' && drawioRef.current) {
        return drawioRef.current.getThumbnail()
      }
      return ''
    },
  }), [engineType])

  // Register thumbnail getter for drawio engine
  useEffect(() => {
    if (engineType === 'drawio') {
      setThumbnailGetter(async () => {
        if (drawioRef.current) {
          return drawioRef.current.getThumbnail()
        }
        return ''
      })
    } else {
      setThumbnailGetter(null)
    }

    return () => {
      setThumbnailGetter(null)
    }
  }, [engineType, setThumbnailGetter])

  // Trigger onReady when content is first rendered
  const hasCalledOnReady = useRef(false)
  useEffect(() => {
    if (currentContent && !hasCalledOnReady.current && onReady) {
      // Delay to ensure the engine has rendered
      const timer = setTimeout(() => {
        onReady()
        hasCalledOnReady.current = true
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [currentContent, onReady])

  // Reset onReady flag when project changes
  useEffect(() => {
    hasCalledOnReady.current = false
  }, [projectKey])

  if (!engineType) {
    return (
      <div className="flex h-full items-center justify-center bg-background text-muted">
        Loading...
      </div>
    )
  }

  // Handle content change from editors - only update store, no auto-save to database
  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent)
  }, [setContent])

  // Render based on engine type
  const renderEngine = () => {
    switch (engineType) {
      case 'mermaid':
        return <MermaidRenderer ref={mermaidRef} code={currentContent} />
      case 'excalidraw':
        return (
          <ExcalidrawEditor
            ref={excalidrawRef}
            key={projectKey}
            data={currentContent}
            onChange={handleContentChange}
          />
        )
      case 'drawio':
        return (
          <DrawioEditor
            ref={drawioRef}
            key={projectKey}
            data={currentContent}
            onChange={handleContentChange}
          />
        )
      case 'html':
        if (!styleVariant) {
          return (
            <div className="flex h-full items-center justify-center text-muted">
              缺少风格变体（styleVariant）
            </div>
          )
        }
        return (
          <HtmlRenderer
            ref={htmlRef}
            key={projectKey}
            svg={currentContent}
            styleVariant={styleVariant}
            title={currentProject?.title || ''}
            onChange={handleContentChange}
          />
        )
      default:
        return null
    }
  }

  return (
    <div className="relative h-full w-full bg-background">
      {renderEngine()}

      {/* Loading Overlay removed as per user request */}
    </div>
  )
})
