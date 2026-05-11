import Dexie, { type EntityTable } from 'dexie'
import type { Project, VersionHistory } from '@/types'

/**
 * AI Diagram Hub Database
 * Using Dexie.js for IndexedDB management
 */
class DiagramHubDB extends Dexie {
  projects!: EntityTable<Project, 'id'>
  versionHistory!: EntityTable<VersionHistory, 'id'>

  constructor() {
    super('DiagramHubDB')

    // v1: original schema
    this.version(1).stores({
      projects: 'id, title, engineType, createdAt, updatedAt',
      versionHistory: 'id, projectId, timestamp',
    })

    // v2: add styleVariant for html engine projects. No data migration needed
    // because the field is optional and old rows simply have it undefined.
    this.version(2).stores({
      projects: 'id, title, engineType, styleVariant, createdAt, updatedAt',
      versionHistory: 'id, projectId, timestamp',
    })
  }
}

// Singleton database instance
export const db = new DiagramHubDB()
