import {v4 as uuidv4} from 'uuid'
import type {Group} from '@/types'
import {authService} from './authService'
import {useStorageModeStore} from '@/stores/storageModeStore'
import {db} from './db'

const API_BASE = '/api'

/**
 * Group Repository
 * Data access layer for group management (Supports both Local and Cloud storage)
 */
export const GroupRepository = {
  /**
   * Create a new group
   */
  async create(name: string): Promise<Group> {
    const mode = useStorageModeStore.getState().mode
    const now = new Date()
    const group: Group = {
      id: uuidv4(),
      name,
      createdAt: now,
      updatedAt: now,
    }

    if (mode === 'local') {
      await db.groups.add(group)
      return group
    }

    const response = await fetch(`${API_BASE}/groups`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authService.getAuthHeader()
      },
      body: JSON.stringify(group),
    })

    if (!response.ok) {
      throw new Error('Failed to create group')
    }

    return group
  },

  /**
   * Get all groups, sorted by createdAt ascending
   */
  async getAll(): Promise<Group[]> {
    const mode = useStorageModeStore.getState().mode

    if (mode === 'local') {
      const groups = await db.groups.orderBy('createdAt').toArray()
      // Calculate counts for local groups
      const groupsWithCounts = await Promise.all(groups.map(async (group) => {
        const count = await db.projects.where('groupId').equals(group.id).count()
        return {
          ...group,
          projectCount: count
        }
      }))
      return groupsWithCounts
    }

    const response = await fetch(`${API_BASE}/groups`, {
      headers: authService.getAuthHeader()
    })
    if (!response.ok) throw new Error('Failed to get groups')

    const groups = await response.json()
    return groups.map((g: any) => ({
      ...g,
      createdAt: new Date(g.createdAt),
      updatedAt: new Date(g.updatedAt),
      projectCount: g.projectCount || 0
    }))
  },

  /**
   * Update group
   */
  async update(id: string, name: string): Promise<void> {
    const mode = useStorageModeStore.getState().mode

    if (mode === 'local') {
      await db.groups.update(id, {
        name,
        updatedAt: new Date(),
      })
      return
    }

    const response = await fetch(`${API_BASE}/groups/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authService.getAuthHeader()
      },
      body: JSON.stringify({
        name,
        updatedAt: new Date(),
      }),
    })

    if (!response.ok) throw new Error('Failed to update group')
  },

  /**
   * Delete group
   */
  async delete(id: string): Promise<void> {
    const mode = useStorageModeStore.getState().mode

    if (mode === 'local') {
      await db.transaction('rw', db.groups, db.projects, async () => {
        await db.groups.delete(id)
        // Set groupId to undefined for projects in this group
        await db.projects.where('groupId').equals(id).modify({ groupId: undefined })
      })
      return
    }

    const response = await fetch(`${API_BASE}/groups/${id}`, {
      method: 'DELETE',
      headers: authService.getAuthHeader()
    })

    if (!response.ok) throw new Error('Failed to delete group')
  },
}

