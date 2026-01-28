import {useEffect, useState} from 'react'
import {AppSidebar, CreateProjectDialog} from '@/components/layout'
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Logo,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui'
import {authService, type ExampleProject} from '@/services/authService'
import {useToast} from '@/hooks/useToast'
import {
  BarChart3,
  Bot,
  Eye,
  EyeOff,
  FileCode,
  KeyRound,
  Languages,
  Megaphone,
  Pencil,
  Settings2,
  Trash2,
  User,
  Users
} from 'lucide-react'
import {useNavigate} from 'react-router-dom'
import {useAuthStore} from '@/stores/authStore'
import {type I18nTexts, useSystemStore} from '@/stores/systemStore'
import {ENGINES} from '@/constants'
import type {EngineType} from '@/types'
import {UsageStatistics} from './AdminUsageStatsPage'
import {UserManagementTabs} from './AdminUserManagement'

export function AdminPage() {
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('admin_active_tab') || 'users'
  })
  const user = useAuthStore((state) => state.user)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const navigate = useNavigate()
  const language = useSystemStore((state) => state.language)
  const i18nTexts = useSystemStore((state) => state.i18nTexts)
  const setI18nTexts = useSystemStore((state) => state.setI18nTexts)

  useEffect(() => {
    if (user && user.role !== 'admin') {
      navigate('/')
    }
  }, [user, navigate])

  useEffect(() => {
    localStorage.setItem('admin_active_tab', activeTab)
  }, [activeTab])

  useEffect(() => {
    // Load i18n texts from server
    const loadI18nTexts = async () => {
      try {
        const settings = await authService.getSystemSettings()
        if (settings.system && 'i18nTexts' in settings.system) {
          setI18nTexts((settings.system as any).i18nTexts)
        }
      } catch {
        // Silently fail, use defaults
      }
    }
    loadI18nTexts()
  }, [setI18nTexts])

  if (!user || user.role !== 'admin') {
    return null
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <AppSidebar onCreateProject={() => setIsCreateDialogOpen(true)} />
      <main className="flex flex-1 flex-col pl-[72px] h-full">
        <div className="flex flex-1 w-full bg-background overflow-hidden">
            <div className="flex h-full w-full">
              {/* 左侧 Tab */}
              <div className="w-64 border-r border-border bg-surface/50 p-4 overflow-y-auto">
                <nav className="space-y-1">
                  <button
                    onClick={() => setActiveTab('users')}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                      activeTab === 'users'
                        ? 'bg-primary text-surface'
                        : 'text-muted hover:bg-background hover:text-primary'
                    }`}
                  >
                    <Users className="h-4 w-4" />
                    <span>{i18nTexts.adminUsers[language]}</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('basic')}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                      activeTab === 'basic'
                        ? 'bg-primary text-surface'
                        : 'text-muted hover:bg-background hover:text-primary'
                    }`}
                  >
                    <Settings2 className="h-4 w-4" />
                    <span>{i18nTexts.adminBasicSettings[language]}</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('llm')}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                      activeTab === 'llm'
                        ? 'bg-primary text-surface'
                        : 'text-muted hover:bg-background hover:text-primary'
                    }`}
                  >
                    <Bot className="h-4 w-4" />
                    <span>{i18nTexts.adminLLMModel[language]}</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('notifications')}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                      activeTab === 'notifications'
                        ? 'bg-primary text-surface'
                        : 'text-muted hover:bg-background hover:text-primary'
                    }`}
                  >
                    <Megaphone className="h-4 w-4" />
                    <span>{i18nTexts.adminNotifications[language]}</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('i18n')}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                      activeTab === 'i18n'
                        ? 'bg-primary text-surface'
                        : 'text-muted hover:bg-background hover:text-primary'
                    }`}
                  >
                    <Languages className="h-4 w-4" />
                    <span>{i18nTexts.adminI18n[language]}</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('examples')}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                      activeTab === 'examples'
                        ? 'bg-primary text-surface'
                        : 'text-muted hover:bg-background hover:text-primary'
                    }`}
                  >
                    <FileCode className="h-4 w-4" />
                    <span>{i18nTexts.adminExamples[language]}</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('stats')}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                      activeTab === 'stats'
                        ? 'bg-primary text-surface'
                        : 'text-muted hover:bg-background hover:text-primary'
                    }`}
                  >
                    <BarChart3 className="h-4 w-4" />
                    <span>{i18nTexts.adminStats[language]}</span>
                  </button>
                </nav>
              </div>

              {/* 右侧内容区 */}
              <div className="flex-1 bg-surface p-6 overflow-y-auto">
                {activeTab === 'users' && (
                  <>
                    <h2 className="mb-6 text-lg font-medium text-primary">{i18nTexts.adminUsers[language]}</h2>
                    <UserManagementTabs />
                  </>
                )}

                {activeTab === 'basic' && (
                  <>
                    <h2 className="mb-6 text-lg font-medium text-primary">{i18nTexts.adminBasicSettings[language]}</h2>
                    <BasicSettings />
                  </>
                )}

                {activeTab === 'llm' && (
                  <>
                    <h2 className="mb-6 text-lg font-medium text-primary">{i18nTexts.adminLLMModel[language]}</h2>
                    <LLMSettings />
                  </>
                )}

                {activeTab === 'notifications' && (
                  <>
                    <h2 className="mb-6 text-lg font-medium text-primary">{i18nTexts.adminNotifications[language]}</h2>
                    <NotificationSettings />
                  </>
                )}

                {activeTab === 'i18n' && (
                  <>
                    <h2 className="mb-6 text-lg font-medium text-primary">{i18nTexts.adminI18n[language]}</h2>
                    <I18nSettings />
                  </>
                )}

                {activeTab === 'examples' && (
                  <>
                    <h2 className="mb-6 text-lg font-medium text-primary">{i18nTexts.adminExamples[language]}</h2>
                    <ExampleProjectsManagement />
                  </>
                )}

                {activeTab === 'stats' && (
                  <>
                    <h2 className="mb-6 text-lg font-medium text-primary">{i18nTexts.adminStats[language]}</h2>
                    <UsageStatistics />
                  </>
                )}
              </div>
            </div>
        </div>
      </main>

      <CreateProjectDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      />
    </div>
  )
}

interface AppUser {
  id: string
  username: string
  role?: string
  hasAccessPassword?: boolean
  aiConfig?: {
    useCustom?: boolean
    provider?: string
    baseUrl?: string
    apiKey?: string
    modelId?: string
  }
}

function UserManagement() {
  const [users, setUsers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const { success, error: showError } = useToast()
  const currentUser = useAuthStore((state) => state.user)
  const language = useSystemStore((state) => state.language)
  const i18nTexts = useSystemStore((state) => state.i18nTexts)
  const [selectedUserForConfig, setSelectedUserForConfig] = useState<AppUser | null>(null)
  const [selectedUserForPassword, setSelectedUserForPassword] = useState<AppUser | null>(null)
  const [selectedUserForAccessPassword, setSelectedUserForAccessPassword] = useState<AppUser | null>(null)

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      const data = await authService.getUsers()
      setUsers(data)
    } catch (err) {
      showError('加载用户列表失败')
    } finally {
      setLoading(false)
    }
  }

  const handleRoleChange = async (userId: string, newRole: 'user' | 'admin') => {
    try {
      await authService.updateUserRole(userId, newRole)
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u))
      success('角色更新成功')
    } catch (err) {
      showError('角色更新失败')
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('确定要删除该用户吗？此操作不可恢复。')) return

    try {
      await authService.deleteUser(userId)
      setUsers(users.filter(u => u.id !== userId))
      success('用户已删除')
    } catch (err) {
      showError('删除用户失败')
    }
  }

  const handleConfigSave = async (userId: string, config: any) => {
    try {
      await authService.adminUpdateUserAIConfig(userId, config)
      setUsers(users.map(u => u.id === userId ? { ...u, aiConfig: config } : u))
      success('用户配置已更新')
      setSelectedUserForConfig(null)
    } catch (err) {
      showError('更新配置失败')
    }
  }

  const handlePasswordReset = async (userId: string, password: string) => {
    try {
      await authService.adminResetUserPassword(userId, password)
      success('密码重置成功')
      setSelectedUserForPassword(null)
    } catch (err) {
      showError('密码重置失败')
    }
  }

  const handleAccessPasswordSave = async (userId: string, password: string) => {
    try {
      await authService.adminUpdateUserAccessPassword(userId, password)
      setUsers(users.map(u => u.id === userId ? { ...u, hasAccessPassword: !!password } : u))
      success('访问密码已更新')
      setSelectedUserForAccessPassword(null)
    } catch (err) {
      showError('更新访问密码失败')
    }
  }

  if (loading) return <div>加载中...</div>

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="p-4">
        <div className="space-y-4">
          {users.map((user) => (
            <div
              key={user.id}
              className="flex items-center justify-between rounded-lg border border-border p-4 transition-colors hover:bg-muted/50"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-medium">
                    {user.username}
                    {user.id === currentUser?.id && (
                      <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">
                        登录用户
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted">ID: {user.id}</div>
                </div>
              </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted">{i18nTexts.adminRole[language]}:</span>
                    <select
                      value={user.role || 'user'}
                      onChange={(e) => handleRoleChange(user.id, e.target.value as 'user' | 'admin')}
                    disabled={user.id === currentUser?.id}
                    className="h-7 rounded-md border border-input bg-background px-2 text-xs"
                  >
                    <option value="user">普通用户</option>
                    <option value="admin">管理员</option>
                  </select>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setSelectedUserForConfig(user)}
                  >
                    LLM设置
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className={`h-7 px-2 text-xs ${user.hasAccessPassword ? "text-primary border-primary/30 bg-primary/5" : "text-muted-foreground"}`}
                    onClick={() => setSelectedUserForAccessPassword(user)}
                  >
                    {user.hasAccessPassword ? "修改访问密码" : "设置访问密码"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    title="重置密码"
                    onClick={() => setSelectedUserForPassword(user)}
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => handleDeleteUser(user.id)}
                    disabled={user.id === currentUser?.id}
                    title={user.id === currentUser?.id ? '不能删除自己' : '删除用户'}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {selectedUserForConfig && (
        <AdminUserAIConfigDialog
          open={!!selectedUserForConfig}
          onOpenChange={(open) => !open && setSelectedUserForConfig(null)}
          user={selectedUserForConfig}
          onSave={handleConfigSave}
        />
      )}

      {selectedUserForPassword && (
        <AdminResetPasswordDialog
          open={!!selectedUserForPassword}
          onOpenChange={(open) => !open && setSelectedUserForPassword(null)}
          user={selectedUserForPassword}
          onSave={handlePasswordReset}
        />
      )}

      {selectedUserForAccessPassword && (
        <AdminAccessPasswordDialog
          open={!!selectedUserForAccessPassword}
          onOpenChange={(open) => !open && setSelectedUserForAccessPassword(null)}
          user={selectedUserForAccessPassword}
          onSave={handleAccessPasswordSave}
        />
      )}
    </div>
  )
}

interface AdminUserAIConfigDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: AppUser
  onSave: (userId: string, config: any) => Promise<void>
}

function AdminUserAIConfigDialog({ open, onOpenChange, user, onSave }: AdminUserAIConfigDialogProps) {
  const [mode, setMode] = useState<'password' | 'custom'>('password')
  const [provider, setProvider] = useState('openai')
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [modelId, setModelId] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open && user.aiConfig) {
      setMode(user.aiConfig.useCustom ? 'custom' : 'password')
      setProvider(user.aiConfig.provider || 'openai')
      setBaseUrl(user.aiConfig.baseUrl || '')
      setApiKey(user.aiConfig.apiKey || '')
      setModelId(user.aiConfig.modelId || '')
    } else {
      // Reset to defaults
      setMode('password')
      setProvider('openai')
      setBaseUrl('')
      setApiKey('')
      setModelId('')
    }
  }, [open, user])

  const handleSave = async () => {
    setLoading(true)
    try {
      await onSave(user.id, {
        useCustom: mode === 'custom',
        provider,
        baseUrl,
        apiKey,
        modelId
      })
      onOpenChange(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>用户 LLM 配置 - {user.username}</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <div className="mb-6 flex gap-4">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="admin-ai-mode"
                checked={mode === 'password'}
                onChange={() => setMode('password')}
                className="h-4 w-4 text-primary"
              />
              <span className="text-sm">使用系统默认</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="admin-ai-mode"
                checked={mode === 'custom'}
                onChange={() => setMode('custom')}
                className="h-4 w-4 text-primary"
              />
              <span className="text-sm">自定义模型</span>
            </label>
          </div>

          {mode === 'custom' && (
            <div className="space-y-4 rounded-lg border border-border p-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-muted">API类型</label>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="openai">OpenAI</option>
                  <option value="azure">Azure OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="custom">Custom (OpenAI Compatible)</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-muted">API地址</label>
                <Input
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://api.openai.com/v1"
                  className="rounded-xl"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-muted">API Key</label>
                <div className="relative">
                  <Input
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-..."
                    className="rounded-xl pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-primary"
                  >
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-muted">模型 ID</label>
                <Input
                  value={modelId}
                  onChange={(e) => setModelId(e.target.value)}
                  placeholder="gpt-3.5-turbo"
                  className="rounded-xl"
                />
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-full">
            取消
          </Button>
          <Button onClick={handleSave} disabled={loading} className="rounded-full">
            {loading ? '保存中...' : '保存配置'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface AdminResetPasswordDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: AppUser
  onSave: (userId: string, password: string) => Promise<void>
}

function AdminResetPasswordDialog({ open, onOpenChange, user, onSave }: AdminResetPasswordDialogProps) {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const { error: showError } = useToast()

  useEffect(() => {
    if (!open) setPassword('')
  }, [open])

  const handleSave = async () => {
    if (password.length < 6) {
      showError('密码长度不能少于6位')
      return
    }
    setLoading(true)
    try {
      await onSave(user.id, password)
      onOpenChange(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>重置密码 - {user.username}</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <div className="relative">
            <Input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="输入新密码"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-primary"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="mt-2 text-xs text-muted">
            重置后，用户需要使用新密码登录。
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-full">
            取消
          </Button>
          <Button onClick={handleSave} disabled={loading} className="rounded-full">
            {loading ? '重置中...' : '确认重置'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface AdminAccessPasswordDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: AppUser
  onSave: (userId: string, accessPassword: string) => Promise<void>
}

function AdminAccessPasswordDialog({ open, onOpenChange, user, onSave }: AdminAccessPasswordDialogProps) {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const { error: showError } = useToast()

  useEffect(() => {
    if (!open) setPassword('')
  }, [open])

  const handleSave = async () => {
    setLoading(true)
    try {
      await onSave(user.id, password)
      onOpenChange(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>设置访问密码 - {user.username}</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <div className="relative">
            <Input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="输入访问密码（留空则清除）"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-primary"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="mt-2 text-xs text-muted">
            设置后，用户需在 AI 设置中输入此密码以使用系统默认模型。
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-full">
            取消
          </Button>
          <Button onClick={handleSave} disabled={loading} className="rounded-full">
            {loading ? '保存中...' : '确认保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}


function NotificationSettings() {
  const [homepageNotification, setHomepageNotification] = useState('')
  const [homepageEnabled, setHomepageEnabled] = useState(true)
  const [homepageAnnouncement, setHomepageAnnouncement] = useState('')
  const [homepageAnnouncementEnabled, setHomepageAnnouncementEnabled] = useState(true)
  const [editorNotification, setEditorNotification] = useState('')
  const [editorEnabled, setEditorEnabled] = useState(true)
  const [loading, setLoading] = useState(false)
  const { success, error: showError } = useToast()
  const setNotifications = useSystemStore((state) => state.setNotifications)
  const [systemSettings, setSystemSettings] = useState<any>({})

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const settings = await authService.getSystemSettings()
      console.log('[NotificationSettings] Loaded settings:', settings)
      if (settings.system?.notifications) {
        setHomepageNotification(settings.system.notifications.homepage || '')
        setHomepageEnabled(settings.system.notifications.homepageEnabled !== false)
        setHomepageAnnouncement(settings.system.notifications.homepageAnnouncement || '')
        setHomepageAnnouncementEnabled(settings.system.notifications.homepageAnnouncementEnabled !== false)
        setEditorNotification(settings.system.notifications.editor || '')
        setEditorEnabled(settings.system.notifications.editorEnabled !== false)
      }
      if (settings.system) {
        setSystemSettings(settings.system)
      }
    } catch (err) {
      console.error('[NotificationSettings] Failed to load settings:', err)
      showError(`加载配置失败: ${err instanceof Error ? err.message : '未知错误'}`)
    }
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      const currentSettings = await authService.getSystemSettings()

      await authService.updateSystemSettings({
        ...currentSettings,
        system: {
          ...currentSettings.system,
          notifications: {
            homepage: homepageNotification,
            homepageEnabled,
            homepageAnnouncement: homepageAnnouncement,
            homepageAnnouncementEnabled,
            editor: editorNotification,
            editorEnabled
          }
        }
      })

      setNotifications({
        homepage: homepageNotification,
        homepageEnabled,
        homepageAnnouncement: homepageAnnouncement,
        homepageAnnouncementEnabled,
        editor: editorNotification,
        editorEnabled
      })
      success('通知配置已保存')
    } catch (err) {
      showError('保存配置失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-muted">首页顶部滚动通知</label>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="homepageEnabled"
              checked={homepageEnabled}
              onChange={(e) => setHomepageEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <label htmlFor="homepageEnabled" className="text-sm font-medium text-muted cursor-pointer">
              启用
            </label>
          </div>
        </div>
        <textarea
          value={homepageNotification}
          onChange={(e) => setHomepageNotification(e.target.value)}
          placeholder="输入首页通知内容，支持 HTML 标签如 <b>加粗</b>, <a href='...'>链接</a>"
          className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm min-h-[100px]"
        />
        <p className="mt-2 text-xs text-muted">
          显示在首页顶部的滚动通知。留空则不显示。支持 HTML 格式（如 &lt;b&gt;加粗&lt;/b&gt;, &lt;a href=&quot;#&quot;&gt;链接&lt;/a&gt;）。
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-muted">首页右侧公告框</label>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="homepageAnnouncementEnabled"
              checked={homepageAnnouncementEnabled}
              onChange={(e) => setHomepageAnnouncementEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <label htmlFor="homepageAnnouncementEnabled" className="text-sm font-medium text-muted cursor-pointer">
              启用
            </label>
          </div>
        </div>
        <textarea
          value={homepageAnnouncement}
          onChange={(e) => setHomepageAnnouncement(e.target.value)}
          placeholder="输入首页公告内容..."
          className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm min-h-[100px]"
        />
        <p className="mt-2 text-xs text-muted">
          显示在首页右上角的公告框。留空则不显示。支持 HTML 格式。高度根据内容自动调整。
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-muted">编辑器通知</label>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="editorEnabled"
              checked={editorEnabled}
              onChange={(e) => setEditorEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <label htmlFor="editorEnabled" className="text-sm font-medium text-muted cursor-pointer">
              启用
            </label>
          </div>
        </div>
        <textarea
          value={editorNotification}
          onChange={(e) => setEditorNotification(e.target.value)}
          placeholder="输入编辑器通知内容..."
          className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm min-h-[100px]"
        />
        <p className="mt-2 text-xs text-muted">
          显示在编辑器页面顶部的滚动通知。留空则不显示。
        </p>
      </div>

      <div className="flex gap-3 pt-4">
        <Button onClick={handleSave} disabled={loading} className="rounded-full">
          {loading ? '保存中...' : '保存配置'}
        </Button>
      </div>
    </div>
  )
}

function I18nSettings() {
  const globalI18nTexts = useSystemStore((state) => state.i18nTexts)
  const [texts, setTexts] = useState<I18nTexts>(globalI18nTexts)
  const [loading, setLoading] = useState(false)
  const { success, error: showError } = useToast()
  const setGlobalI18nTexts = useSystemStore((state) => state.setI18nTexts)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const settings = await authService.getSystemSettings()
      if (settings.system && 'i18nTexts' in settings.system) {
        setTexts((settings.system as any).i18nTexts)
      }
    } catch {
      showError('加载多语言设置失败')
    }
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      await authService.updateSystemSettings({
        system: {
          i18nTexts: texts
        }
      } as any)
      setGlobalI18nTexts(texts)
      success('多语言设置已保存')
    } catch {
      showError('保存多语言设置失败')
    } finally {
      setLoading(false)
    }
  }

  const handleTextChange = (key: keyof I18nTexts, lang: 'zh' | 'en', value: string) => {
    setTexts(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        [lang]: value
      }
    }))
  }

  const textFields: Array<{key: keyof I18nTexts; label: string}> = [
    { key: 'menuHome', label: '菜单 - 首页' },
    { key: 'menuProjects', label: '菜单 - 文件管理' },
    { key: 'menuProfile', label: '菜单 - 个人设置' },
    { key: 'menuAdmin', label: '菜单 - 管理后台' },
    { key: 'menuAbout', label: '菜单 - 关于我们' },
    { key: 'btnNewProject', label: '按钮 - 新建文件' },
    { key: 'btnBackHome', label: '按钮 - 返回首页' },
    { key: 'btnLogout', label: '按钮 - 退出' },
    { key: 'homeTitle', label: '首页 - 标题' },
    { key: 'homeSubtitle', label: '首页 - 副标题' },
    { key: 'homePlaceholder', label: '首页 - 输入框提示' },
    { key: 'homeUploadFile', label: '首页 - 上传文件' },
    { key: 'homeAddLink', label: '首页 - 添加链接' },
    { key: 'homePasteImageTip', label: '首页 - 粘贴图片提示' },
    { key: 'homeSystemDefault', label: '首页 - 系统默认' },
    { key: 'homeQuickStart', label: '首页 - 快速开始' },
    { key: 'homeRecentFiles', label: '首页 - 最近文件' },
    { key: 'homeUserManual', label: '文档 - 使用手册' },
    { key: 'homeChangelog', label: '文档 - 更新日志' },
    { key: 'homeFeedback', label: '文档 - 问题反馈' },
    { key: 'profileUserInfo', label: '个人设置 - 个人信息' },
    { key: 'profileAIConfig', label: '个人设置 - AI模型配置' },
    { key: 'profileSystemDefaultHint', label: '个人设置 - 系统默认提示' },
    { key: 'userProfile', label: '用户菜单 - 个人信息' },
    { key: 'userLogout', label: '用户菜单 - 退出登录' },
    { key: 'userLogin', label: '用户菜单 - 登录注册' },
  ]

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm text-muted mb-4">
          自定义系统各处文本的中英文显示内容，修改后立即生效。
        </p>

        <div className="space-y-4">
          {textFields.map(({ key, label }) => (
            <div key={key} className="grid grid-cols-1 gap-3">
              <label className="text-sm font-medium text-muted">{label}</label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">简体中文</label>
                  <Input
                    value={texts[key].zh}
                    onChange={(e) => handleTextChange(key, 'zh', e.target.value)}
                    className="rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">English</label>
                  <Input
                    value={texts[key].en}
                    onChange={(e) => handleTextChange(key, 'en', e.target.value)}
                    className="rounded-xl"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-3 pt-6 mt-6 border-t border-border">
          <Button onClick={handleSave} disabled={loading} className="rounded-full">
            {loading ? '保存中...' : '保存配置'}
          </Button>
          <Button
            variant="outline"
            onClick={loadSettings}
            disabled={loading}
            className="rounded-full"
          >
            重置
          </Button>
        </div>
      </div>
    </div>
  )
}

function ExampleProjectsManagement() {
  const [projects, setProjects] = useState<ExampleProject[]>([])
  const [loading, setLoading] = useState(true)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const { success, error: showError } = useToast()
  const navigate = useNavigate()
  const [draggedItem, setDraggedItem] = useState<ExampleProject | null>(null)
  const [previewProject, setPreviewProject] = useState<ExampleProject | null>(null)

  useEffect(() => {
    loadProjects()
  }, [])

  const loadProjects = async () => {
    try {
      const data = await authService.getExampleProjects()
      setProjects(data)
    } catch (err) {
      showError('加载示例文件失败')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除该示例文件吗？')) return
    try {
      await authService.deleteExampleProject(id)
      setProjects(projects.filter(p => p.id !== id))
      success('删除成功')
    } catch (err) {
      showError('删除失败')
    }
  }

  const handleDragStart = (e: React.DragEvent, item: ExampleProject) => {
    setDraggedItem(item)
    e.dataTransfer.effectAllowed = 'move'
    // Optional: Set drag image
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (!draggedItem) return

    const draggedIndex = projects.findIndex(p => p.id === draggedItem.id)
    if (draggedIndex === index) return

    const newProjects = [...projects]
    const [item] = newProjects.splice(draggedIndex, 1)
    newProjects.splice(index, 0, item)
    setProjects(newProjects)
  }

  const handleDragEnd = async () => {
    setDraggedItem(null)
    try {
      const ids = projects.map(p => p.id)
      await authService.reorderExampleProjects(ids)
    } catch (err) {
      showError('保存排序失败')
    }
  }

  if (loading) return <div>加载中...</div>

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="text-sm text-muted">
          这些文件将在新用户注册时自动复制到其文件列表中（仅复制前6个）。
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)} size="sm">
          新增示例文件
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {projects.map((project, index) => (
          <div
            key={project.id}
            draggable
            onDragStart={(e) => handleDragStart(e, project)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
            className={`group relative overflow-hidden rounded-lg border border-border bg-card transition-all hover:shadow-md cursor-move ${
              draggedItem?.id === project.id ? 'opacity-50' : ''
            }`}
          >
            <div
              className="h-32 w-full bg-background/50 p-2 border-b border-dashed border-border/60 cursor-pointer"
              onClick={() => setPreviewProject(project)}
            >
              {project.thumbnail ? (
                <img src={project.thumbnail} alt={project.title} className="h-full w-full object-contain" />
              ) : (
                <div className="flex h-full items-center justify-center text-muted">
                  No Preview
                </div>
              )}
            </div>
            <div className="p-2">
              <div className="font-medium truncate text-sm">{project.title}</div>
              <div className="text-xs text-muted mt-0.5">{project.engineType}</div>
            </div>
            <div className="absolute right-1 top-1 opacity-0 transition-opacity group-hover:opacity-100 flex gap-1">
              <Button size="icon" variant="secondary" className="h-6 w-6" onClick={() => navigate(`/editor/example/${project.id}`)}>
                <Pencil className="h-3 w-3" />
              </Button>
              <Button size="icon" variant="destructive" className="h-6 w-6" onClick={() => handleDelete(project.id)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <CreateExampleProjectDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      />

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
                    <div className="h-24 w-24 opacity-20 mb-4 flex items-center justify-center">
                      <FileCode className="h-full w-full" />
                    </div>
                    <p>暂无预览图</p>
                  </div>
                )}
              </div>
              <div className="bg-white p-6 flex items-center justify-between border-t border-border">
                <div className="flex items-center gap-4">
                  <h2 className="text-xl font-semibold text-primary">{previewProject?.title}</h2>
                  <p className="text-sm text-muted-foreground">
                    {previewProject?.engineType}
                  </p>
                </div>
                <Button
                  onClick={() => {
                    if (previewProject) {
                      navigate(`/editor/example/${previewProject.id}`)
                    }
                  }}
                  className="rounded-full px-6"
                >
                  编辑模版
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function CreateExampleProjectDialog({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate()
  const [title, setTitle] = useState('未命名示例')
  const [engineType, setEngineType] = useState<EngineType>('drawio')
  const [loading, setLoading] = useState(false)
  const { success, error: showError } = useToast()

  useEffect(() => {
    if (open) {
      setTitle('未命名示例')
      setEngineType('drawio')
    }
  }, [open])

  const handleCreate = async () => {
    if (!title.trim()) return
    setLoading(true)
    try {
      const project = await authService.createExampleProject({
        title: title.trim(),
        engineType,
        content: '',
        thumbnail: ''
      })
      success('创建成功')
      onOpenChange(false)
      navigate(`/editor/example/${project.id}`)
    } catch (err) {
      showError('创建失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-md">
        <DialogHeader>
          <DialogTitle>新增示例文件</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <label className="mb-2 block text-sm font-medium">文件标题</label>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="输入标题"
              className="rounded-xl"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">绘图引擎</label>
            <Select value={engineType} onValueChange={(v) => setEngineType(v as EngineType)}>
              <SelectTrigger className="w-full rounded-xl">
                <SelectValue placeholder="选择引擎" />
              </SelectTrigger>
              <SelectContent>
                {ENGINES.map(e => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-full">取消</Button>
          <Button onClick={handleCreate} disabled={loading} className="rounded-full">{loading ? '创建中...' : '创建'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function BasicSettings() {
  const [allowRegister, setAllowRegister] = useState(true)
  const [defaultEngine, setDefaultEngine] = useState<EngineType>('drawio')
  const [logoColor, setLogoColorLocal] = useState('#000000')
  const [aiSettings, setAiSettings] = useState<any>({})
  const [useLocalDrawio, setUseLocalDrawio] = useState(false)
  const [drawioBaseUrl, setDrawioBaseUrl] = useState('')

  const [loading, setLoading] = useState(false)
  const { success, error: showError } = useToast()
  const setGlobalDefaultEngine = useSystemStore((state) => state.setDefaultEngine)
  const setGlobalLogoColor = useSystemStore((state) => state.setLogoColor)
  const setGlobalDrawioConfig = useSystemStore((state) => state.setDrawioConfig)
  const language = useSystemStore((state) => state.language)
  const i18nTexts = useSystemStore((state) => state.i18nTexts)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const settings = await authService.getSystemSettings()
      if (settings.system) {
        setAllowRegister(settings.system.allowRegister !== false)
        setDefaultEngine(settings.system.defaultEngine || 'drawio')
        setLogoColorLocal(settings.system.logoColor || '#000000')
        setUseLocalDrawio(settings.system.useLocalDrawio || false)
        setDrawioBaseUrl(settings.system.drawioBaseUrl || '')
      } else {
        setAllowRegister(true)
        setDefaultEngine('drawio')
        setLogoColorLocal('#000000')
        setUseLocalDrawio(false)
        setDrawioBaseUrl('')
      }

      if (settings.ai) {
        setAiSettings(settings.ai)
      }
    } catch {
      showError(i18nTexts.basicLoadFailed[language])
    }
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      await authService.updateSystemSettings({
        system: {
          allowRegister,
          defaultEngine,
          logoColor,
          useLocalDrawio,
          drawioBaseUrl
        },
        ai: aiSettings
      })
      setGlobalDefaultEngine(defaultEngine)
      setGlobalLogoColor(logoColor)
      setGlobalDrawioConfig({ useLocalDrawio, drawioBaseUrl })
      success(i18nTexts.basicSaveSuccess[language])
    } catch {
      showError(i18nTexts.basicSaveFailed[language])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-2 block text-sm font-medium text-muted">{i18nTexts.adminDefaultEngine[language]}</label>
        <select
          value={defaultEngine}
          onChange={(e) => setDefaultEngine(e.target.value as EngineType)}
          className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
        >
          {ENGINES.map((engine) => (
            <option key={engine.value} value={engine.value}>
              {engine.label}
            </option>
          ))}
        </select>
        <p className="mt-2 text-xs text-muted">
          {i18nTexts.basicDefaultEngineDesc[language]}
        </p>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-muted">{i18nTexts.adminLogoColor[language]}</label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={logoColor}
            onChange={(e) => setLogoColorLocal(e.target.value)}
            className="h-10 w-20 rounded-xl border border-input cursor-pointer"
          />
          <Input
            value={logoColor}
            onChange={(e) => setLogoColorLocal(e.target.value)}
            placeholder="#000000"
            className="rounded-xl flex-1"
          />
          <div
            className="h-10 w-10 rounded-xl border border-border flex items-center justify-center"
            style={{ backgroundColor: logoColor }}
          >
            <Logo style={{ color: 'white' }} className="h-6 w-6" />
          </div>
        </div>
        <p className="mt-2 text-xs text-muted">
          {i18nTexts.basicLogoColorDesc[language]}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="allowRegister"
          checked={allowRegister}
          onChange={(e) => setAllowRegister(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
        />
        <label htmlFor="allowRegister" className="text-sm font-medium text-muted cursor-pointer">
          {i18nTexts.adminAllowRegister[language]}
        </label>
      </div>

      <div className="border-t border-border pt-4 mt-4">
        <h3 className="text-sm font-medium text-muted mb-4">{i18nTexts.basicDrawioConfig[language]}</h3>

        <div className="flex items-center gap-2 mb-4">
          <input
            type="checkbox"
            id="useLocalDrawio"
            checked={useLocalDrawio}
            onChange={(e) => setUseLocalDrawio(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
          />
          <label htmlFor="useLocalDrawio" className="text-sm font-medium text-muted cursor-pointer">
            {i18nTexts.basicUseLocalDrawio[language]}
          </label>
        </div>

        {useLocalDrawio && (
          <div>
            <label className="mb-2 block text-sm font-medium text-muted">{i18nTexts.basicDrawioAddress[language]}</label>
            <Input
              value={drawioBaseUrl}
              onChange={(e) => setDrawioBaseUrl(e.target.value)}
              placeholder={i18nTexts.basicDrawioAddressPlaceholder[language]}
              className="rounded-xl"
            />
            <p className="mt-2 text-xs text-muted">
              {i18nTexts.basicDrawioDesc[language]}<code className="bg-muted/50 px-1 py-0.5 rounded">docker run -d -p 8080:8080 jgraph/drawio</code>
            </p>
          </div>
        )}
      </div>

      <div className="flex gap-3 pt-4">
        <Button onClick={handleSave} disabled={loading} className="rounded-full">
          {loading ? i18nTexts.basicSaving[language] : i18nTexts.adminSaveConfig[language]}
        </Button>
      </div>
    </div>
  )
}

function LLMSettings() {
  const [provider, setProvider] = useState('openai')
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [modelId, setModelId] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [systemSettings, setSystemSettings] = useState<any>({})

  const [loading, setLoading] = useState(false)
  const { success, error: showError } = useToast()

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const settings = await authService.getSystemSettings()
      if (settings.ai) {
        setProvider(settings.ai.provider || 'openai')
        setBaseUrl(settings.ai.baseUrl || '')
        setApiKey(settings.ai.apiKey || '')
        setModelId(settings.ai.modelId || '')
      }
      if (settings.system) {
        setSystemSettings(settings.system)
      }
    } catch (err) {
      showError('加载配置失败')
    }
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      await authService.updateSystemSettings({
        system: systemSettings,
        ai: {
          provider,
          baseUrl,
          apiKey,
          modelId
        }
      })
      success('LLM配置已保存')
    } catch (err) {
      showError('保存配置失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-2 block text-sm font-medium text-muted">API类型</label>
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="openai">OpenAI</option>
          <option value="azure">Azure OpenAI</option>
          <option value="anthropic">Anthropic</option>
          <option value="custom">Custom (OpenAI Compatible)</option>
        </select>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-muted">API地址</label>
        <Input
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="https://api.openai.com/v1"
          className="rounded-xl"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-muted">API Key</label>
        <div className="relative">
          <Input
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
            className="rounded-xl pr-10"
          />
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-primary"
          >
            {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-muted">模型 ID</label>
        <Input
          value={modelId}
          onChange={(e) => setModelId(e.target.value)}
          placeholder="gpt-3.5-turbo"
          className="rounded-xl"
        />
      </div>

      <div className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
        <p>配置全局 LLM API 后，所有用户使用默认服务器都使用此配置</p>
      </div>

      <div className="flex gap-3 pt-4">
        <Button onClick={handleSave} disabled={loading} className="rounded-full">
          {loading ? '保存中...' : '保存配置'}
        </Button>
      </div>
    </div>
  )
}

