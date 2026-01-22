import {create} from 'zustand'
import type {EngineType} from '@/types'

interface SystemState {
  systemName: string
  showAbout: boolean
  sidebarCollapsed: boolean
  defaultEngine: EngineType
  defaultModelPrompt: string
  logoColor: string
  notifications: {
    homepage?: string
    homepageEnabled?: boolean
    editor?: string
    editorEnabled?: boolean
    homepageAnnouncement?: string
    homepageAnnouncementEnabled?: boolean
  }
  setSystemName: (name: string) => void
  setShowAbout: (show: boolean) => void
  setSidebarCollapsed: (collapsed: boolean) => void
  setDefaultEngine: (engine: EngineType) => void
  setDefaultModelPrompt: (prompt: string) => void
  setLogoColor: (color: string) => void
  setNotifications: (notifications: {
    homepage?: string;
    homepageEnabled?: boolean;
    editor?: string;
    editorEnabled?: boolean;
    homepageAnnouncement?: string;
    homepageAnnouncementEnabled?: boolean;
  }) => void
}

export const useSystemStore = create<SystemState>((set) => ({
  systemName: (window as any)._ENV_?.SYSTEM_NAME || 'AI Draw',
  showAbout: (window as any)._ENV_?.SHOW_ABOUT !== false, // Default to true if not set
  sidebarCollapsed: localStorage.getItem('sidebarCollapsed') === 'true',
  defaultEngine: (localStorage.getItem('defaultEngine') as EngineType) || (window as any)._ENV_?.DEFAULT_ENGINE || 'drawio',
  defaultModelPrompt: (window as any)._ENV_?.DEFAULT_MODEL_PROMPT || '使用服务端配置的模型，此信息管理员可以在系统设置-基础设置里面进行自定义',
  logoColor: (window as any)._ENV_?.LOGO_COLOR || '#000000', // Default to black
  notifications: {},
  setSystemName: (name) => set({ systemName: name }),
  setShowAbout: (show) => set({ showAbout: show }),
  setSidebarCollapsed: (collapsed) => {
    localStorage.setItem('sidebarCollapsed', String(collapsed))
    set({ sidebarCollapsed: collapsed })
  },
  setDefaultEngine: (engine) => {
    localStorage.setItem('defaultEngine', engine)
    set({ defaultEngine: engine })
  },
  setDefaultModelPrompt: (prompt) => set({ defaultModelPrompt: prompt }),
  setLogoColor: (color) => set({ logoColor: color }),
  setNotifications: (notifications) => set({ notifications }),
}))

