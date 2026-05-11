export interface Env {
  AI_PROVIDER: string
  AI_BASE_URL: string
  AI_API_KEY: string
  AI_MODEL_ID: string
  ACCESS_PASSWORD?: string
  AI_DRAW_KV: KVNamespace
}

export interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string | ContentPart[]
}

export interface ContentPart {
  type: 'text' | 'image_url'
  text?: string
  image_url?: { url: string }
}

export interface AnthropicContentPart {
  type: 'text' | 'image'
  text?: string
  source?: {
    type: 'base64'
    media_type: string
    data: string
  }
}

export interface AIConfigProvider {
  id?: string
  name?: string
  auth?: string
  baseUrl?: string
  modelId?: string
  maxTokens?: number
}

export interface AIConfigLegacyProvider {
  id?: string
  name?: string
  apiKey?: string
  baseUrl?: string
  modelId?: string
  maxTokens?: number
}

export interface AIConfig {
  useCustom?: boolean
  provider?: AIConfigProvider
  currentProviderId?: string
  providers?: AIConfigLegacyProvider[]
  maxTokens?: number
}

export interface ChatRequest {
  messages: Message[]
  stream?: boolean
  aiConfig?: AIConfig
}

export interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string
    }
  }>
}

export interface AnthropicResponse {
  content: Array<{
    type: string
    text: string
  }>
}
