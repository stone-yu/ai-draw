import {useEffect, useState} from 'react'
import {authService} from '@/services/authService'
import {useToast} from '@/hooks/useToast'
import {useFormatDate} from '@/hooks/useTranslation'
import {Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input} from '@/components/ui'
import {Copy, Eye, EyeOff, KeyRound, Pencil, Trash2, User} from 'lucide-react'
import {useAuthStore} from '@/stores/authStore'
import {useSystemStore} from '@/stores/systemStore'

interface AppUser {
  id: string
  username: string
  role?: string
  hasAccessPassword?: boolean
  createdAt?: string
  lastSeenAt?: string
  aiConfig?: {
    useCustom?: boolean
    provider?: string
    baseUrl?: string
    apiKey?: string
    modelId?: string
  }
}

interface LocalUser {
  id: string
  ipAddress: string
  nickname?: string
  firstSeenAt: string
  lastSeenAt: string
}

export function UserManagementTabs() {
  const [userTab, setUserTab] = useState<'cloud' | 'local'>('cloud')
  const [users, setUsers] = useState<AppUser[]>([])
  const [localUsers, setLocalUsers] = useState<LocalUser[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLocalUser, setSelectedLocalUser] = useState<LocalUser | null>(null)
  const [editingNickname, setEditingNickname] = useState('')
  const [selectedUserForPassword, setSelectedUserForPassword] = useState<AppUser | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const { success, error: showError } = useToast()
  const { formatDate } = useFormatDate()
  const currentUser = useAuthStore((state) => state.user)
  const language = useSystemStore((state) => state.language)
  const i18nTexts = useSystemStore((state) => state.i18nTexts)

  const handleCopyUserId = (userId: string) => {
    navigator.clipboard.writeText(userId)
    success(i18nTexts.statsCopyUserID[language])
  }

  const handleEditLocalUserNickname = (user: LocalUser) => {
    setSelectedLocalUser(user)
    setEditingNickname(user.nickname || '')
  }

  const handleSaveNickname = async () => {
    if (!selectedLocalUser) return

    try {
      await authService.updateLocalUserNickname(selectedLocalUser.id, editingNickname)
      setLocalUsers(localUsers.map(u =>
        u.id === selectedLocalUser.id ? { ...u, nickname: editingNickname } : u
      ))
      success(i18nTexts.adminNicknameUpdated[language])
      setSelectedLocalUser(null)
    } catch (_err) {
      showError(i18nTexts.adminUpdateNicknameFailed[language])
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      const [cloudData, localData] = await Promise.all([
        authService.getUsers(),
        authService.getLocalUsers()
      ])
      setUsers(cloudData)
      setLocalUsers(localData)
    } catch (_err) {
      showError(i18nTexts.adminLoadUsersFailed[language])
    } finally {
      setLoading(false)
    }
  }

  const handleRoleChange = async (userId: string, newRole: 'user' | 'admin') => {
    try {
      await authService.updateUserRole(userId, newRole)
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u))
      success(i18nTexts.adminRoleUpdateSuccess[language])
    } catch (_err) {
      showError(i18nTexts.adminRoleUpdateFailed[language])
    }
  }

  const handlePasswordReset = async () => {
    if (!selectedUserForPassword) return
    if (newPassword.length < 6) {
      showError(language === 'zh' ? '密码长度不能少于6位' : 'Password must be at least 6 characters')
      return
    }
    setResetLoading(true)
    try {
      await authService.adminResetUserPassword(selectedUserForPassword.id, newPassword)
      success(language === 'zh' ? '密码重置成功' : 'Password reset successfully')
      setSelectedUserForPassword(null)
      setNewPassword('')
    } catch (_err) {
      showError(language === 'zh' ? '密码重置失败' : 'Failed to reset password')
    } finally {
      setResetLoading(false)
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (!confirm(i18nTexts.adminConfirmDeleteUser[language])) return

    try {
      await authService.deleteUser(userId)
      setUsers(users.filter(u => u.id !== userId))
      success(i18nTexts.adminUserDeleted[language])
    } catch (_err) {
      showError(i18nTexts.adminDeleteUserFailed[language])
    }
  }

  if (loading) return <div>{i18nTexts.adminLoading[language]}</div>

  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => setUserTab('cloud')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            userTab === 'cloud'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted hover:text-primary'
          }`}
        >
          {i18nTexts.adminCloudUsers[language]} ({users.length})
        </button>
        <button
          onClick={() => setUserTab('local')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            userTab === 'local'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted hover:text-primary'
          }`}
        >
          {i18nTexts.adminLocalUsers[language]} ({localUsers.length})
        </button>
      </div>

      {userTab === 'cloud' && (
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
                            {i18nTexts.adminCurrentUser[language]}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted flex items-center gap-1">
                        <span>ID: {user.id}</span>
                        <button
                          onClick={() => handleCopyUserId(user.id)}
                          className="inline-flex items-center justify-center hover:bg-muted rounded p-0.5 transition-colors"
                          title={i18nTexts.adminCopyUserIDTitle[language]}
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      </div>
                {user.createdAt && (
                  <div className="text-xs text-muted">
                    {i18nTexts.adminRegisteredAt[language]}: {formatDate(new Date(user.createdAt), 'datetime')}
                  </div>
                )}
                      {user.lastSeenAt && (
                        <div className="text-xs text-muted">
                          {i18nTexts.adminLastSeenAt[language]}: {formatDate(new Date(user.lastSeenAt), 'datetime')}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted">{i18nTexts.adminRoleLabel[language]}</span>
                      <select
                        value={user.role || 'user'}
                        onChange={(e) => handleRoleChange(user.id, e.target.value as 'user' | 'admin')}
                        disabled={user.id === currentUser?.id}
                        className="h-7 rounded-md border border-input bg-background px-2 text-xs"
                      >
                        <option value="user">{i18nTexts.adminCommonUser[language]}</option>
                        <option value="admin">{i18nTexts.adminAdminUser[language]}</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title={i18nTexts.adminResetPassword[language]}
                        onClick={() => { setSelectedUserForPassword(user); setNewPassword(''); setShowPassword(false) }}
                      >
                        <KeyRound className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => handleDeleteUser(user.id)}
                        disabled={user.id === currentUser?.id}
                        title={user.id === currentUser?.id ? i18nTexts.adminCannotDeleteSelf[language] : i18nTexts.adminDeleteUser[language]}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {userTab === 'local' && (
        <div className="rounded-lg border border-border bg-card">
          <div className="p-4">
            <div className="space-y-4">
              {localUsers.length === 0 ? (
                <div className="text-center py-8 text-muted">{i18nTexts.statsNoRecords[language]}</div>
              ) : (
                localUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between rounded-lg border border-border p-4 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <User className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="font-medium text-sm flex items-center gap-2">
                          {user.nickname || i18nTexts.adminLocalUserLabel[language]}
                          <button
                            onClick={() => handleEditLocalUserNickname(user)}
                            className="inline-flex items-center justify-center hover:bg-muted rounded p-1 transition-colors"
                            title={i18nTexts.adminEditNickname[language]}
                          >
                            <Pencil className="h-3 w-3 text-muted-foreground" />
                          </button>
                        </div>
                        <div className="text-xs text-muted flex items-center gap-1">
                          <span>ID: {user.id}</span>
                          <button
                            onClick={() => handleCopyUserId(user.id)}
                            className="inline-flex items-center justify-center hover:bg-muted rounded p-0.5 transition-colors"
                            title={i18nTexts.adminCopyUserIDTitle[language]}
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        </div>
                        <div className="text-xs text-muted">IP: {user.ipAddress}</div>
                      </div>
                    </div>
                    <div className="text-xs text-muted">
                      <div>{i18nTexts.adminFirstSeenAt[language]}: {formatDate(new Date(user.firstSeenAt), 'datetime')}</div>
                      <div>{i18nTexts.adminLastSeenAt[language]}: {formatDate(new Date(user.lastSeenAt), 'datetime')}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Dialog */}
      {selectedUserForPassword && (
        <Dialog open={!!selectedUserForPassword} onOpenChange={(open) => !open && setSelectedUserForPassword(null)}>
          <DialogContent className="rounded-2xl sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>{language === 'zh' ? `重置密码 - ${selectedUserForPassword.username}` : `Reset Password - ${selectedUserForPassword.username}`}</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={language === 'zh' ? '输入新密码' : 'Enter new password'}
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
                {language === 'zh' ? '重置后，用户需要使用新密码登录。' : 'After reset, the user must log in with the new password.'}
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedUserForPassword(null)} className="rounded-full">
                {i18nTexts.profileCancel[language]}
              </Button>
              <Button onClick={handlePasswordReset} disabled={resetLoading} className="rounded-full">
                {resetLoading ? (language === 'zh' ? '重置中...' : 'Resetting...') : (language === 'zh' ? '确认重置' : 'Confirm Reset')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Local User Nickname Dialog */}
      <Dialog open={!!selectedLocalUser} onOpenChange={(open) => !open && setSelectedLocalUser(null)}>
        <DialogContent className="rounded-2xl sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{i18nTexts.adminEditNickname[language]}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={editingNickname}
              onChange={(e) => setEditingNickname(e.target.value)}
              placeholder={i18nTexts.adminUserRemark[language]}
            />
            <p className="mt-2 text-xs text-muted">
              {language === 'zh' ? '备注名仅管理员可见，用于标识和区分用户' : 'Nickname is only visible to administrators, used to identify and differentiate users'}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedLocalUser(null)} className="rounded-full">
              {i18nTexts.profileCancel[language]}
            </Button>
            <Button onClick={handleSaveNickname} className="rounded-full">
              {i18nTexts.profileSave[language]}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

