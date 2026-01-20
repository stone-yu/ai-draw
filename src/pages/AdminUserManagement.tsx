import {useEffect, useState} from 'react'
import {authService} from '@/services/authService'
import {useToast} from '@/hooks/useToast'
import {Button} from '@/components/ui'
import {KeyRound, Trash2, User} from 'lucide-react'
import {useAuthStore} from '@/stores/authStore'

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

interface LocalUser {
  id: string
  ipAddress: string
  firstSeenAt: string
  lastSeenAt: string
}

export function UserManagementTabs() {
  const [userTab, setUserTab] = useState<'cloud' | 'local'>('cloud')
  const [users, setUsers] = useState<AppUser[]>([])
  const [localUsers, setLocalUsers] = useState<LocalUser[]>([])
  const [loading, setLoading] = useState(true)
  const { success, error: showError } = useToast()
  const currentUser = useAuthStore((state) => state.user)

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
    } catch (_err) {
      showError('角色更新失败')
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('确定要删除该用户吗？此操作不可恢复。')) return

    try {
      await authService.deleteUser(userId)
      setUsers(users.filter(u => u.id !== userId))
      success('用户已删除')
    } catch (_err) {
      showError('删除用户失败')
    }
  }

  if (loading) return <div>加载中...</div>

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
          云端用户 ({users.length})
        </button>
        <button
          onClick={() => setUserTab('local')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            userTab === 'local'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted hover:text-primary'
          }`}
        >
          本地用户 ({localUsers.length})
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
                            登录用户
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted">ID: {user.id}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted">角色:</span>
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
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="重置密码"
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
        </div>
      )}

      {userTab === 'local' && (
        <div className="rounded-lg border border-border bg-card">
          <div className="p-4">
            <div className="space-y-4">
              {localUsers.length === 0 ? (
                <div className="text-center py-8 text-muted">暂无本地用户</div>
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
                        <div className="font-medium text-sm">本地用户</div>
                        <div className="text-xs text-muted">ID: {user.id}</div>
                        <div className="text-xs text-muted">IP: {user.ipAddress}</div>
                      </div>
                    </div>
                    <div className="text-xs text-muted">
                      <div>首次访问: {new Date(user.firstSeenAt).toLocaleString('zh-CN')}</div>
                      <div>最近访问: {new Date(user.lastSeenAt).toLocaleString('zh-CN')}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

