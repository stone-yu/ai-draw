import {useEffect, useRef, useState} from 'react'
import {useNavigate} from 'react-router-dom'
import {Bot, Edit, Info, Link, MoveRight, Paperclip, Send, X} from 'lucide-react'
import {v4 as uuidv4} from 'uuid'
import {Button, Dialog, DialogContent, Loading, Logo} from '@/components/ui'
import {AppHeader, AppSidebar, CreateProjectDialog} from '@/components/layout'
import {ModelSelector} from '@/components/ai/ModelSelector'
import {HTML_STYLES, QUICK_ACTION_ROWS, QUICK_ACTIONS} from '@/constants'
import {formatDate} from '@/lib/utils'
import type {Attachment, DocumentAttachment, HtmlStyleVariant, ImageAttachment, Project, UrlAttachment} from '@/types'
import {ProjectRepository} from '@/services/projectRepository'
import {useChatStore} from '@/stores/chatStore'
import {useAuthStore} from '@/stores/authStore'
import {useSystemStore} from '@/stores/systemStore'
import {useStorageModeStore} from '@/stores/storageModeStore'
import {aiService} from '@/services/aiService'
import {authService} from '@/services/authService'
import {db} from '@/services/db'
import {useToast} from '@/hooks/useToast'
import {
  fileToBase64,
  parseDocument,
  SUPPORTED_DOCUMENT_EXTENSIONS,
  SUPPORTED_IMAGE_TYPES,
  validateDocumentFile,
  validateImageFile,
} from '@/lib/fileUtils'

export function HomePage() {
  const navigate = useNavigate()
  const [prompt, setPrompt] = useState('')
  const defaultEngine = useSystemStore((state) => state.defaultEngine)
  const logoColor = useSystemStore((state) => state.logoColor)
  const language = useSystemStore((state) => state.language)
  const i18nTexts = useSystemStore((state) => state.i18nTexts)
  const notifications = useSystemStore((state) => state.notifications)
  const [isLoading, setIsLoading] = useState(false)
  const [recentProjects, setRecentProjects] = useState<Project[]>([])
  const [attachments, setAttachments] = useState<File[]>([])
  const [urlAttachments, setUrlAttachments] = useState<UrlAttachment[]>([])
  const [showUrlInput, setShowUrlInput] = useState(false)
  const [urlInputValue, setUrlInputValue] = useState('')
  const [isParsingUrl, setIsParsingUrl] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const setInitialPrompt = useChatStore((state) => state.setInitialPrompt)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const storageMode = useStorageModeStore((state) => state.mode)
  const { error: showError } = useToast()

  // 新建项目弹窗状态
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)

  // Register local user when entering homepage
  useEffect(() => {
    const registerLocalUserIfNeeded = async () => {
      if (storageMode === 'local') {
        const localUserId = useStorageModeStore.getState().localUserId

        // Check if already registered in IndexedDB
        const registeredFlag = await db.configs.get('local_user_registered')

        if (!registeredFlag) {
          // First time, register and mark as registered
          await authService.registerLocalUser(localUserId)
          await db.configs.put({ key: 'local_user_registered', value: true })
        } else {
          // Already registered locally, check if exists in cloud
          try {
            const response = await fetch('/api/local-users/check', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId: localUserId })
            })
            const data = await response.json()
            if (!data.exists) {
              // Not in cloud, register again
              await authService.registerLocalUser(localUserId)
            }
          } catch (error) {
            // If check fails, try to register anyway (will update if exists)
            await authService.registerLocalUser(localUserId)
          }
        }
      }
    }

    registerLocalUserIfNeeded()
  }, [storageMode])

  const [previewProject, setPreviewProject] = useState<Project | null>(null)
  const [isAnnouncementOpen, setIsAnnouncementOpen] = useState(true)
  const [quickStartHtmlStyle, setQuickStartHtmlStyle] = useState<HtmlStyleVariant>('dark-tech')
  const [isStyleDialogOpen, setIsStyleDialogOpen] = useState(false)

  useEffect(() => {
    // 小屏幕默认收起公告，避免遮挡
    if (window.innerWidth < 1280) {
      setIsAnnouncementOpen(false)
    }
  }, [])

  useEffect(() => {
    loadRecentProjects()
    // Load system settings including notifications
    const loadSystemSettings = async () => {
      try {
        const settings = await authService.getSystemSettings()
        if (settings.system?.notifications) {
          useSystemStore.getState().setNotifications({
            homepage: settings.system.notifications.homepage,
            homepageEnabled: settings.system.notifications.homepageEnabled,
            editor: settings.system.notifications.editor,
            editorEnabled: settings.system.notifications.editorEnabled,
            homepageAnnouncement: settings.system.notifications.homepageAnnouncement,
            homepageAnnouncementEnabled: settings.system.notifications.homepageAnnouncementEnabled,
          })
        }
      } catch (error) {
        console.error('Failed to load system settings:', error)
      }
    }
    loadSystemSettings()
  }, [])

  // 点击外部关闭引擎选择下拉框
  // useEffect(() => {
  //   const handleClickOutside = () => setShowEngineDropdown(false)
  //   if (showEngineDropdown) {
  //     document.addEventListener('click', handleClickOutside)
  //     return () => document.removeEventListener('click', handleClickOutside)
  //   }
  // }, [showEngineDropdown])

  const loadRecentProjects = async () => {
    try {
      const { items: projects } = await ProjectRepository.getAll(1, 4)

      // 如果是本地模式且没有项目，尝试加载示例项目
      if (storageMode === 'local' && projects.length === 0) {
        try {
          const examples = await authService.getPublicExampleProjects()
          if (examples.length > 0) {
            // 批量保存示例项目到本地
            await db.transaction('rw', db.projects, db.versions, async () => {
              for (const example of examples) {
                const projectId = uuidv4() // 生成新 ID
                const now = new Date()

                // 1. 添加项目
                await db.projects.add({
                  id: projectId,
                  title: example.title,
                  engineType: example.engineType,
                  thumbnail: example.thumbnail,
                  createdAt: now,
                  updatedAt: now,
                })

                // 2. 添加初始版本
                await db.versions.add({
                  id: uuidv4(),
                  projectId: projectId,
                  content: example.content,
                  changeSummary: 'Initial (Example)',
                  timestamp: now,
                })
              }
            })
            // 重新加载项目
            const { items: newProjects } = await ProjectRepository.getAll(1, 4)
            setRecentProjects(newProjects)
            return
          }
        } catch (err) {
          console.error('Failed to load example projects:', err)
        }
      }

      setRecentProjects(projects)
    } catch (error) {
      console.error('Failed to load projects:', error)
    }
  }

  const handleQuickStart = () => {
    if (!prompt.trim()) return

    if (storageMode === 'cloud' && !isAuthenticated()) {
      navigate('/login')
      return
    }

    // For html engine, ask the user which style first. Otherwise proceed.
    if (defaultEngine === 'html') {
      setIsStyleDialogOpen(true)
      return
    }

    executeQuickStart()
  }

  const executeQuickStart = async (styleOverride?: HtmlStyleVariant) => {
    setIsLoading(true)
    try {
      const variant = styleOverride ?? quickStartHtmlStyle
      const project = await ProjectRepository.create({
        title: `Untitled-${Date.now()}`,
        engineType: defaultEngine,
        styleVariant: defaultEngine === 'html' ? variant : undefined,
      })

      // 转换文件附件为 Attachment 类型
      const convertedAttachments: Attachment[] = []

      for (const file of attachments) {
        if (SUPPORTED_IMAGE_TYPES.includes(file.type)) {
          const dataUrl = await fileToBase64(file)
          const imageAtt: ImageAttachment = {
            type: 'image',
            dataUrl,
            fileName: file.name,
          }
          convertedAttachments.push(imageAtt)
        } else {
          const content = await parseDocument(file)
          const docAtt: DocumentAttachment = {
            type: 'document',
            content,
            fileName: file.name,
          }
          convertedAttachments.push(docAtt)
        }
      }

      // 添加 URL 附件
      convertedAttachments.push(...urlAttachments)

      // 传递 prompt 和附件
      const allAttachments = convertedAttachments.length > 0 ? convertedAttachments : null
      setInitialPrompt(prompt.trim(), allAttachments)
      navigate(`/editor/${project.id}`)
    } catch (error) {
      console.error('Failed to create project:', error)
      showError('创建项目失败，请重试')
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleQuickStart()
    }
  }

  // 处理剪贴板粘贴
  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items
    if (!items) return

    const filesToProcess: File[] = []

    for (const item of items) {
      if (item.kind === 'file') {
        const file = item.getAsFile()
        if (file) {
          filesToProcess.push(file)
        }
      }
    }

    if (filesToProcess.length === 0) return

    e.preventDefault()

    for (const file of filesToProcess) {
      // 处理图片
      if (SUPPORTED_IMAGE_TYPES.includes(file.type)) {
        const validation = validateImageFile(file)
        if (!validation.valid) {
          showError(validation.error!)
          continue
        }
        // 为粘贴的图片生成文件名
        const fileName = file.name || `pasted-image-${Date.now()}.png`
        const newFile = new File([file], fileName, { type: file.type })
        setAttachments(prev => [...prev, newFile])
      }
      // 处理文档
      else if (SUPPORTED_DOCUMENT_EXTENSIONS.some(ext => file.name.toLowerCase().endsWith(ext.replace('*', '')))) {
        const validation = validateDocumentFile(file)
        if (!validation.valid) {
          showError(validation.error!)
          continue
        }
        setAttachments(prev => [...prev, file])
      }
    }
  }

  const handleQuickAction = async (action: (typeof QUICK_ACTIONS)[0]) => {
    const promptText = typeof action.prompt === 'string' ? action.prompt : action.prompt[language]
    setPrompt(promptText)

    // 如果有图片，自动添加为附件（替换现有图片）
    if (action.image) {
      try {
        setIsLoading(true)
        const response = await fetch(action.image)
        const blob = await response.blob()
        const fileName = action.image.split('/').pop() || 'image.png'
        const file = new File([blob], fileName, { type: blob.type })

        // 过滤掉现有的图片附件，保留非图片附件（如果需要完全替换所有附件，可以直接 setAttachments([file])）
        // 这里假设只替换图片，保留文档等其他类型附件
        setAttachments(prev => {
          const nonImageAttachments = prev.filter(f => !f.type.startsWith('image/'))
          return [...nonImageAttachments, file]
        })
      } catch (error) {
        console.error('Failed to load image attachment:', error)
        showError('加载示例图片失败')
      } finally {
        setIsLoading(false)
      }
    }

    // 自动聚焦到输入框
    if (textareaRef.current) {
      textareaRef.current.focus()
    }
  }

  const handleAttachmentClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files) {
      setAttachments(prev => [...prev, ...Array.from(files)])
    }
  }

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index))
  }

  const removeUrlAttachment = (index: number) => {
    setUrlAttachments(prev => prev.filter((_, i) => i !== index))
  }

  const handleUrlSubmit = async () => {
    const url = urlInputValue.trim()
    if (!url) return

    setIsParsingUrl(true)
    try {
      const result = await aiService.parseUrl(url)
      if (result.data) {
        const urlAttachment: UrlAttachment = {
          type: 'url',
          content: result.data.content,
          url: result.data.url,
          title: result.data.title,
        }
        setUrlAttachments(prev => [...prev, urlAttachment])
        setUrlInputValue('')
        setShowUrlInput(false)
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : '链接解析失败')
      console.error(err)
    } finally {
      setIsParsingUrl(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Floating Sidebar Navigation */}
      <AppSidebar onCreateProject={() => setIsCreateDialogOpen(true)} />

      {/* Main Content */}
      <main className="flex flex-1 flex-col pl-[72px] overflow-x-hidden">
        {/* Header */}
        <AppHeader />

        {/* Homepage Announcement Box */}
        {notifications.homepageAnnouncement && notifications.homepageAnnouncementEnabled !== false && (
          <div className="absolute right-8 top-24 flex items-start gap-3 z-20 animate-in fade-in slide-in-from-top-4 duration-500">
            <button
              onClick={() => setIsAnnouncementOpen(!isAnnouncementOpen)}
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-green-100 to-blue-100 shadow-sm border border-blue-50 hover:shadow-md transition-all hover:scale-105 active:scale-95"
              title={isAnnouncementOpen ? "收起公告" : "展开公告"}
            >
              <Bot className="h-6 w-6 text-blue-600" />
            </button>
            {isAnnouncementOpen && (
              <div className="relative max-w-xs rounded-2xl rounded-tl-none bg-gradient-to-r from-green-50 to-blue-50 p-4 shadow-md border border-blue-100/50 animate-in fade-in slide-in-from-left-2 duration-300">
                <button
                  onClick={() => setIsAnnouncementOpen(false)}
                  className="absolute right-2 top-2 p-1 text-slate-400 hover:text-slate-600 hover:bg-blue-100/50 rounded-full transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
                <div
                  className="text-sm text-slate-700 [&_a]:underline [&_a]:text-blue-600 hover:[&_a]:text-blue-700 [&_a]:cursor-pointer [&_strong]:font-semibold [&_strong]:text-slate-900 pr-4"
                  dangerouslySetInnerHTML={{ __html: notifications.homepageAnnouncement }}
                />
              </div>
            )}
          </div>
        )}

        {/* Hero Section */}
        <div className="flex flex-1 flex-col items-center px-8 pt-12">


          {/* Logo & Slogan */}
          <div className="mb-12 flex flex-col items-center">
            <div className="mb-6 flex items-center gap-3 text-4xl font-bold text-primary sm:text-5xl">
              <span>AI Draw</span>
              <div className="flex h-12 w-12 items-center justify-center rounded-full shadow-sm" style={{ backgroundColor: logoColor }}>
                <Logo className="h-7 w-7" style={{ color: 'white' }} />
              </div>
              <span>{i18nTexts.homeTitle[language]}</span>
            </div>
            <p className="text-lg text-muted-foreground">{i18nTexts.homeSubtitle[language]}</p>
          </div>

          {/* Chat Input Box */}
          <div className="mb-6 w-full max-w-2xl relative">
            {/* 附件预览区域 - 移到输入框上方 */}
            {(attachments.length > 0 || urlAttachments.length > 0) && (
              <div className="absolute bottom-full left-0 mb-2 flex flex-wrap gap-2 px-1">
                {attachments.map((file, index) => (
                  <div
                    key={`file-${index}`}
                    className="group relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface shadow-sm"
                  >
                    {file.type.startsWith('image/') ? (
                      <img
                        src={URL.createObjectURL(file)}
                        alt={file.name}
                        className="h-full w-full object-cover"
                        onLoad={(e) => URL.revokeObjectURL(e.currentTarget.src)}
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center p-1 text-center">
                        <Paperclip className="h-6 w-6 text-muted-foreground" />
                        <span className="mt-1 w-full truncate text-[10px] text-muted-foreground">
                          {file.name.split('.').pop()}
                        </span>
                      </div>
                    )}
                    <button
                      onClick={() => removeAttachment(index)}
                      className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity hover:bg-black/70 group-hover:opacity-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {urlAttachments.map((urlAtt, index) => (
                  <div
                    key={`url-${index}`}
                    className="group relative flex h-16 w-16 flex-col items-center justify-center overflow-hidden rounded-lg border border-border bg-surface p-1 shadow-sm"
                  >
                    <Link className="h-6 w-6 text-muted-foreground" />
                    <span className="mt-1 w-full truncate text-center text-[10px] text-muted-foreground">
                      LINK
                    </span>
                    <button
                      onClick={() => removeUrlAttachment(index)}
                      className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity hover:bg-black/70 group-hover:opacity-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm transition-shadow focus-within:shadow-md">
              <textarea
                ref={textareaRef}
                placeholder={i18nTexts.homePlaceholder[language]}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                disabled={isLoading}
                className="min-h-[60px] w-full resize-none bg-transparent text-primary placeholder:text-muted focus:outline-none"
                rows={2}
              />

              {/* 隐藏的文件输入 */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileChange}
                className="hidden"
                accept="image/*,.pdf,.doc,.docx,.txt"
              />

              {/* 底部工具栏 */}
              <div className="flex items-center justify-between border-t border-border pt-3 mt-2">
                <div className="flex items-center gap-3">
                  {/* 上传附件 */}
                  <button
                    onClick={handleAttachmentClick}
                    className="group relative flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-muted transition-colors hover:bg-background hover:text-primary"
                    title={language === 'zh' ? '上传文档（图片、PDF、文本）' : 'Upload documents (images, PDF, text)'}
                  >
                    <Paperclip className="h-4 w-4" />
                    <span>{i18nTexts.homeUploadFile[language]}</span>
                    <div className="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-primary px-3 py-2 text-xs text-surface opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                      可上传文档一键转化为图表，或上传截图复刻图表
                      <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-primary"></div>
                    </div>
                  </button>

                  {/* 添加链接 */}
                  <div className="relative">
                    <button
                      onClick={() => setShowUrlInput(!showUrlInput)}
                      disabled={isParsingUrl}
                      className="group relative flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-muted transition-colors hover:bg-background hover:text-primary disabled:opacity-50"
                      title={language === 'zh' ? '添加网页链接，AI将解析内容' : 'Add webpage link, AI will parse content'}
                    >
                      <Link className="h-4 w-4" />
                      <span>{i18nTexts.homeAddLink[language]}</span>
                      <div className="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-primary px-3 py-2 text-xs text-surface opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                        添加网页链接，AI将解析内容生成图表
                        <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-primary"></div>
                      </div>
                    </button>

                    {/* 链接输入弹出框 */}
                    {showUrlInput && (
                      <div className="absolute bottom-full left-0 mb-2 flex items-center gap-2 rounded-lg border border-border bg-surface p-2 shadow-lg">
                        <input
                          type="url"
                          placeholder="输入网址链接..."
                          value={urlInputValue}
                          onChange={(e) => setUrlInputValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              handleUrlSubmit()
                            } else if (e.key === 'Escape') {
                              setShowUrlInput(false)
                              setUrlInputValue('')
                            }
                          }}
                          disabled={isParsingUrl}
                          className="w-64 rounded border border-border bg-background px-2 py-1 text-sm outline-none focus:border-primary disabled:opacity-50"
                          autoFocus
                        />
                        <Button
                          size="sm"
                          onClick={handleUrlSubmit}
                          disabled={!urlInputValue.trim() || isParsingUrl}
                          className="h-7 px-2"
                        >
                          <>{isParsingUrl ? <Loading size="sm" /> : <MoveRight className="h-4 w-4" />}</>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setShowUrlInput(false)
                            setUrlInputValue('')
                          }}
                          disabled={isParsingUrl}
                          className="h-7 px-2"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="h-3 w-[1px] bg-border mx-1" />
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground/50 select-none">
                    <Info className="h-3 w-3" />
                    <span>{i18nTexts.homePasteImageTip[language]}</span>
                  </div>

                  <div className="h-3 w-[1px] bg-border mx-1" />
                  <ModelSelector />
                </div>

                {/* 发送按钮 */}
                <Button
                  onClick={handleQuickStart}
                  disabled={!prompt.trim() || isLoading}
                  className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm text-surface transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  <>{isLoading ? (
                    <span>{i18nTexts.homeCreating[language]}</span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Send className="h-4 w-4" />
                      <span>{i18nTexts.homeSend[language]}</span>
                    </div>
                  )}</>
                </Button>
              </div>
            </div>
          </div>

          <div className="flex w-full max-w-6xl flex-col gap-6 pb-12 lg:flex-row">
            {/* Quick Actions */}
            <div className="w-full lg:w-[60%]">
              <div className="h-full rounded-[32px] bg-surface p-6 shadow-sm border border-border/40 md:p-6">
                <div className="mb-4 flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    {/*<Sparkles className="h-5 w-5 text-primary" />*/}
                    <h2 className="text-lg font-medium text-primary">{i18nTexts.homeQuickStart[language]}</h2>
                  </div>
                </div>
                <div className="flex flex-col gap-4 overflow-hidden">
                  {/* Row 1: Left */}
                  <div className="relative flex overflow-hidden w-full">
                    <div className="flex gap-4 py-2 animate-marquee-left w-max" style={{ animationDuration: '60s' }}>
                      {(() => {
                        const group = QUICK_ACTION_ROWS[0]
                        const items = [...group, ...group, ...group, ...group]
                        return items.map((action, index) => (
                        <button
                          key={`r1-${index}`}
                          onClick={() => handleQuickAction(action)}
                          disabled={isLoading}
                          className="group relative flex items-center gap-3 rounded-full bg-white px-5 py-3 shadow-sm border border-border/50 transition-all hover:shadow-md hover:border-primary/20 flex-shrink-0 whitespace-nowrap"
                        >
                          {action.image && (
                            <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-md bg-background/50 border border-border/60 p-1">
                              <img src={action.image} alt={action.label} className="h-full w-full object-contain" />
                            </div>
                          )}
                          <span className="text-sm font-medium text-gray-900 mt-0.5">
                            {typeof action.prompt === 'string' ? action.prompt : action.prompt[language]}
                          </span>
                        </button>
                      ))})()}
                    </div>
                  </div>

                  {/* Row 2: Right */}
                  <div className="relative flex overflow-hidden w-full">
                    <div className="flex gap-4 py-2 animate-marquee-right w-max" style={{ animationDuration: '70s' }}>
                      {(() => {
                        const group = QUICK_ACTION_ROWS[1]
                        const items = [...group, ...group, ...group, ...group]
                        return items.map((action, index) => (
                        <button
                          key={`r2-${index}`}
                          onClick={() => handleQuickAction(action)}
                          disabled={isLoading}
                          className="group relative flex items-center gap-3 rounded-full bg-white px-5 py-3 shadow-sm border border-border/50 transition-all hover:shadow-md hover:border-primary/20 flex-shrink-0 whitespace-nowrap"
                        >
                          {action.image && (
                            <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-md bg-background/50 border border-border/60 p-1">
                              <img src={action.image} alt={action.label} className="h-full w-full object-contain" />
                            </div>
                          )}
                          <span className="text-sm font-medium text-gray-900 mt-0.5">
                            {typeof action.prompt === 'string' ? action.prompt : action.prompt[language]}
                          </span>
                        </button>
                      ))})()}
                    </div>
                  </div>

                  {/* Row 3: Left */}
                  <div className="relative flex overflow-hidden w-full">
                    <div className="flex gap-4 py-2 animate-marquee-left w-max" style={{ animationDuration: '80s' }}>
                      {(() => {
                        const group = QUICK_ACTION_ROWS[2]
                        const items = [...group, ...group, ...group, ...group]
                        return items.map((action, index) => (
                        <button
                          key={`r3-${index}`}
                          onClick={() => handleQuickAction(action)}
                          disabled={isLoading}
                          className="group relative flex items-center gap-3 rounded-full bg-white px-5 py-3 shadow-sm border border-border/50 transition-all hover:shadow-md hover:border-primary/20 flex-shrink-0 whitespace-nowrap"
                        >
                          {action.image && (
                            <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-md bg-background/50 border border-border/60 p-1">
                              <img src={action.image} alt={action.label} className="h-full w-full object-contain" />
                            </div>
                          )}
                          <span className="text-sm font-medium text-gray-900 mt-0.5">
                            {typeof action.prompt === 'string' ? action.prompt : action.prompt[language]}
                          </span>
                        </button>
                      ))})()}
                    </div>
                  </div>

                  <style>{`
                    @keyframes marquee-left {
                      0% { transform: translateX(0); }
                      100% { transform: translateX(-25%); }
                    }
                    @keyframes marquee-right {
                      0% { transform: translateX(-25%); }
                      100% { transform: translateX(0); }
                    }
                    .animate-marquee-left {
                      animation: marquee-left linear infinite;
                    }
                    .animate-marquee-right {
                      animation: marquee-right linear infinite;
                    }
                    .animate-marquee-left:hover,
                    .animate-marquee-right:hover {
                      animation-play-state: paused;
                    }
                  `}</style>
                </div>
              </div>
            </div>

            {/* Recent Projects Section */}
            <div className="w-full lg:w-[40%]">
              <div className="h-full rounded-[32px] bg-surface p-6 shadow-sm border border-border/40 md:p-6">
                <div className="mb-4 flex items-center justify-between px-1">
                  <div>
                    <h2 className="text-lg font-medium text-primary">{i18nTexts.homeRecentFiles[language]}</h2>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                {/* Recent Projects */}
                {recentProjects.slice(0, 4).map((project) => (
                  <div
                    key={project.id}
                    onClick={() => setPreviewProject(project)}
                    onDoubleClick={() => navigate(`/editor/${project.id}`)}
                    className="group relative flex flex-col overflow-hidden rounded-2xl bg-background/80 transition-all duration-300 hover:-translate-y-1 hover:bg-surface hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-transparent hover:border-border/50 cursor-pointer"
                  >
                    <div className="absolute left-2 top-2 z-10 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button
                        size="icon"
                        variant="secondary"
                        className="h-8 w-8 rounded-full bg-surface/90 shadow-sm backdrop-blur-sm hover:bg-surface"
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate(`/editor/${project.id}`)
                        }}
                      >
                        <Edit className="h-4 w-4 text-primary" />
                      </Button>
                    </div>
                    <div className="absolute right-2 top-2 z-10 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <div className="rounded-md bg-surface/90 px-2 py-1 text-[10px] font-medium text-muted-foreground shadow-sm backdrop-blur-sm">
                        更新于 {formatDate(project.updatedAt)}
                      </div>
                    </div>
                    <div className="flex h-20 items-center justify-center bg-white p-3 border-b border-dashed border-border/60 overflow-hidden">
                      {project.thumbnail ? (
                        <div className="flex h-full w-full items-center justify-center">
                          <img
                            src={project.thumbnail}
                            alt={project.title}
                            className="max-h-full max-w-full object-contain"
                          />
                        </div>
                      ) : (
                        <Logo className="h-8 w-8 text-muted/50 group-hover:text-primary/50 transition-colors" />
                      )}
                    </div>
                    <div className="p-2.5 text-left w-full bg-white">
                      <div className="mb-1.5 flex items-center gap-2">
                        <p className="truncate text-sm font-medium text-primary/90 group-hover:text-primary pl-1">
                          {project.title === `Untitled-${project.id}`
                            ? '未命名'
                            : project.title}
                        </p>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className={`flex-shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium ${
                          project.engineType === 'excalidraw'
                            ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                            : project.engineType === 'drawio'
                              ? 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400'
                              : 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400'
                        }`}>
                          {project.engineType.toUpperCase()}
                        </span>
                        <p className="text-[10px] text-muted-foreground/60 ml-auto">
                          {formatDate(project.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Create Project Dialog */}
      <CreateProjectDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      />

      {/* HTML Style Picker (only shown when quick-start engine is html) */}
      <Dialog open={isStyleDialogOpen} onOpenChange={setIsStyleDialogOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <div className="space-y-4 py-2">
            <div>
              <h3 className="text-base font-semibold text-primary">选择 HTML 风格</h3>
              <p className="mt-1 text-xs text-muted-foreground">创建后风格不可更改，如需切换请新建项目。</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {HTML_STYLES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => {
                    setQuickStartHtmlStyle(s.value)
                    setIsStyleDialogOpen(false)
                    executeQuickStart(s.value)
                  }}
                  className={`rounded-xl border p-3 text-left transition ${
                    quickStartHtmlStyle === s.value
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-muted/30 hover:border-primary/50'
                  }`}
                >
                  <div className="text-sm font-medium">{s.label}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{s.description}</div>
                </button>
              ))}
            </div>
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={() => setIsStyleDialogOpen(false)} className="rounded-full">
                取消
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Project Preview Dialog */}
      <Dialog open={!!previewProject} onOpenChange={() => setPreviewProject(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden bg-transparent border-none shadow-none">
          <div className="relative flex flex-col items-center justify-center">
            <div className="relative w-full bg-white rounded-lg overflow-hidden shadow-2xl">
              <div className="flex items-center justify-center bg-white p-8 min-h-[400px]">
                {previewProject?.thumbnail ? (
                  <img
                    src={previewProject.thumbnail}
                    alt={previewProject.title}
                    className="max-w-full max-h-[60vh] object-contain shadow-lg rounded-md"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-muted-foreground">
                    <Logo className="h-24 w-24 opacity-20 mb-4" />
                    <p>暂无预览图</p>
                  </div>
                )}
              </div>
              <div className="bg-white p-6 flex items-center justify-between border-t border-border">
                <div className="flex flex-col gap-2 flex-1 mr-4">
                  <h2 className="text-xl font-semibold text-primary truncate" title={previewProject?.title}>{previewProject?.title}</h2>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>创建时间：{previewProject && formatDate(previewProject.createdAt, true)}</span>
                    <span className="w-px h-3 bg-border"></span>
                    <span>更新时间：{previewProject && formatDate(previewProject.updatedAt, true)}</span>
                  </div>
                </div>
                <Button
                  onClick={() => {
                    if (previewProject) {
                      navigate(`/editor/${previewProject.id}`)
                    }
                  }}
                  className="rounded-full px-8 h-12 text-base shrink-0"
                >
                  进入编辑
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
