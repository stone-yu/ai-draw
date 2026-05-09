import {useEffect, useRef, useState} from 'react'
import {useNavigate, useParams} from 'react-router-dom'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Code,
  Download,
  FileText,
  History,
  Image,
  Megaphone,
  Pencil,
  Save,
  X
} from 'lucide-react'
import {Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Loading} from '@/components/ui'
import {NotificationBar} from '@/components/ui/NotificationBar'
import {AppSidebar} from '@/components/layout'
import {ChatPanel} from '@/features/chat/ChatPanel'
import {CanvasArea, type CanvasAreaRef} from '@/features/editor/CanvasArea'
import {VersionPanel} from '@/features/editor/VersionPanel'
import {useEditorStore} from '@/stores/editorStore'
import {useChatStore} from '@/stores/chatStore'
import {useSystemStore} from '@/stores/systemStore'
import {ProjectRepository} from '@/services/projectRepository'
import {VersionRepository} from '@/services/versionRepository'
import {ChatRepository} from '@/services/chatRepository'
import {authService} from '@/services/authService'
import {generateThumbnail} from '@/lib/thumbnail'
import {useToast} from '@/hooks/useToast'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/Dropdown'
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,} from '@/components/ui/Tooltip'

interface EditorPageProps {
  mode?: 'normal' | 'example'
}

export function EditorPage({ mode = 'normal' }: EditorPageProps) {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const [isVersionPanelOpen, setIsVersionPanelOpen] = useState(false)
  const [isChatPanelCollapsed, setIsChatPanelCollapsed] = useState(() => {
    return localStorage.getItem('ai-draw-nexus.chatPanelCollapsed') === 'true'
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [editedTitle, setEditedTitle] = useState('')
  const [isNotificationOpen, setIsNotificationOpen] = useState(false)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<CanvasAreaRef>(null)
  const { success } = useToast()

  const { currentProject, currentContent, hasUnsavedChanges, setProject, setContentFromVersion, markAsSaved, reset: resetEditor } = useEditorStore()
  const { clearMessages, setMessages } = useChatStore()
  const language = useSystemStore((state) => state.language)
  const i18nTexts = useSystemStore((state) => state.i18nTexts)
  const notifications = useSystemStore((state) => state.notifications)
  const setNotifications = useSystemStore((state) => state.setNotifications)

  useEffect(() => {
    localStorage.setItem('ai-draw-nexus.chatPanelCollapsed', String(isChatPanelCollapsed))
  }, [isChatPanelCollapsed])

  // Load system settings
  useEffect(() => {
    const loadSystemSettings = async () => {
      try {
        const settings = await authService.getSystemSettings()
        if (settings.system?.notifications) {
          setNotifications(settings.system.notifications)
        }
      } catch (error) {
        console.error('Failed to load system settings:', error)
      }
    }
    loadSystemSettings()
  }, [])

  // Load project on mount
  useEffect(() => {
    if (!projectId) {
      navigate(mode === 'example' ? '/profile' : '/projects')
      return
    }

    loadProject(projectId)
  }, [projectId, mode])

  const loadProject = async (id: string) => {
    setIsLoading(true)
    // Clear previous project data before loading new one
    resetEditor()
    clearMessages()
    try {
      if (mode === 'example') {
        const project = await authService.getExampleProject(id)
        if (!project) {
          navigate('/profile')
          return
        }
        // Convert ExampleProject to Project type (dates are strings in JSON)
        const projectData = {
          ...project,
          createdAt: new Date(project.createdAt),
          updatedAt: new Date(project.updatedAt)
        }
        setProject(projectData)
        setEditedTitle(project.title)
        setContentFromVersion(project.content)
      } else {
        const project = await ProjectRepository.getById(id)
        if (!project) {
          navigate('/projects')
          return
        }

        setProject(project)
        setEditedTitle(project.title)

        // Load latest version content
        const latestVersion = await VersionRepository.getLatest(id)
        if (latestVersion) {
          setContentFromVersion(latestVersion.content)
        }

        // Load chat history
        try {
          const history = await ChatRepository.getByProjectId(id)
          setMessages(history)
        } catch (err) {
          console.error('Failed to load chat history:', err)
        }
      }
    } catch (error) {
      console.error('Failed to load project:', error)
      navigate(mode === 'example' ? '/profile' : '/projects')
    } finally {
      setIsLoading(false)
    }
  }

  // Focus title input when editing
  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus()
      titleInputRef.current.select()
    }
  }, [isEditingTitle])

  const handleNewProject = () => {
    navigate('/projects', { state: { openCreateDialog: true } })
  }

  const handleStartEditTitle = () => {
    if (currentProject) {
      setEditedTitle(currentProject.title)
      setIsEditingTitle(true)
    }
  }

  const handleSaveTitle = async () => {
    if (!currentProject || !editedTitle.trim()) return

    try {
      if (mode === 'example') {
        await authService.updateExampleProject(currentProject.id, { title: editedTitle.trim() })
      } else {
        await ProjectRepository.update(currentProject.id, { title: editedTitle.trim() })
      }
      setProject({ ...currentProject, title: editedTitle.trim() })
      setIsEditingTitle(false)
      success('Title updated')
    } catch (error) {
      console.error('Failed to update title:', error)
    }
  }

  const handleCancelEditTitle = () => {
    if (currentProject) {
      setEditedTitle(currentProject.title)
    }
    setIsEditingTitle(false)
  }

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSaveTitle()
    } else if (e.key === 'Escape') {
      handleCancelEditTitle()
    }
  }

  const handleSaveVersion = async () => {
    if (!currentProject?.id || !currentContent) return

    try {
      if (mode === 'example') {
        let thumbnail = currentProject.thumbnail
        // Try to update thumbnail if possible
        if (currentProject.engineType === 'drawio' && canvasRef.current) {
          try {
            const t = await canvasRef.current.getThumbnail()
            if (t) thumbnail = t
          } catch (err) {
            console.error('Failed to generate thumbnail:', err)
          }
        } else if (!thumbnail) {
           try {
             thumbnail = await generateThumbnail(currentContent, currentProject.engineType)
           } catch (err) {
             console.error('Failed to generate thumbnail:', err)
           }
        }

        await authService.updateExampleProject(currentProject.id, {
          content: currentContent,
          thumbnail
        })

        if (thumbnail !== currentProject.thumbnail) {
           setProject({ ...currentProject, thumbnail })
        }

        markAsSaved()
        success('示例项目已保存')
      } else {
        await VersionRepository.create({
          projectId: currentProject.id,
          content: currentContent,
          changeSummary: '人工调整',
        })
        markAsSaved()

        // Update thumbnail for drawio using native export
        if (currentProject.engineType === 'drawio' && canvasRef.current) {
          try {
            const thumbnail = await canvasRef.current.getThumbnail()
            if (thumbnail) {
              await ProjectRepository.update(currentProject.id, { thumbnail })
            }
          } catch (err) {
            console.error('Failed to generate thumbnail:', err)
          }
        }

        success('版本已保存')
      }
    } catch (error) {
      console.error('Failed to save version:', error)
    }
  }

  // Generate thumbnail when canvas is ready (for projects without thumbnail, e.g., imported projects)
  const handleCanvasReady = async () => {
    if (!currentProject || !currentContent) return
    // Skip if project already has a thumbnail
    if (currentProject.thumbnail) return

    try {
      let thumbnail = ''
      if (currentProject.engineType === 'drawio' && canvasRef.current) {
        thumbnail = await canvasRef.current.getThumbnail()
      } else {
        thumbnail = await generateThumbnail(currentContent, currentProject.engineType)
      }

      if (thumbnail) {
        if (mode === 'example') {
          await authService.updateExampleProject(currentProject.id, { thumbnail })
        } else {
          await ProjectRepository.update(currentProject.id, { thumbnail })
        }
        setProject({ ...currentProject, thumbnail })
      }
    } catch (err) {
      console.error('Failed to generate thumbnail on ready:', err)
    }
  }

  if (isLoading || !currentProject) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loading size="lg" />
      </div>
    )
  }

  return (
    <TooltipProvider>
    <div className="flex h-screen flex-col bg-background pl-[72px]">
      <AppSidebar onCreateProject={handleNewProject} />
      {/* Toolbar */}
      <header className="flex h-14 items-center justify-between border-b border-border bg-surface px-4">
        <div className="flex items-center gap-4">
          <div>
            {isEditingTitle ? (
              <div className="flex items-center gap-2">
                <Input
                  ref={titleInputRef}
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  onKeyDown={handleTitleKeyDown}
                  className="h-8 w-48"
                />
                <Button variant="ghost" size="icon" onClick={handleSaveTitle}>
                  <Check className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={handleCancelEditTitle}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => navigate(-1)}
                  title="返回"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    currentProject.engineType === 'excalidraw'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                      : 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
                  }`}>
                  {currentProject.engineType.toUpperCase()}
                </span>
                <h1 className="font-medium text-primary">{currentProject.title}</h1>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={handleStartEditTitle}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
          <div className="h-4 w-px bg-border" />
        </div>

        {/* Notification Bar */}
        <div className="flex-1 mx-4 min-w-0 max-w-2xl flex justify-center">
          {notifications.editor && notifications.editorEnabled !== false && (
            <div className="relative flex items-center overflow-hidden rounded-full bg-gradient-to-r from-green-50 to-blue-50 px-3 py-1 border border-blue-100/50 shadow-sm max-w-[400px]">
              <Megaphone className="mr-2 h-4 w-4 text-green-600 flex-shrink-0" />
              <div className="w-[200px] h-6 relative overflow-hidden">
                <NotificationBar
                  message={notifications.editor}
                  className="bg-transparent border-none h-6 text-sm text-slate-700"
                  showIcon={false}
                />
              </div>
              <div className="mx-2 h-4 w-[1px] bg-slate-200" />
              <button
                onClick={() => setIsNotificationOpen(true)}
                className="whitespace-nowrap text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline"
              >
                立即查看
              </button>
              <button
                onClick={() => setNotifications({...notifications, editor: undefined})}
                className="ml-2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Export dropdown */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-1.5">
                    <Download className="h-4 w-4" />
                    <span className="text-xs">{i18nTexts.editorExport[language]}</span>
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>{i18nTexts.editorExportTooltip[language]}</TooltipContent>
            </Tooltip>
            <DropdownMenuContent>
              <DropdownMenuRadioGroup>
                <DropdownMenuRadioItem className='pl-2' value="svg" onClick={() => canvasRef.current?.exportAsSvg()}>
                  <Code className="mr-2 h-4 w-4" />
                  {i18nTexts.editorExportSVG[language]}
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem className='pl-2' value="png" onClick={() => canvasRef.current?.exportAsPng()}>
                  <Image className="mr-2 h-4 w-4" />
                  {i18nTexts.editorExportPNG[language]}
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem className='pl-2' value="source" onClick={() => canvasRef.current?.exportAsSource()}>
                  <FileText className="mr-2 h-4 w-4" />
                  {i18nTexts.editorExportSource[language]}
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Source Code button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => canvasRef.current?.toggleSourceCode()}
                className="gap-1.5"
              >
                <Code className="h-4 w-4" />
                <span className="text-xs">{i18nTexts.editorSourceCode[language]}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>{i18nTexts.editorSourceCodeTooltip[language]}</TooltipContent>
          </Tooltip>

          <div className="mx-1 h-4 w-px bg-border" />

          <Button
            variant={hasUnsavedChanges ? "default" : "ghost"}
            size="sm"
            onClick={handleSaveVersion}
            disabled={!hasUnsavedChanges}
          >
            <Save className="mr-2 h-4 w-4" />
            {i18nTexts.editorSave[language]}
          </Button>

          {mode !== 'example' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsVersionPanelOpen(!isVersionPanelOpen)}
            >
              <History className="mr-2 h-4 w-4" />
              {i18nTexts.editorHistory[language]}
            </Button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Chat Panel */}
        <div className={`flex-shrink-0 border-r border-border transition-all ${isChatPanelCollapsed ? 'w-10' : 'w-96'}`}>
          <div className={isChatPanelCollapsed ? 'hidden' : 'h-full'}>
            <ChatPanel onCollapse={() => setIsChatPanelCollapsed(true)} />
          </div>
          {isChatPanelCollapsed && (
            <div className="flex h-full flex-col items-center bg-surface py-2">
              <Button
                variant="ghost"
                size="icon"
                title={i18nTexts.editorExpandPanel[language]}
                onClick={() => setIsChatPanelCollapsed(false)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Center: Canvas */}
        <div className="relative flex-1">
          <CanvasArea ref={canvasRef} onReady={handleCanvasReady} />
          {/* Version Panel (floating) */}
          {isVersionPanelOpen && mode !== 'example' && (
            <VersionPanel onClose={() => setIsVersionPanelOpen(false)} />
          )}
        </div>
      </div>
    </div>

    {/* Notification Dialog */}
    <Dialog open={isNotificationOpen} onOpenChange={setIsNotificationOpen}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>系统通知</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <div
            className="text-sm leading-relaxed text-slate-700 [&_a]:text-blue-600 [&_a]:underline [&_strong]:font-semibold"
            dangerouslySetInnerHTML={{ __html: notifications.editor || '' }}
          />
        </div>
        <DialogFooter>
          <Button onClick={() => setIsNotificationOpen(false)}>关闭</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    </TooltipProvider>
  )
}
