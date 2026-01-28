import {ChevronDown, Languages, LogOut, Megaphone, X} from 'lucide-react'
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui'
import {NotificationBar} from '@/components/ui/NotificationBar'
import {authService} from '@/services/authService'
import {Link, useNavigate} from 'react-router-dom'
import {useAuthStore} from '@/stores/authStore'
import {useSystemStore} from '@/stores/systemStore'
import {ENGINES} from '@/constants'
import {useEffect, useState} from 'react'

export function AppHeader() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const defaultEngine = useSystemStore((state) => state.defaultEngine)
  const setDefaultEngine = useSystemStore((state) => state.setDefaultEngine)
  const language = useSystemStore((state) => state.language)
  const setLanguage = useSystemStore((state) => state.setLanguage)
  const i18nTexts = useSystemStore((state) => state.i18nTexts)
  const notifications = useSystemStore((state) => state.notifications)
  const setNotifications = useSystemStore((state) => state.setNotifications)
  const [isNotificationOpen, setIsNotificationOpen] = useState(false)

  useEffect(() => {
    const loadSystemSettings = async () => {
      try {
        const settings = await authService.getSystemSettings()
        if (settings.system?.notifications) {
          setNotifications({
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
  }, [setNotifications])

  const handleLogout = () => {
    authService.logout()
    navigate('/login')
  }

  return (
    <>
    <header className="relative flex items-center justify-between px-8 py-4">
      <div className="flex items-center gap-4 z-10">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2 rounded-full border-border bg-surface">
              <span className="text-sm font-medium">
                {ENGINES.find(e => e.value === defaultEngine)?.label || 'Draw.io'}
              </span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            {ENGINES.map((engine) => {
              const getEngineDesc = (value: string) => {
                switch (value) {
                  case 'mermaid':
                    return i18nTexts.engineMermaidDesc[language]
                  case 'excalidraw':
                    return i18nTexts.engineExcalidrawDesc[language]
                  case 'drawio':
                    return i18nTexts.engineDrawioDesc[language]
                  default:
                    return engine.description
                }
              }

              return (
                <DropdownMenuItem
                  key={engine.value}
                  onClick={() => setDefaultEngine(engine.value)}
                  className="flex flex-col items-start gap-1 py-2"
                >
                  <div className="flex w-full items-center justify-between">
                    <span className="font-medium">{engine.label}</span>
                    {defaultEngine === engine.value && (
                      <span className="h-2 w-2 rounded-full bg-primary" />
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {getEngineDesc(engine.value)}
                  </span>
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex items-center gap-6 ml-2">
          <Link to="/docs/manual" className="text-sm font-medium text-slate-700 hover:text-primary transition-colors">{i18nTexts.homeUserManual[language]}</Link>
          <Link to="/docs/changelog" className="text-sm font-medium text-slate-700 hover:text-primary transition-colors">{i18nTexts.homeChangelog[language]}</Link>
          <Link to="/docs/feedback" className="text-sm font-medium text-slate-700 hover:text-primary transition-colors">{i18nTexts.homeFeedback[language]}</Link>
        </div>
      </div>

      {/* Notification Bar - Moved to right side */}
      <div className="flex-1" />

      <div className="flex items-center gap-4">
        {notifications.homepage && notifications.homepageEnabled !== false && (
          <div className="relative flex items-center overflow-hidden rounded-full bg-gradient-to-r from-green-50 to-blue-50 px-3 py-1 border border-blue-100/50 shadow-sm max-w-[400px]">
            <Megaphone className="mr-2 h-4 w-4 text-green-600 flex-shrink-0" />
            <div className="w-[200px] h-6 relative overflow-hidden">
              <NotificationBar
                message={notifications.homepage}
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
              onClick={() => setNotifications({...notifications, homepage: undefined})}
              className="ml-2 text-slate-400 hover:text-slate-600"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2">
              <Languages className="h-4 w-4" />
              <span className="text-sm">{language === 'zh' ? '简体中文' : 'English'}</span>
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem
              onClick={() => setLanguage('zh')}
              className="flex items-center justify-between"
            >
              <span>简体中文</span>
              {language === 'zh' && (
                <span className="h-2 w-2 rounded-full bg-primary" />
              )}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setLanguage('en')}
              className="flex items-center justify-between"
            >
              <span>English</span>
              {language === 'en' && (
                <span className="h-2 w-2 rounded-full bg-primary" />
              )}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {user && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{user.nickname || user.username}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              title={i18nTexts.userLogout[language]}
              className="gap-2"
            >
              <LogOut className="h-4 w-4" />
              <span>{i18nTexts.btnLogout[language]}</span>
            </Button>
          </div>
        )}
      </div>
    </header>

      {/* Notification Dialog */}
      <Dialog open={isNotificationOpen} onOpenChange={setIsNotificationOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>系统通知</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <div
              className="text-sm leading-relaxed text-slate-700 [&_a]:text-blue-600 [&_a]:underline [&_strong]:font-semibold"
              dangerouslySetInnerHTML={{ __html: notifications.homepage || '' }}
            />
          </div>
          <DialogFooter>
            <Button onClick={() => setIsNotificationOpen(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
