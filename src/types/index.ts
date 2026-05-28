import type { PptAudience } from '@/lib/skillThemes'

// Engine Types
export type EngineType = 'mermaid' | 'excalidraw' | 'drawio' | 'html' | 'html-ppt'

/**
 * HTML / HTML-PPT theme id. Now a free-form string because we accept
 * skill v0.3's 12 diagram themes + 36 ppt themes plus the 4 legacy
 * values (mapped at render time via normalizeHtmlTheme).
 *
 * Kept as a string union alias for grep-ability; do NOT add new
 * enum members here.
 */
export type HtmlStyleVariant = string

// Group
export interface Group {
  id: string
  name: string
  createdAt: Date
  updatedAt: Date
  projectCount?: number
}

// Project
export interface Project {
  id: string
  title: string
  engineType: EngineType
  /** html: 12 themes (or legacy 4); html-ppt: 36 themes */
  styleVariant?: string
  /** Only set for engineType === 'html-ppt' */
  pptAudience?: PptAudience
  thumbnail: string
  groupId?: string
  createdAt: Date
  updatedAt: Date
}

// Version History
export interface VersionHistory {
  id: string
  projectId: string
  content: string // Source Code / JSON / XML
  changeSummary: string // "Initial" | "AI Edit" | "Manual"
  timestamp: Date
}

// Attachment types for chat messages
export interface ImageAttachment {
  type: 'image'
  dataUrl: string // Base64 data URL
  fileName: string
}

export interface DocumentAttachment {
  type: 'document'
  content: string // Extracted text content
  fileName: string
}

export interface UrlAttachment {
  type: 'url'
  content: string // Extracted markdown content
  url: string
  title: string
}

export type Attachment = ImageAttachment | DocumentAttachment | UrlAttachment

// Chat Message (UI Content Store)
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  status: 'pending' | 'streaming' | 'complete' | 'error' | 'aborted'
  avatar?: string
  attachments?: Attachment[]
  plan?: string
  code?: string
  metrics?: {
    startTime: number
    firstTokenTime?: number
    planEndTime?: number
    endTime?: number
  }
}

// Persisted chat message (with project association for IndexedDB)
export interface StoredChatMessage extends ChatMessage {
  projectId: string
}

// Payload Message (Message Payload Store - OpenAI compatible)
export interface ContentPart {
  type: 'text' | 'image_url'
  text?: string
  image_url?: {
    url: string
  }
}

export interface PayloadMessage {
  role: 'system' | 'user' | 'assistant'
  content: string | ContentPart[]
}

// API Request
export interface ChatRequest {
  messages: PayloadMessage[]
  stream?: boolean
}
