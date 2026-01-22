import {useLocation, useNavigate} from 'react-router-dom'
import {ChevronLeft, ChevronRight, Cloud, Database, Github, LogOut, Plus, User} from 'lucide-react'
import {useState} from 'react'
import {NAV_ITEMS} from '@/constants'
import {useSystemStore} from '@/stores/systemStore'
import {useAuthStore} from '@/stores/authStore'
import {useStorageModeStore} from '@/stores/storageModeStore'
import {authService} from '@/services/authService'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Logo,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui'

interface AppSidebarProps {
  onCreateProject?: () => void
}

export function AppSidebar({ onCreateProject }: AppSidebarProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const showAbout = useSystemStore((state) => state.showAbout)
  const isCollapsed = useSystemStore((state) => state.sidebarCollapsed)
  const setSidebarCollapsed = useSystemStore((state) => state.setSidebarCollapsed)
  const logoColor = useSystemStore((state) => state.logoColor)
  const user = useAuthStore((state) => state.user)
  const { mode, setMode } = useStorageModeStore()
  const [isModeDialogOpen, setIsModeDialogOpen] = useState(false)

  const handleLogout = () => {
    authService.logout()
    navigate('/login')
  }

  const handleModeChange = (newMode: 'local' | 'cloud') => {
    if (newMode === mode) {
      setIsModeDialogOpen(false)
      return
    }

    setMode(newMode)
    setIsModeDialogOpen(false)
    // Force reload to ensure clean state and re-fetch data from correct source
    window.location.href = '/'
  }

  return (
    <TooltipProvider delayDuration={0}>
      <aside className="fixed left-0 top-0 z-40 flex h-screen w-[72px] flex-col items-center border-r border-border bg-surface py-4 transition-all duration-300">
        {/* Logo */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => navigate('/')}
              className="mb-6 flex h-10 w-10 items-center justify-center rounded-xl shadow-sm transition-transform hover:scale-105 active:scale-95"
              style={{ backgroundColor: logoColor }}
            >
              <Logo className="h-6 w-6" style={{ color: 'white' }} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">返回首页</TooltipContent>
        </Tooltip>

        {/* New Project Button */}
        {onCreateProject && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onCreateProject}
                className="group mb-6 flex flex-col items-center justify-center gap-1"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-dashed border-border bg-background transition-all group-hover:border-primary group-hover:text-primary">
                  <Plus className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
                </div>
                {!isCollapsed && <span className="text-[10px] font-medium text-muted-foreground group-hover:text-primary">新建</span>}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">新建文件</TooltipContent>
          </Tooltip>
        )}

        {/* Navigation Items */}
        <nav className="flex flex-1 flex-col items-center gap-4 w-full px-2">
          {NAV_ITEMS.map((item, index) => {
            if (item.path === '/about' && !showAbout) return null
            // @ts-expect-error - adminOnly property may not be defined on all nav items
            if (item.adminOnly && user?.role !== 'admin') return null

            const isActive = location.pathname === item.path

            return (
              <Tooltip key={index}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => navigate(item.path)}
                    className={`group flex w-full flex-col items-center justify-center gap-1 rounded-xl py-2 transition-all ${
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-muted/50 hover:text-primary'
                    }`}
                  >
                    <item.icon className={`h-5 w-5 ${isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-primary'}`} />
                    {!isCollapsed && (
                      <span className={`text-[10px] font-medium ${isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-primary'}`}>
                        {item.label}
                      </span>
                    )}
                  </button>
                </TooltipTrigger>
                {isCollapsed && <TooltipContent side="right">{item.label}</TooltipContent>}
              </Tooltip>
            )
          })}
        </nav>

        {/* Bottom Actions */}
        <div className="mt-auto flex flex-col items-center gap-4 w-full px-2 pb-2">

          {/* Mode Switcher */}
          <Dialog open={isModeDialogOpen} onOpenChange={setIsModeDialogOpen}>
            <Tooltip>
              <TooltipTrigger asChild>
                <DialogTrigger asChild>
                  <button
                    className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                      mode === 'local'
                        ? 'text-green-600 bg-green-50 hover:bg-green-100'
                        : 'text-blue-600 bg-blue-50 hover:bg-blue-100'
                    }`}
                  >
                    {mode === 'local' ? <Database className="h-5 w-5" /> : <Cloud className="h-5 w-5" />}
                  </button>
                </DialogTrigger>
              </TooltipTrigger>
              <TooltipContent side="right">
                {mode === 'local' ? '本地模式' : '云端模式'}
              </TooltipContent>
            </Tooltip>

            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>存储模式切换</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                {/* Local Mode Option */}
                <div
                  className={`cursor-pointer rounded-lg border p-4 transition-all hover:bg-muted ${
                    mode === 'local' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border'
                  }`}
                  onClick={() => handleModeChange('local')}
                >
                  <div className="flex items-center gap-2 font-medium text-foreground">
                    <Database className="h-4 w-4" /> 本地模式
                    {mode === 'local' && <span className="ml-auto text-xs text-primary">当前使用</span>}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                    所有信息存储在本地，包含AI 密钥，图表文件，适用于数据安全要求比较高的场景。
                  </p>
                </div>

                {/* Cloud Mode Option */}
                <div
                  className={`cursor-pointer rounded-lg border p-4 transition-all hover:bg-muted ${
                    mode === 'cloud' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border'
                  }`}
                  onClick={() => handleModeChange('cloud')}
                >
                  <div className="flex items-center gap-2 font-medium text-foreground">
                    <Cloud className="h-4 w-4" /> 云端模式
                    {mode === 'cloud' && <span className="ml-auto text-xs text-primary">当前使用</span>}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                    需要登录使用，配置信息及图表文件会保存到云端，适合私有部署的用户，这样切换电脑或浏览器，数据和配置保持同步。
                  </p>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* GitHub Link */}
          <Tooltip>
            <TooltipTrigger asChild>
              <a
                href="https://github.com/stone-yu/ai-draw"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-primary"
              >
                <Github className="h-5 w-5" />
              </a>
            </TooltipTrigger>
            <TooltipContent side="right">GitHub 开源仓库</TooltipContent>
          </Tooltip>

          {/* Collapse Toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setSidebarCollapsed(!isCollapsed)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-primary"
              >
                {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">{isCollapsed ? "展开菜单" : "折叠菜单"}</TooltipContent>
          </Tooltip>

          {/* User Avatar & Actions - Only show in Cloud Mode or if user happens to be logged in */}
          {(mode === 'cloud' || user) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex h-10 w-10 items-center justify-center rounded-full transition-all hover:bg-muted/50 focus:outline-none">
                  {user ? (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary ring-2 ring-background transition-shadow hover:ring-primary/20">
                      {(user.nickname || user.username).slice(0, 2).toUpperCase()}
                    </div>
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground ring-2 ring-background">
                      <User className="h-4 w-4" />
                    </div>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="right" className="w-56 ml-2">
                {user ? (
                  <>
                    <div className="flex items-center gap-2 p-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                        {(user.nickname || user.username).slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex flex-col space-y-0.5">
                        <p className="text-sm font-medium">{user.nickname || user.username}</p>
                        <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
                      </div>
                    </div>
                    <DropdownMenuItem onClick={() => navigate('/profile')}>
                      <User className="mr-2 h-4 w-4" />
                      <span>个人信息</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600">
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>退出登录</span>
                    </DropdownMenuItem>
                  </>
                ) : (
                  <DropdownMenuItem onClick={() => navigate('/login')}>
                    <User className="mr-2 h-4 w-4" />
                    <span>登录 / 注册</span>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </aside>
    </TooltipProvider>
  )
}
