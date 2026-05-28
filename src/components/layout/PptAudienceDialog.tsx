import { useEffect, useMemo, useState } from 'react'
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui'
import {
  PPT_AUDIENCES,
  pptThemesForAudience,
  DEFAULT_PPT_THEME,
  type PptAudience,
} from '@/lib/skillThemes'

interface PptAudienceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialAudience?: PptAudience
  initialTheme?: string
  onConfirm: (audience: PptAudience, themeId: string) => void
}

export function PptAudienceDialog({ open, onOpenChange, initialAudience = 'engineers', initialTheme, onConfirm }: PptAudienceDialogProps) {
  const [audience, setAudience] = useState<PptAudience>(initialAudience)
  const [themeId, setThemeId] = useState<string>(initialTheme ?? DEFAULT_PPT_THEME[initialAudience])
  const themes = useMemo(() => pptThemesForAudience(audience), [audience])

  useEffect(() => {
    if (open) {
      setAudience(initialAudience)
      setThemeId(initialTheme ?? DEFAULT_PPT_THEME[initialAudience])
    }
  }, [open, initialAudience, initialTheme])

  useEffect(() => {
    if (!themes.find((t) => t.id === themeId)) {
      setThemeId(DEFAULT_PPT_THEME[audience])
    }
  }, [audience, themes, themeId])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>新建 HTML PPT</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <div className="mb-2 text-sm font-medium">1. 受众场景</div>
            <div className="grid grid-cols-3 gap-2">
              {PPT_AUDIENCES.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAudience(a.id)}
                  className={`rounded-xl border p-3 text-left transition ${audience === a.id ? 'border-primary bg-primary/5' : 'border-border bg-muted/30 hover:border-primary/50'}`}
                >
                  <div className="text-sm font-medium">{a.label}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{a.description}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 text-sm font-medium">2. 主题（共 {themes.length} 个）</div>
            <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
              {themes.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setThemeId(t.id)}
                  className={`rounded-xl border p-3 text-left transition ${themeId === t.id ? 'border-primary bg-primary/5' : 'border-border bg-muted/30 hover:border-primary/50'}`}
                >
                  <div className="text-sm font-medium">{t.name}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{t.description}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-full">取消</Button>
          <Button onClick={() => onConfirm(audience, themeId)} className="rounded-full bg-primary text-surface hover:bg-primary/90">
            使用「{PPT_AUDIENCES.find((a) => a.id === audience)?.label} · {themes.find((t) => t.id === themeId)?.name}」继续
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
