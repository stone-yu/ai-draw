import Dexie from 'dexie'
import {db} from './db'
import type {ChatMessage, StoredChatMessage} from '@/types'

/**
 * Chat history repository
 * Stores per-project chat messages locally in IndexedDB.
 * Cloud sync is intentionally out of scope.
 */
export const ChatRepository = {
  /**
   * Get all chat messages for a project, sorted by timestamp ascending.
   */
  async getByProjectId(projectId: string): Promise<ChatMessage[]> {
    const stored = await db.chatMessages
      .where('[projectId+timestamp]')
      .between([projectId, Dexie.minKey], [projectId, Dexie.maxKey])
      .toArray()
    return stored.map((s) => {
      const msg: ChatMessage = {
        id: s.id,
        role: s.role,
        content: s.content,
        timestamp: s.timestamp,
        status: s.status,
      }
      if (s.avatar !== undefined) msg.avatar = s.avatar
      if (s.attachments !== undefined) msg.attachments = s.attachments
      if (s.plan !== undefined) msg.plan = s.plan
      if (s.code !== undefined) msg.code = s.code
      if (s.metrics !== undefined) msg.metrics = s.metrics
      return msg
    })
  },

  /**
   * Insert or update a chat message for the given project.
   */
  async upsert(projectId: string, message: ChatMessage): Promise<void> {
    const stored: StoredChatMessage = {...message, projectId}
    await db.chatMessages.put(stored)
  },

  /**
   * Delete all chat messages for a project.
   */
  async deleteByProjectId(projectId: string): Promise<void> {
    await db.chatMessages.where('projectId').equals(projectId).delete()
  },
}
