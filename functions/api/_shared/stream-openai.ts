import type { Env, Message } from './types'
import { corsHeaders } from './cors'
import { convertContentPartsToAnthropic } from './ai-providers'

export async function streamOpenAI(messages: Message[], env: Env, exempt: boolean = false, maxTokens?: number): Promise<Response> {
  const baseUrl = env.AI_BASE_URL
  const apiKey = env.AI_API_KEY

  if (!apiKey) {
    throw new Error('AI_API_KEY not configured')
  }

  const body: Record<string, unknown> = {
    model: env.AI_MODEL_ID,
    messages: messages,
    stream: true,
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

  const { readable, writable } = new TransformStream()
  const writer = writable.getWriter()
  const encoder = new TextEncoder()

  ;(async () => {
    const reader = response.body?.getReader()
    if (!reader) return

    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith('data: ')) continue

          const data = trimmed.slice(6)
          if (data === '[DONE]') {
            await writer.write(encoder.encode('data: [DONE]\n\n'))
            continue
          }

          try {
            const parsed = JSON.parse(data)
            const content = parsed.choices?.[0]?.delta?.content
            if (content) {
              await writer.write(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`))
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }
    } finally {
      reader.releaseLock()
      await writer.close()
    }
  })()

  return new Response(readable, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Quota-Exempt': exempt ? 'true' : 'false',
    },
  })
}
