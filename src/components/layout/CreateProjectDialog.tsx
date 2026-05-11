import {useEffect, useState} from 'react'
import {useNavigate} from 'react-router-dom'
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
import {ENGINES, HTML_STYLES} from '@/constants'
import {ProjectRepository} from '@/services/projectRepository'
import {GroupRepository} from '@/services/groupRepository'
import type {EngineType, Group, HtmlStyleVariant} from '@/types'

import {useSystemStore} from '@/stores/systemStore'

interface CreateProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateProjectDialog({ open, onOpenChange }: CreateProjectDialogProps) {
  const navigate = useNavigate()
  const defaultEngine = useSystemStore((state) => state.defaultEngine)
  const language = useSystemStore((state) => state.language)
  const i18nTexts = useSystemStore((state) => state.i18nTexts)
  const [title, setTitle] = useState(i18nTexts.dialogUntitled[language])
  const [engine, setEngine] = useState<EngineType>(defaultEngine)
  const [styleVariant, setStyleVariant] = useState<HtmlStyleVariant>('dark-tech')
  const [groupId, setGroupId] = useState<string>('uncategorized')
  const [groups, setGroups] = useState<Group[]>([])
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => {
    if (open) {
      loadGroups()
      setEngine(defaultEngine)
      setStyleVariant('dark-tech')
    }
  }, [open, defaultEngine])

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
      const project = await ProjectRepository.create({
        title: title.trim(),
        engineType: engine,
        styleVariant: engine === 'html' ? styleVariant : undefined,
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
      setStyleVariant('dark-tech')
      setGroupId('uncategorized')
    }
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="rounded-2xl">
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
              <SelectTrigger className="w-full rounded-xl">
                <SelectValue placeholder={i18nTexts.dialogSelectGroup[language]} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="uncategorized">{i18nTexts.projectsUncategorized[language]}</SelectItem>
                {groups.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">{i18nTexts.dialogEngine[language]}</label>
            <Select value={engine} onValueChange={(v) => setEngine(v as EngineType)}>
              <SelectTrigger className="w-full rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ENGINES.map((e) => (
                  <SelectItem key={e.value} value={e.value}>
                    {e.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-2 text-xs text-muted-foreground">
              {ENGINES.find((e) => e.value === engine)?.description}
            </p>
          </div>

          {engine === 'html' && (
            <div>
              <label className="mb-2 block text-sm font-medium">风格</label>
              <div className="grid grid-cols-2 gap-2">
                {HTML_STYLES.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setStyleVariant(s.value)}
                    className={`rounded-xl border p-3 text-left transition ${
                      styleVariant === s.value
                        ? 'border-primary bg-primary/5'
                        : 'border-border bg-muted/30 hover:border-primary/50'
                    }`}
                  >
                    <div className="text-sm font-medium">{s.label}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{s.description}</div>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                创建后风格不可更改，如需切换请新建项目。
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-full"
          >
            {i18nTexts.dialogCancel[language]}
          </Button>
          <Button
            onClick={handleCreate}
            disabled={isCreating}
            className="rounded-full bg-primary text-surface hover:bg-primary/90"
          >
            {isCreating ? i18nTexts.dialogCreating[language] : i18nTexts.dialogCreate[language]}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
