import { useCallback, useMemo, useState } from 'react'
import Editor from '@monaco-editor/react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { joinSlides, parsePptHtml, type ParsedSlide } from '@/lib/htmlPpt/parser'

interface MultiSlideEditorProps {
  html: string
  onApply: (newHtml: string) => void
  onClose: () => void
}

export function MultiSlideEditor({ html, onApply, onClose }: MultiSlideEditorProps) {
  const parsed = useMemo(() => parsePptHtml(html), [html])
  const [draftSlides, setDraftSlides] = useState<ParsedSlide[]>(parsed.slides)
  const [draftRaw, setDraftRaw] = useState<string>(html)
  const [activeTab, setActiveTab] = useState<number>(0)

  const fallback = parsed.fallback

  const handleSlideChange = useCallback((value: string | undefined) => {
    const next = value || ''
    setDraftSlides((prev) => prev.map((s) => (s.index === activeTab ? { ...s, html: next } : s)))
  }, [activeTab])

  const handleApply = useCallback(() => {
    if (fallback) {
      onApply(draftRaw)
    } else {
      onApply(joinSlides(parsed.headerComment, draftSlides))
    }
  }, [fallback, draftRaw, draftSlides, parsed.headerComment, onApply])

  return (
    <div className="absolute bottom-4 right-4 z-10 w-[28rem] max-h-[70%] flex flex-col border border-border bg-surface shadow-lg">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-sm font-medium">HTML PPT 源码</span>
        <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0">
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {fallback && (
        <div className="border-b border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-700">
          无法按 slide 解析，已退回到整段 HTML 编辑。
        </div>
      )}

      {!fallback && (
        <div className="flex flex-wrap gap-1 border-b border-border px-2 py-2">
          {draftSlides.map((s) => (
            <button
              key={s.index}
              onClick={() => setActiveTab(s.index)}
              className={`rounded-md px-2 py-1 text-xs ${activeTab === s.index ? 'bg-primary text-surface' : 'bg-muted/40 hover:bg-muted'}`}
            >
              Slide {s.index + 1}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 min-h-0">
        <Editor
          height="320px"
          defaultLanguage="html"
          value={fallback ? draftRaw : draftSlides.find((s) => s.index === activeTab)?.html ?? ''}
          onChange={(v) => (fallback ? setDraftRaw(v || '') : handleSlideChange(v))}
          theme="vs"
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            automaticLayout: true,
            tabSize: 2,
          }}
        />
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-border px-3 py-2">
        <Button variant="ghost" size="sm" onClick={onClose} className="rounded-full">取消</Button>
        <Button size="sm" onClick={handleApply} className="rounded-full bg-primary text-surface">应用</Button>
      </div>
    </div>
  )
}
