import { ChevronLeft, ChevronRight, Download, Expand } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface SlideNavProps {
  current: number
  total: number
  onPrev: () => void
  onNext: () => void
  onExport: () => void
  onOpenInNewWindow: () => void
}

export function SlideNav({ current, total, onPrev, onNext, onExport, onOpenInNewWindow }: SlideNavProps) {
  return (
    <div className="pointer-events-auto absolute bottom-3 left-1/2 z-10 -translate-x-1/2 flex items-center gap-2 rounded-full border border-border bg-surface/90 px-3 py-1.5 shadow-md backdrop-blur-md">
      <Button variant="ghost" size="sm" onClick={onPrev} disabled={current <= 0} className="h-7 w-7 p-0">
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="min-w-[3.5rem] text-center text-xs font-medium tabular-nums">
        {total === 0 ? '0 / 0' : `${current + 1} / ${total}`}
      </span>
      <Button variant="ghost" size="sm" onClick={onNext} disabled={current >= total - 1} className="h-7 w-7 p-0">
        <ChevronRight className="h-4 w-4" />
      </Button>
      <div className="mx-1 h-4 w-px bg-border" />
      <Button variant="ghost" size="sm" onClick={onOpenInNewWindow} className="h-7 gap-1.5 px-2 text-xs">
        <Expand className="h-3.5 w-3.5" /> 全屏
      </Button>
      <Button variant="ghost" size="sm" onClick={onExport} className="h-7 gap-1.5 px-2 text-xs">
        <Download className="h-3.5 w-3.5" /> HTML
      </Button>
    </div>
  )
}
