import { create } from 'zustand'
import type { Project, EngineType } from '@/types'
import type { PptAudience } from '@/lib/skillThemes'

// 缩略图获取器类型
type ThumbnailGetter = () => Promise<string>

interface EditorState {
  // Current project
  currentProject: Project | null
  // Current canvas content (source code / JSON / XML)
  currentContent: string
  // Loading state
  isLoading: boolean
  // Error state
  error: string | null
  // Unsaved changes flag
  hasUnsavedChanges: boolean
  // Last saved content (to compare with current)
  lastSavedContent: string
  // Counter to trigger version list refresh
  versionSaveCount: number
  // Thumbnail getter (registered by CanvasArea)
  thumbnailGetter: ThumbnailGetter | null

  // Actions
  setProject: (project: Project | null) => void
  setContent: (content: string) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  // Mark content as saved (after manual save) and increment version counter
  markAsSaved: () => void
  // Set content from loaded version (no unsaved flag)
  setContentFromVersion: (content: string) => void
  // Register thumbnail getter
  setThumbnailGetter: (getter: ThumbnailGetter | null) => void
  reset: () => void
}

const initialState = {
  currentProject: null,
  currentContent: '',
  isLoading: false,
  error: null,
  hasUnsavedChanges: false,
  lastSavedContent: '',
  versionSaveCount: 0,
  thumbnailGetter: null,
}

export const useEditorStore = create<EditorState>((set, _get) => ({
  ...initialState,

  setProject: (project) => set({ currentProject: project }),

  setContent: (content) => set((state) => ({
    currentContent: content,
    hasUnsavedChanges: content !== state.lastSavedContent,
  })),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),

  markAsSaved: () => set((state) => ({
    hasUnsavedChanges: false,
    lastSavedContent: state.currentContent,
    versionSaveCount: state.versionSaveCount + 1,
  })),

  setContentFromVersion: (content) => set({
    currentContent: content,
    lastSavedContent: content,
    hasUnsavedChanges: false,
  }),

  setThumbnailGetter: (getter) => set({ thumbnailGetter: getter }),

  reset: () => set(initialState),
}))

// Selector helpers
export const selectEngineType = (state: EditorState): EngineType | null =>
  state.currentProject?.engineType ?? null

export const selectIsEmpty = (state: EditorState): boolean =>
  !state.currentContent || state.currentContent.trim() === ''

export const selectStyleVariant = (state: EditorState): string | null =>
  state.currentProject?.styleVariant ?? null

export const selectPptAudience = (state: EditorState): PptAudience | null =>
  state.currentProject?.pptAudience ?? null
