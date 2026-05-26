import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui'
import { ENGINES, HTML_DIAGRAM_THEMES } from '@/constants'
import { ProjectRepository } from '@/services/projectRepository'
import { GroupRepository } from '@/services/groupRepository'
import type { EngineType, Group } from '@/types'
import {
  DEFAULT_DIAGRAM_THEME,
  DEFAULT_PPT_THEME,
  pptThemesForAudience,
  PPT_AUDIENCES,
  type DiagramThemeFamily,
  type PptAudience,
} from '@/lib/skillThemes'
import { useSystemStore } from '@/stores/systemStore'

interface CreateProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const FAMILY_ORDER: DiagramThemeFamily[] = ['tech', 'business', 'minimalist', 'colorful']
const FAMILY_LABEL: Record<DiagramThemeFamily, string> = {
  tech: '技术风',
  business: '商务',
  minimalist: '极简',
  colorful: '彩色 / 设计',
}

export function CreateProjectDialog({ open, onOpenChange }: CreateProjectDialogProps) {
  const navigate = useNavigate()
  const defaultEngine = useSystemStore((state) => state.defaultEngine)
  const language = useSystemStore((state) => state.language)
  const i18nTexts = useSystemStore((state) => state.i18nTexts)
  const [title, setTitle] = useState(i18nTexts.dialogUntitled[language])
  const [engine, setEngine] = useState<EngineType>(defaultEngine)
  const [htmlTheme, setHtmlTheme] = useState<string>(DEFAULT_DIAGRAM_THEME)
  const [pptAudience, setPptAudience] = useState<PptAudience>('engineers')
  const [pptTheme, setPptTheme] = useState<string>(DEFAULT_PPT_THEME.engineers)
  const [groupId, setGroupId] = useState<string>('uncategorized')
  const [groups, setGroups] = useState<Group[]>([])
  const [isCreating, setIsCreating] = useState(false)

  const themesByFamily = useMemo(() => {
    const groups: Record<DiagramThemeFamily, typeof HTML_DIAGRAM_THEMES> = { tech: [], business: [], minimalist: [], colorful: [] }
    for (const t of HTML_DIAGRAM_THEMES) groups[t.family].push(t)
    return groups
  }, [])

  const audienceThemes = useMemo(() => pptThemesForAudience(pptAudience), [pptAudience])

  useEffect(() => {
    if (open) {
      loadGroups()
      setEngine(defaultEngine)
      setHtmlTheme(DEFAULT_DIAGRAM_THEME)
      setPptAudience('engineers')
      setPptTheme(DEFAULT_PPT_THEME.engineers)
    }
  }, [open, defaultEngine])

  useEffect(() => {
    if (!audienceThemes.find((t) => t.id === pptTheme)) {
      setPptTheme(DEFAULT_PPT_THEME[pptAudience])
    }
  }, [pptAudience, audienceThemes, pptTheme])

  const loadGroups = async () => {
    try {
      const data = await GroupRepository.getAll()
      setGroups(data)
    } catch (error) {
      console.error('Failed to load groups:', error)
    }
  }

  const handleCreate = async () => {
    if (!title.trim()) return
    setIsCreating(true)
    try {
      const styleVariant =
        engine === 'html' ? htmlTheme : engine === 'html-ppt' ? pptTheme : undefined
      const pptAudienceField = engine === 'html-ppt' ? pptAudience : undefined
      const project = await ProjectRepository.create({
        title: title.trim(),
        engineType: engine,
        styleVariant,
        pptAudience: pptAudienceField,
        groupId: groupId === 'uncategorized' ? undefined : groupId,
      })
      onOpenChange(false)
      setTitle(i18nTexts.dialogUntitled[language])
      setGroupId('uncategorized')
      navigate(`/editor/${project.id}`)
    } catch (error) {
      console.error('Failed to create project:', error)
    } finally {
      setIsCreating(false)
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setTitle(i18nTexts.dialogUntitled[language])
      setEngine(defaultEngine)
      setHtmlTheme(DEFAULT_DIAGRAM_THEME)
      setPptAudience('engineers')
      setPptTheme(DEFAULT_PPT_THEME.engineers)
      setGroupId('uncategorized')
    }
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{i18nTexts.dialogNewFile[language]}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <label className="mb-2 block text-sm font-medium">{i18nTexts.dialogFileName[language]}</label>
            <Input
              placeholder={i18nTexts.dialogFileNamePlaceholder[language]}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="rounded-xl"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">{i18nTexts.dialogGroup[language]}</label>
            <Select value={groupId} onValueChange={setGroupId}>
              <SelectTrigger className="w-full rounded-xl"><SelectValue placeholder={i18nTexts.dialogSelectGroup[language]} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="uncategorized">{i18nTexts.projectsUncategorized[language]}</SelectItem>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">{i18nTexts.dialogEngine[language]}</label>
            <Select value={engine} onValueChange={(v) => setEngine(v as EngineType)}>
              <SelectTrigger className="w-full rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ENGINES.map((e) => (<SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>))}
              </SelectContent>
            </Select>
            <p className="mt-2 text-xs text-muted-foreground">{ENGINES.find((e) => e.value === engine)?.description}</p>
          </div>

          {engine === 'html' && (
            <div className="max-h-72 overflow-y-auto pr-1">
              <label className="mb-2 block text-sm font-medium">主题（12 个）</label>
              {FAMILY_ORDER.map((fam) => (
                <div key={fam} className="mb-3">
                  <div className="mb-1 text-xs text-muted-foreground">{FAMILY_LABEL[fam]}</div>
                  <div className="grid grid-cols-2 gap-2">
                    {themesByFamily[fam].map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setHtmlTheme(t.id)}
                        className={`rounded-xl border p-2 text-left transition ${htmlTheme === t.id ? 'border-primary bg-primary/5' : 'border-border bg-muted/30 hover:border-primary/50'}`}
                      >
                        <div className="text-sm font-medium">{t.name}</div>
                        <div className="mt-1 text-[10px] text-muted-foreground line-clamp-2">{t.description}</div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <p className="mt-1 text-xs text-muted-foreground">创建后主题不可更改，如需切换请新建项目。</p>
            </div>
          )}

          {engine === 'html-ppt' && (
            <div className="max-h-80 overflow-y-auto pr-1">
              <label className="mb-2 block text-sm font-medium">1. 受众场景</label>
              <div className="grid grid-cols-3 gap-2">
                {PPT_AUDIENCES.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setPptAudience(a.id)}
                    className={`rounded-xl border p-2 text-left transition ${pptAudience === a.id ? 'border-primary bg-primary/5' : 'border-border bg-muted/30 hover:border-primary/50'}`}
                  >
                    <div className="text-sm font-medium">{a.label}</div>
                    <div className="mt-1 text-[10px] text-muted-foreground">{a.description}</div>
                  </button>
                ))}
              </div>

              <label className="mb-2 mt-4 block text-sm font-medium">2. 主题（{audienceThemes.length} 个）</label>
              <div className="grid grid-cols-2 gap-2">
                {audienceThemes.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setPptTheme(t.id)}
                    className={`rounded-xl border p-2 text-left transition ${pptTheme === t.id ? 'border-primary bg-primary/5' : 'border-border bg-muted/30 hover:border-primary/50'}`}
                  >
                    <div className="text-sm font-medium">{t.name}</div>
                    <div className="mt-1 text-[10px] text-muted-foreground line-clamp-2">{t.description}</div>
                  </button>
                ))}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">创建后受众和主题不可更改。</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-full">{i18nTexts.dialogCancel[language]}</Button>
          <Button onClick={handleCreate} disabled={isCreating} className="rounded-full bg-primary text-surface hover:bg-primary/90">
            {isCreating ? i18nTexts.dialogCreating[language] : i18nTexts.dialogCreate[language]}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
