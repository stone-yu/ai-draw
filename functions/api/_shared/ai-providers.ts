import type { Env, Message, ContentPart, AnthropicContentPart, OpenAIResponse, AnthropicResponse } from './types'

export function convertContentPartsToAnthropic(parts: ContentPart[]): AnthropicContentPart[] {
  return parts
    .map((part) => {
      if (part.type === 'text') {
        return { type: 'text' as const, text: part.text || '' }
      }
      if (part.type === 'image_url' && part.image_url?.url) {
        const url = part.image_url.url
        if (url.startsWith('data:')) {
          const matches = url.match(/^data:(image\/[^;]+);base64,(.+)$/)
          if (matches) {
            return {
              type: 'image' as const,
              source: {
                type: 'base64' as const,
                media_type: matches[1],
                data: matches[2],
              },
            }
          }
        }
        return { type: 'text' as const, text: `[Image URL: ${url}]` }
      }
      return { type: 'text' as const, text: '' }
    })
    .filter((part) => part.type === 'image' || (part.type === 'text' && part.text))
}

// Anthropic API requires max_tokens; fall back to this when caller did not set one
const ANTHROPIC_DEFAULT_MAX_TOKENS = 64000

export async function callOpenAI(messages: Message[], env: Env, maxTokens?: number): Promise<string> {
  const baseUrl = env.AI_BASE_URL
  const apiKey = env.AI_API_KEY

  if (!apiKey) {
    throw new Error('AI_API_KEY not configured')
  }

  const body: Record<string, unknown> = {
    model: env.AI_MODEL_ID,
    messages: messages,
    stream: false,
  }
  if (typeof maxTokens === 'number' && maxTokens > 0) {
    body.max_tokens = maxTokens
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenAI API error: ${error}`)
  }

  const data: OpenAIResponse = await response.json()
  return data.choices[0]?.message?.content || ''
}

export async function callAnthropic(messages: Message[], env: Env, maxTokens?: number): Promise<string> {
  const baseUrl = env.AI_BASE_URL
  const apiKey = env.AI_API_KEY

  if (!apiKey) {
    throw new Error('AI_API_KEY not configured')
  }

  const systemMessage = messages.find((m) => m.role === 'system')
  const nonSystemMessages = messages.filter((m) => m.role !== 'system')

  const anthropicMessages = nonSystemMessages.map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: typeof m.content === 'string' ? m.content : convertContentPartsToAnthropic(m.content),
  }))

  const response = await fetch(`${baseUrl}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: env.AI_MODEL_ID,
      max_tokens: (typeof maxTokens === 'number' && maxTokens > 0) ? maxTokens : ANTHROPIC_DEFAULT_MAX_TOKENS,
      system: typeof systemMessage?.content === 'string' ? systemMessage.content : '',
      messages: anthropicMessages,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Anthropic API error: ${error}`)
  }

  const data: AnthropicResponse = await response.json()
  return data.content[0]?.text || ''
}

export { ANTHROPIC_DEFAULT_MAX_TOKENS }
