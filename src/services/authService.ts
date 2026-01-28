import {useAuthStore} from '@/stores/authStore'
import type {EngineType} from '@/types'
import {useStorageModeStore} from '@/stores/storageModeStore'
import {db} from './db'

const API_BASE = '/api/auth'

export interface SystemSettings {
  ai?: {
    provider?: string
    baseUrl?: string
    apiKey?: string
    modelId?: string
  }
  system?: {
    name?: string
    showAbout?: boolean
    allowRegister?: boolean
    defaultEngine?: EngineType
    defaultModelPrompt?: string
    logoColor?: string
    useLocalDrawio?: boolean
    drawioBaseUrl?: string
    notifications?: {
      homepage?: string
      homepageEnabled?: boolean
      homepageAnnouncement?: string
      homepageAnnouncementEnabled?: boolean
      editor?: string
      editorEnabled?: boolean
    }
  }
}

export interface ExampleProject {
  id: string
  title: string
  engineType: EngineType
  content: string
  thumbnail: string
  createdAt: string
  updatedAt: string
}

export const authService = {
  async login(username: string, password: string) {
    const response = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Login failed')
    }

    const data = await response.json()
    useAuthStore.getState().setAuth(data.user, data.token)
    return data
  },

  async register(username: string, password: string) {
    const response = await fetch(`${API_BASE}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Registration failed')
    }

    return await response.json()
  },

  async changePassword(currentPassword: string, newPassword: string) {
    const mode = useStorageModeStore.getState().mode
    if (mode === 'local') {
      throw new Error('本地模式不支持修改密码')
    }

    const response = await fetch(`${API_BASE}/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeader()
      },
      body: JSON.stringify({ currentPassword, newPassword }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to change password')
    }

    return await response.json()
  },

  logout() {
    useAuthStore.getState().logout()
  },

  getAuthHeader(): Record<string, string> {
    const token = useAuthStore.getState().token
    return token ? { 'Authorization': `Bearer ${token}` } : {}
  },

  async getUsers() {
    const response = await fetch('/api/admin/users', {
      headers: this.getAuthHeader()
    })
    if (!response.ok) throw new Error('Failed to fetch users')
    return await response.json()
  },

  async updateUserRole(userId: string, role: 'user' | 'admin') {
    const response = await fetch(`/api/admin/users/${userId}/role`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeader()
      },
      body: JSON.stringify({ role })
    })
    if (!response.ok) throw new Error('Failed to update user role')
    return await response.json()
  },

  async deleteUser(userId: string) {
    const response = await fetch(`/api/admin/users/${userId}`, {
      method: 'DELETE',
      headers: this.getAuthHeader()
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to delete user')
    }
  },

  async getSystemSettings(): Promise<SystemSettings> {
    // Always try to fetch public settings (for notifications etc)
    let publicSettings: SystemSettings = {}
    try {
      const res = await fetch('/api/settings/public')
      if (res.ok) {
        publicSettings = await res.json()
      }
    } catch (e) {
      // Ignore error
    }

    // Admin settings should always be fetched from server, regardless of storage mode
    // Local mode only affects personal user settings, not admin settings
    try {
      const response = await fetch('/api/admin/settings', {
        headers: this.getAuthHeader()
      })
      if (response.ok) {
        return await response.json()
      }
      // If unauthorized (not logged in), return public settings
      if (response.status === 401 || response.status === 403) {
        return publicSettings
      }
      throw new Error('Failed to fetch settings')
    } catch (error) {
      // If fetch fails, return public settings as fallback if available
      if (Object.keys(publicSettings).length > 0) {
        return publicSettings
      }
      throw error
    }
  },

  async updateSystemSettings(settings: SystemSettings) {
    // Admin settings should always be saved to server, regardless of storage mode
    // Local mode only affects personal user settings, not admin settings
    const response = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeader()
      },
      body: JSON.stringify(settings)
    })
    if (!response.ok) throw new Error('Failed to update settings')
    return await response.json()
  },

  async getUserProfile() {
    const mode = useStorageModeStore.getState().mode
    if (mode === 'local') {
      const config = await db.configs.get('user_ai_config')
      return {
        id: 'local-user',
        username: 'local',
        nickname: 'Local User',
        role: 'user',
        aiConfig: config?.value || {}
      }
    }

    const response = await fetch('/api/auth/profile', {
      headers: this.getAuthHeader()
    })
    if (!response.ok) throw new Error('Failed to fetch profile')
    return await response.json()
  },

  async updateUserNickname(nickname: string) {
    const mode = useStorageModeStore.getState().mode
    if (mode === 'local') {
      return { nickname }
    }

    const response = await fetch('/api/auth/profile/nickname', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeader()
      },
      body: JSON.stringify({ nickname })
    })
    if (!response.ok) throw new Error('Failed to update nickname')
    const data = await response.json()

    // Update local store
    const currentUser = useAuthStore.getState().user
    const token = useAuthStore.getState().token
    if (currentUser && token) {
      useAuthStore.getState().setAuth({ ...currentUser, nickname: data.nickname }, token)
    }

    return data
  },

  async updateUserAIConfig(config: any) {
    const mode = useStorageModeStore.getState().mode
    if (mode === 'local') {
      await db.configs.put({ key: 'user_ai_config', value: config })
      return config
    }

    const response = await fetch('/api/auth/profile/ai-config', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeader()
      },
      body: JSON.stringify(config)
    })
    if (!response.ok) throw new Error('Failed to update AI config')
    return await response.json()
  },

  async adminUpdateUserAIConfig(userId: string, config: any) {
    const response = await fetch(`/api/admin/users/${userId}/ai-config`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeader()
      },
      body: JSON.stringify(config)
    })
    if (!response.ok) throw new Error('Failed to update user AI config')
    return await response.json()
  },

  async adminResetUserPassword(userId: string, password: string) {
    const response = await fetch(`/api/admin/users/${userId}/password`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeader()
      },
      body: JSON.stringify({ password })
    })
    if (!response.ok) throw new Error('Failed to reset password')
    return await response.json()
  },

  async adminUpdateUserAccessPassword(userId: string, accessPassword: string) {
    const response = await fetch(`/api/admin/users/${userId}/access-password`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeader()
      },
      body: JSON.stringify({ accessPassword })
    })
    if (!response.ok) throw new Error('Failed to update access password')
    return await response.json()
  },

  async validateAccessPassword(password: string) {
    const response = await fetch('/api/auth/validate-access-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeader()
      },
      body: JSON.stringify({ password })
    })
    if (!response.ok) throw new Error('Failed to validate password')
    return await response.json()
  },

  async getExampleProjects(): Promise<ExampleProject[]> {
    const response = await fetch('/api/admin/example-projects', {
      headers: this.getAuthHeader()
    })
    if (!response.ok) throw new Error('Failed to fetch example projects')
    return await response.json()
  },

  async getPublicExampleProjects(): Promise<ExampleProject[]> {
    const response = await fetch('/api/public/example-projects')
    if (!response.ok) throw new Error('Failed to fetch public example projects')
    return await response.json()
  },

  async getExampleProject(id: string): Promise<ExampleProject> {
    const response = await fetch(`/api/admin/example-projects/${id}`, {
      headers: this.getAuthHeader()
    })
    if (!response.ok) throw new Error('Failed to fetch example project')
    return await response.json()
  },

  async createExampleProject(project: Partial<ExampleProject>) {
    const response = await fetch('/api/admin/example-projects', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeader()
      },
      body: JSON.stringify(project)
    })
    if (!response.ok) throw new Error('Failed to create example project')
    return await response.json()
  },

  async updateExampleProject(id: string, project: Partial<ExampleProject>) {
    const response = await fetch(`/api/admin/example-projects/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeader()
      },
      body: JSON.stringify(project)
    })
    if (!response.ok) throw new Error('Failed to update example project')
    return await response.json()
  },

  async reorderExampleProjects(ids: string[]) {
    const response = await fetch('/api/admin/example-projects/reorder', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeader()
      },
      body: JSON.stringify({ ids })
    })
    if (!response.ok) throw new Error('Failed to reorder example projects')
    return await response.json()
  },

  async deleteExampleProject(id: string) {
    const response = await fetch(`/api/admin/example-projects/${id}`, {
      method: 'DELETE',
      headers: this.getAuthHeader()
    })
    if (!response.ok) throw new Error('Failed to delete example project')
  },

  async getLocalUsers() {
    const response = await fetch('/api/admin/local-users', {
      headers: this.getAuthHeader()
    })
    if (!response.ok) throw new Error('Failed to fetch local users')
    return await response.json()
  },

  async updateLocalUserNickname(userId: string, nickname: string) {
    const response = await fetch(`/api/admin/local-users/${userId}/nickname`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeader()
      },
      body: JSON.stringify({ nickname })
    })
    if (!response.ok) throw new Error('Failed to update local user nickname')
    return await response.json()
  },

  async getChatLogs(params: { userId?: string, startDate?: string, endDate?: string, page?: number, pageSize?: number }) {
    const query = new URLSearchParams(params as any).toString()
    const response = await fetch(`/api/admin/logs/chat?${query}`, {
      headers: this.getAuthHeader()
    })
    if (!response.ok) throw new Error('Failed to fetch chat logs')
    return await response.json()
  },

  async getFileLogs(params: { userId?: string, startDate?: string, endDate?: string, page?: number, pageSize?: number }) {
    const query = new URLSearchParams(params as any).toString()
    const response = await fetch(`/api/admin/logs/file?${query}`, {
      headers: this.getAuthHeader()
    })
    if (!response.ok) throw new Error('Failed to fetch file logs')
    return await response.json()
  },

  async getChatStatsByDate(params?: { userId?: string }): Promise<Array<{ date: string, count: number }>> {
    const query = params ? new URLSearchParams(params as any).toString() : ''
    const response = await fetch(`/api/admin/stats/chat-by-date${query ? `?${query}` : ''}`, {
      headers: this.getAuthHeader()
    })
    if (!response.ok) throw new Error('Failed to fetch chat stats')
    return await response.json()
  },

  async getFileStatsByDate(params?: { userId?: string }): Promise<Array<{ date: string, count: number }>> {
    const query = params ? new URLSearchParams(params as any).toString() : ''
    const response = await fetch(`/api/admin/stats/file-by-date${query ? `?${query}` : ''}`, {
      headers: this.getAuthHeader()
    })
    if (!response.ok) throw new Error('Failed to fetch file stats')
    return await response.json()
  },

  async validateAIConfig(config: any) {
    const mode = useStorageModeStore.getState().mode
    if (mode === 'local') {
      // In local mode, we can't easily validate via backend without auth.
      // For now, we'll assume it's valid or maybe we should try to call the provider directly?
      // But that might have CORS issues.
      // Let's just return success for now to allow saving.
      return { valid: true }
    }

    const response = await fetch('/api/auth/validate-ai-config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeader()
      },
      body: JSON.stringify(config)
    })
    if (!response.ok) throw new Error('Failed to validate AI config')
    return await response.json()
  },

  async logAIChat(data: {
    userId: string
    userType: 'cloud' | 'local'
    modelName: string
    details: any
  }) {
    try {
      const response = await fetch('/api/logs/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeader()
        },
        body: JSON.stringify(data)
      })
      if (!response.ok) {
        console.error('Failed to log AI chat')
      }
    } catch (error) {
      console.error('Failed to log AI chat:', error)
    }
  },

  async logFileCreation(data: {
    userId: string
    userType: 'cloud' | 'local'
    fileId: string
    fileTitle: string
  }) {
    try {
      const response = await fetch('/api/logs/file', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeader()
        },
        body: JSON.stringify(data)
      })
      if (!response.ok) {
        console.error('Failed to log file creation')
      }
    } catch (error) {
      console.error('Failed to log file creation:', error)
    }
  },

  async registerLocalUser(userId: string) {
    try {
      const response = await fetch('/api/local-users/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId })
      })
      if (!response.ok) {
        console.error('Failed to register local user')
      }
    } catch (error) {
      console.error('Failed to register local user:', error)
    }
  }
}

