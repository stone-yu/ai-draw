import type {ChatRequest, PayloadMessage} from '@/types'
import {quotaService} from './quotaService'
import {authService} from './authService'
import {useStorageModeStore} from '@/stores/storageModeStore'
import {db} from './db'
import {encryptSensitive} from '@/lib/crypto'

// API endpoint - can be configured via environment variable
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

/**
 * 获取请求头（包含访问密码和Auth Token）
 */
function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...authService.getAuthHeader()
  }
  const password = quotaService.getAccessPassword()
  if (password) {
    headers['X-Access-Password'] = password
  }
  return headers
}

/**
 * 检查配额并在需要时消耗
 */
function checkAndConsumeQuota(response: Response): void {
  const mode = useStorageModeStore.getState().mode
  if (mode === 'local') return

  const quotaExempt = response.headers.get('X-Quota-Exempt')
  // 只有当不免除配额时才消耗
  if (quotaExempt !== 'true') {
    quotaService.consumeQuota()
  }
}

/**
 * 检查是否有足够配额（有密码时跳过检查）
 */
function ensureQuotaAvailable(): void {
  const mode = useStorageModeStore.getState().mode
  if (mode === 'local') return

  if (!quotaService.hasAccessPassword() && !quotaService.hasQuotaRemaining()) {
    throw new Error('今日配额已用完，请明天再试或设置访问密码')
  }
}

/**
 * 准备要发送到后端的 AI 配置
 * 安全性改进：
 * 1. 使用系统默认模型时不传用户配置
 * 2. 使用自定义模型时只传当前使用的模型配置
 * 3. 加密敏感的 API Key 信息
 */
async function prepareSecureAiConfig(): Promise<Record<string, unknown> | undefined> {
  const mode = useStorageModeStore.getState().mode

  // 非本地模式不需要传配置
  if (mode !== 'local') {
    return undefined
  }

  const configItem = await db.configs.get('user_ai_config')
  if (!configItem?.value) {
    return undefined
  }

  const aiConfig = configItem.value as {
    useCustom?: boolean
    currentProviderId?: string
    providers?: Array<{
      id: string
      name?: string
      apiKey?: string
      baseUrl?: string
      modelId?: string
    }>
  }

  // 情况1: 使用系统默认模型，不传任何用户配置
  if (!aiConfig.useCustom) {
    return undefined
  }

  // 情况2: 使用自定义模型，只传当前使用的模型配置
  if (aiConfig.currentProviderId && aiConfig.providers) {
    const currentProvider = aiConfig.providers.find(p => p.id === aiConfig.currentProviderId)

    if (currentProvider && currentProvider.apiKey) {
      // 情况3: 加密 API Key
      const secureConfig = {
        useCustom: true,
        provider: {
          id: currentProvider.id,
          name: currentProvider.name,
          // 使用无关的字段名并加密
          auth: encryptSensitive(currentProvider.apiKey),
          baseUrl: currentProvider.baseUrl,
          modelId: currentProvider.modelId
        }
      }

      return secureConfig
    }
  }

  // 兜底：返回空对象表示使用系统配置
  return undefined
}

interface ParseUrlResponse {
  success: boolean
  data?: {
    title: string
    content: string
    excerpt: string
    siteName: string
    url: string
  }
  error?: string
}

/**
 * 转换 AI 错误信息为用户友好的提示
 */
function translateAIError(errorMessage: string): string {
  // VLM (Vision Language Model) 错误 - 模型不支持图片
  if (errorMessage.includes('The model is not a VLM') ||
      errorMessage.includes('not a VLM') ||
      errorMessage.includes('does not support images') ||
      errorMessage.includes('does not support image inputs')) {
    return '此模型不支持图片输入，请使用纯文字，或选择支持图片的模型进行使用'
  }

  // 模型不存在错误
  if (errorMessage.includes('Model does not exist') ||
      errorMessage.includes('model_not_found') ||
      errorMessage.includes('The model') && errorMessage.includes('does not exist')) {
    return '模型不存在或配置错误，请检查模型 ID 是否正确'
  }

  // 其他常见错误翻译
  if (errorMessage.includes('context length') || errorMessage.includes('maximum context')) {
    return '输入内容超出模型上下文长度限制，请减少输入内容或清空对话历史'
  }

  if (errorMessage.includes('rate limit') || errorMessage.includes('too many requests')) {
    return '请求过于频繁，请稍后再试'
  }

  if (errorMessage.includes('insufficient_quota') || errorMessage.includes('quota exceeded')) {
    return 'API 配额已用完，请检查您的 API 账户'
  }

  if (errorMessage.includes('invalid_api_key') || errorMessage.includes('Incorrect API key')) {
    return 'API Key 无效，请检查配置'
  }

  // 返回原始错误信息
  return errorMessage
}

/**
 * Parse SSE data line and extract content
 */
function parseSSELine(line: string): string | null {
  let data = line

  // Handle SSE format (data: prefix)
  if (line.startsWith('data: ')) {
    data = line.slice(6)
  }

  if (data === '[DONE]') return null

  try {
    const parsed = JSON.parse(data)
    // Handle OpenAI format
    if (parsed.choices?.[0]?.delta?.content) {
      return parsed.choices[0].delta.content
    }
    // Handle simple format
    if (parsed.content) {
      return parsed.content
    }
    // Handle text field
    if (parsed.text) {
      return parsed.text
    }
  } catch {
    // Not JSON, return raw data if it has content
    if (data.trim()) {
      return data
    }
  }
  return null
}

/**
 * AI Service for communicating with the backend
 */
export const aiService = {
  /**
   * Send chat messages to AI and get response (non-streaming)
   */
  async chat(messages: PayloadMessage[]): Promise<string> {
    const startTime = Date.now()
    const debug = ((window as unknown as Record<string, unknown>)._ENV_ as Record<string, unknown>)?.DEBUG
    if (debug) {
      // Truncate messages if too large
      const msgStr = JSON.stringify({ messages });
      const logStr = msgStr.length > 200 ? msgStr.substring(0, 200) + '...' : msgStr;
      console.log('[AI Service] Request Start:', logStr)
    } else {
      console.log('[AI Service] Request Start')
    }

    try {
      ensureQuotaAvailable()

      // 使用安全的配置准备函数
      const aiConfig = await prepareSecureAiConfig()

      const request: ChatRequest & { aiConfig?: Record<string, unknown> } = { messages, aiConfig }

      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(request),
      })

      if (response.status === 401 || response.status === 403) {
        const mode = useStorageModeStore.getState().mode
        if (mode !== 'local') {
          authService.logout()
          window.location.href = '/login'
          throw new Error('登录已过期，请重新登录')
        }
      }

      if (!response.ok) {
        const errorText = await response.text()
        // 尝试解析 JSON 错误
        let errorMessage = errorText
        try {
          const errorJson = JSON.parse(errorText)
          // 提取实际的错误信息
          if (errorJson.error) {
            if (typeof errorJson.error === 'string') {
              errorMessage = errorJson.error
              // 尝试进一步解析嵌套的 JSON（AI Provider Error 格式）
              if (errorMessage.includes('AI Provider Error:')) {
                try {
                  const innerJson = JSON.parse(errorMessage.replace('AI Provider Error: ', ''))
                  if (innerJson.error && innerJson.error.message) {
                    errorMessage = innerJson.error.message
                  }
                } catch {
                  // 无法解析内层 JSON，保持当前错误信息
                }
              }
            } else if (errorJson.error.message) {
              errorMessage = errorJson.error.message
            }
          }
        } catch {
          // 不是 JSON，使用原始文本
        }
        // 转换错误信息为用户友好的提示
        const friendlyError = translateAIError(errorMessage)
        throw new Error(friendlyError)
      }

      checkAndConsumeQuota(response)

      const data = await response.json()
      const content = data.content || data.message || ''

      const duration = Date.now() - startTime
      if (debug) {
        // Truncate content if too large
        const contentStr = JSON.stringify({ content });
        const logStr = contentStr.length > 200 ? contentStr.substring(0, 200) + '...' : contentStr;
        console.log(`[AI Service] Request End. Duration: ${duration}ms`, logStr)
      } else {
        console.log(`[AI Service] Request End. Duration: ${duration}ms`)
      }

      return content
    } catch (error) {
      const duration = Date.now() - startTime
      console.error(`[AI Service] Request Failed. Duration: ${duration}ms`, error)
      // 如果错误信息还没被转换，再转换一次
      if (error instanceof Error) {
        const friendlyError = translateAIError(error.message)
        if (friendlyError !== error.message) {
          throw new Error(friendlyError)
        }
      }
      throw error
    }
  },

  /**
   * Stream chat response with SSE support
   * @param messages - The messages to send
   * @param onChunk - Callback for each content chunk
   * @param onComplete - Optional callback when streaming completes
   * @returns The full accumulated content
   */
  async streamChat(
    messages: PayloadMessage[],
    onChunk: (chunk: string, accumulated: string) => void,
    onComplete?: (content: string) => void
  ): Promise<string> {
    const startTime = Date.now()
    const debug = ((window as unknown as Record<string, unknown>)._ENV_ as Record<string, unknown>)?.DEBUG
    if (debug) {
      // Truncate messages if too large
      const msgStr = JSON.stringify({ messages });
      const logStr = msgStr.length > 200 ? msgStr.substring(0, 200) + '...' : msgStr;
      console.log('[AI Service] Stream Request Start:', logStr)
    } else {
      console.log('[AI Service] Stream Request Start')
    }

    try {
      ensureQuotaAvailable()

      // 使用安全的配置准备函数
      const aiConfig = await prepareSecureAiConfig()

      const request: ChatRequest & { stream: boolean; aiConfig?: Record<string, unknown> } = { messages, stream: true, aiConfig }

      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(request),
      })

      if (response.status === 401 || response.status === 403) {
        const mode = useStorageModeStore.getState().mode
        if (mode !== 'local') {
          authService.logout()
          window.location.href = '/login'
          throw new Error('登录已过期，请重新登录')
        }
      }

      if (!response.ok) {
        const errorText = await response.text()
        // 尝试解析 JSON 错误
        let errorMessage = errorText
        try {
          const errorJson = JSON.parse(errorText)
          // 提取实际的错误信息
          if (errorJson.error) {
            if (typeof errorJson.error === 'string') {
              errorMessage = errorJson.error
            } else if (errorJson.error.message) {
              errorMessage = errorJson.error.message
            }
          }
        } catch {
          // 不是 JSON，使用原始文本
        }
        // 转换错误信息为用户友好的提示
        const friendlyError = translateAIError(errorMessage)
        throw new Error(friendlyError)
      }

      // 流式请求成功后检查并消耗配额
      checkAndConsumeQuota(response)

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('Failed to get response reader')
      }

      const decoder = new TextDecoder()
      let fullContent = ''
      let buffer = ''

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })

          // Process complete lines
          const lines = buffer.split('\n')
          buffer = lines.pop() || '' // Keep incomplete line in buffer

          for (const line of lines) {
            const trimmedLine = line.trim()
            if (!trimmedLine) continue

            const content = parseSSELine(trimmedLine)
            if (content) {
              fullContent += content
              onChunk(content, fullContent)
            }
          }
        }

        // Process remaining buffer
        if (buffer.trim()) {
          const content = parseSSELine(buffer.trim())
          if (content) {
            fullContent += content
            onChunk(content, fullContent)
          }
        }
      } finally {
        reader.releaseLock()
      }

      const duration = Date.now() - startTime
      if (debug) {
        // Truncate content if too large
        const contentStr = JSON.stringify({ fullContent });
        const logStr = contentStr.length > 200 ? contentStr.substring(0, 200) + '...' : contentStr;
        console.log(`[AI Service] Stream Request End. Duration: ${duration}ms`, logStr)
      } else {
        console.log(`[AI Service] Stream Request End. Duration: ${duration}ms`)
      }

      onComplete?.(fullContent)
      return fullContent
    } catch (error) {
      const duration = Date.now() - startTime
      console.error(`[AI Service] Stream Request Failed. Duration: ${duration}ms`, error)
      // 如果错误信息还没被转换，再转换一次
      if (error instanceof Error) {
        const friendlyError = translateAIError(error.message)
        if (friendlyError !== error.message) {
          throw new Error(friendlyError)
        }
      }
      throw error
    }
  },

  /**
   * Parse URL content and convert to markdown
   */
  async parseUrl(url: string): Promise<ParseUrlResponse> {
    const response = await fetch(`${API_BASE_URL}/parse-url`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ url }),
    })

    if (response.status === 401) {
      const mode = useStorageModeStore.getState().mode
      if (mode !== 'local') {
        authService.logout()
        window.location.href = '/login'
        throw new Error('登录已过期，请重新登录')
      }
    }

    const data: ParseUrlResponse = await response.json()

    if (!response.ok || !data.success) {
      throw new Error(data.error || '解析URL失败')
    }

    return data
  },
}
