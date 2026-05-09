import {v4 as uuidv4} from 'uuid'
import type {EngineType, Project} from '@/types'
import {authService} from './authService'
import {useStorageModeStore} from '@/stores/storageModeStore'
import {useAuthStore} from '@/stores/authStore'
import {db} from './db'

const API_BASE = '/api'

/**
 * Project Repository
 * Data access layer for project management (Supports both Local and Cloud storage)
 */
export const ProjectRepository = {
  /**
   * Create a new project
   */
  async create(data: {
    title: string
    engineType: EngineType
    thumbnail?: string
    groupId?: string
  }): Promise<Project> {
    const mode = useStorageModeStore.getState().mode
    const now = new Date()
    const project: Project = {
      id: uuidv4(),
      title: data.title,
      engineType: data.engineType,
      thumbnail: data.thumbnail || '',
      groupId: data.groupId,
      createdAt: now,
      updatedAt: now,
    }

    if (mode === 'local') {
      await db.projects.add(project)

      // Log file creation - always use local user ID in local mode
      const localUserId = useStorageModeStore.getState().localUserId
      authService.logFileCreation({
        userId: localUserId,
        userType: 'local',
        fileId: project.id,
        fileTitle: project.title
      })

      return project
    }

    const response = await fetch(`${API_BASE}/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authService.getAuthHeader()
      },
      body: JSON.stringify(project),
    })

    if (!response.ok) {
      throw new Error('Failed to create project')
    }

    // Log file creation for cloud mode (only if user is logged in)
    const user = useAuthStore.getState().user
    if (user) {
      authService.logFileCreation({
        userId: user.id,
        userType: 'cloud',
        fileId: project.id,
        fileTitle: project.title
      })
    }

    return project
  },

  /**
   * Get project by ID
   */
  async getById(id: string): Promise<Project | undefined> {
    const mode = useStorageModeStore.getState().mode

    if (mode === 'local') {
      return await db.projects.get(id)
    }

    const response = await fetch(`${API_BASE}/projects/${id}`, {
      headers: authService.getAuthHeader()
    })
    if (response.status === 404) return undefined
    if (!response.ok) throw new Error('Failed to get project')

    const project = await response.json()
    // Convert date strings back to Date objects
    return {
      ...project,
      createdAt: new Date(project.createdAt),
      updatedAt: new Date(project.updatedAt),
    }
  },

  /**
   * Get projects with pagination and search
   */
  async getAll(
    page: number = 1,
    pageSize: number = 20,
    search: string = '',
    groupId?: string | null,
    sortBy: 'createdAt' | 'updatedAt' = 'updatedAt'
  ): Promise<{ items: Project[], total: number }> {
    const mode = useStorageModeStore.getState().mode

    if (mode === 'local') {
      let collection = db.projects.orderBy(sortBy).reverse()

      if (search) {
        const lowerSearch = search.toLowerCase()
        collection = collection.filter(p => p.title.toLowerCase().includes(lowerSearch))
      }

      if (groupId === 'uncategorized') {
        collection = collection.filter(p => !p.groupId)
      } else if (groupId) {
        collection = collection.filter(p => p.groupId === groupId)
      }

      const total = await collection.count()
      const items = await collection
        .offset((page - 1) * pageSize)
        .limit(pageSize)
        .toArray()

      return { items, total }
    }

    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
      search,
      sortBy
    })
    if (groupId) params.append('groupId', groupId)

    const response = await fetch(`${API_BASE}/projects?${params}`, {
      headers: authService.getAuthHeader()
    })
    if (!response.ok) throw new Error('Failed to get projects')

    const data = await response.json()
    return {
      items: data.items.map((p: any) => ({
        ...p,
        createdAt: new Date(p.createdAt),
        updatedAt: new Date(p.updatedAt),
      })),
      total: data.total
    }
  },

  /**
   * Update project
   */
  async update(
    id: string,
    data: Partial<Omit<Project, 'id' | 'createdAt'>>
  ): Promise<void> {
    const mode = useStorageModeStore.getState().mode

    if (mode === 'local') {
      await db.projects.update(id, {
        ...data,
        updatedAt: new Date(),
      })
      return
    }

    const response = await fetch(`${API_BASE}/projects/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authService.getAuthHeader()
      },
      body: JSON.stringify({
        ...data,
        updatedAt: new Date(),
      }),
    })

    if (!response.ok) throw new Error('Failed to update project')
  },

  /**
   * Delete project and its version history
   */
  async delete(id: string): Promise<void> {
    const mode = useStorageModeStore.getState().mode

    if (mode === 'local') {
      await db.transaction('rw', db.projects, db.versions, db.chatMessages, async () => {
        await db.projects.delete(id)
        await db.versions.where('projectId').equals(id).delete()
        await db.chatMessages.where('projectId').equals(id).delete()
      })
      return
    }

    const response = await fetch(`${API_BASE}/projects/${id}`, {
      method: 'DELETE',
      headers: authService.getAuthHeader()
    })

    if (!response.ok) throw new Error('Failed to delete project')
  },

  /**
   * Search projects by title keyword
   */
  async search(keyword: string): Promise<Project[]> {
    const result = await this.getAll(1, 100, keyword)
    return result.items
  },
}
