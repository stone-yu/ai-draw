import {useEffect, useRef, useState} from 'react'
import {Brain, Check, ChevronDown, ChevronRight, Code2, Copy, Loader2} from 'lucide-react'

// Simple Markdown Renderer
const SimpleMarkdown = ({ content }: { content: string }) => {
  if (!content) return null

  // Split by newlines to handle blocks
  const lines = content.split('\n')

  return (
    <div className="space-y-1 text-xs leading-relaxed">
      {lines.map((line, i) => {
        const trimmed = line.trim()

        // Headers
        if (trimmed.startsWith('### ')) return <h3 key={i} className="font-bold text-foreground mt-2 mb-1">{formatInline(trimmed.substring(4))}</h3>
        if (trimmed.startsWith('## ')) return <h2 key={i} className="font-bold text-foreground mt-3 mb-1">{formatInline(trimmed.substring(3))}</h2>
        if (trimmed.startsWith('# ')) return <h1 key={i} className="font-bold text-base text-foreground mt-4 mb-2">{formatInline(trimmed.substring(2))}</h1>

        // List items
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            return (
              <div key={i} className="flex gap-2 ml-1">
                <span className="text-muted-foreground flex-shrink-0">•</span>
                <span>{formatInline(trimmed.substring(2))}</span>
              </div>
            )
        }

        // Numbered lists
        const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/)
        if (numMatch) {
            return (
              <div key={i} className="flex gap-2 ml-1">
                <span className="text-muted-foreground flex-shrink-0">{numMatch[1]}.</span>
                <span>{formatInline(numMatch[2])}</span>
              </div>
            )
        }

        // Blockquotes
        if (trimmed.startsWith('> ')) {
            return <div key={i} className="border-l-2 border-primary/50 pl-2 italic text-muted-foreground my-1">{formatInline(trimmed.substring(2))}</div>
        }

        // Empty lines
        if (!trimmed) return <div key={i} className="h-1" />

        // Regular text
        return <div key={i}>{formatInline(line)}</div>
      })}
    </div>
  )
}

const formatInline = (text: string) => {
    // Handle Bold: **text**
    const parts = text.split(/(\*\*.*?\*\*)/g)
    return (
      <>
        {parts.map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>
            }

            // Handle Code: `text`
            const codeParts = part.split(/(`.*?`)/g)
            return (
              <span key={i}>
                {codeParts.map((cp, j) => {
                     if (cp.startsWith('`') && cp.endsWith('`')) {
                         return <code key={j} className="bg-muted px-1 py-0.5 rounded text-[10px] font-mono text-primary">{cp.slice(1, -1)}</code>
                     }
                     return cp
                })}
              </span>
            )
        })}
      </>
    )
}

interface ThoughtBlockProps {
  content: string
  duration?: number
  isStreaming?: boolean
}

export function ThoughtBlock({ content, duration, isStreaming }: ThoughtBlockProps) {
  const [isCollapsed, setIsCollapsed] = useState(true)
  const [copied, setCopied] = useState(false)
  const contentRef = useRef<HTMLDivElement | null>(null)

  // Auto-expand and scroll while streaming
  useEffect(() => {
    if (isStreaming) {
      setIsCollapsed(false)
      // Auto-scroll to bottom if content is long
      if (contentRef.current) {
        contentRef.current.scrollTop = contentRef.current.scrollHeight
      }
    } else {
      // Collapse when done
      setIsCollapsed(true)
    }
  }, [isStreaming])

  // Auto-scroll when content updates and is expanded
  useEffect(() => {
    if (!isCollapsed && isStreaming && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight
    }
  }, [content, isCollapsed, isStreaming])

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  return (
    <div className="mb-2 rounded-lg border border-border bg-surface/50 overflow-hidden w-full group">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsCollapsed(!isCollapsed)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsCollapsed(!isCollapsed) } }}
        className="flex w-full items-center justify-between px-3 py-2 text-xs hover:bg-surface transition-colors cursor-pointer select-none"
      >
        <div className="flex items-center gap-2 text-muted-foreground">
          {isStreaming ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Brain className="h-3.5 w-3.5" />
          )}
          <span className="font-medium">
            {duration ? `思考过程 (${duration.toFixed(1)}s)` : '思考中...'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Copy Button */}
          {!isStreaming && (
            <button
              onClick={handleCopy}
              className="p-1 hover:bg-background rounded cursor-pointer mr-2 text-muted-foreground hover:text-foreground transition-colors z-10"
              title="复制代码"
              type="button"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <Copy className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </button>
          )}

          {isCollapsed ? (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </div>
      </div>

      {!isCollapsed && (
        <div className="border-t border-border px-3 py-2 w-full">
          <div
            ref={contentRef}
            className="prose prose-xs max-w-none text-muted-foreground font-mono text-xs max-h-60 overflow-y-auto custom-scrollbar w-full"
          >
            <SimpleMarkdown content={content} />
          </div>
        </div>
      )}
    </div>
  )
}

interface CodeBlockProps {
  code: string
  language?: 'xml' | 'json' | 'mermaid'
  isStreaming?: boolean
  duration?: number
}

export function CodeBlock({ code, language = 'xml', isStreaming, duration }: CodeBlockProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [copied, setCopied] = useState(false)
  const codeRef = useRef<HTMLPreElement | null>(null)

  // Auto-expand and scroll while streaming
  useEffect(() => {
    if (isStreaming) {
      setIsCollapsed(false)
    } else {
      // Collapse when done
      setIsCollapsed(true)
    }
  }, [isStreaming])

  // Auto-scroll when content updates and is expanded
  useEffect(() => {
    if (!isCollapsed && isStreaming && codeRef.current) {
      codeRef.current.scrollTop = codeRef.current.scrollHeight
    }
  }, [code, isCollapsed, isStreaming])

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  // Simple syntax highlighting
  const highlightCode = (code: string, lang: string) => {
    if (!code) return ''

    let highlighted = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')

    if (lang === 'xml') {
      const TAG_OPEN = '___TAG_OPEN___'
      const TAG_CLOSE = '___TAG_CLOSE___'
      const ATTR_OPEN = '___ATTR_OPEN___'
      const ATTR_CLOSE = '___ATTR_CLOSE___'
      const STR_OPEN = '___STR_OPEN___'
      const STR_CLOSE = '___STR_CLOSE___'

      // Tags: &lt;tag or &lt;/tag
      highlighted = highlighted.replace(
        /(&lt;\/?[a-zA-Z0-9_:\-?]+)/g,
        `${TAG_OPEN}$1${TAG_CLOSE}`
      )

      // Attributes: word=
      highlighted = highlighted.replace(
        /([a-zA-Z0-9_:\-]+)=/g,
        `${ATTR_OPEN}$1${ATTR_CLOSE}=`
      )

      // Strings: "..."
      highlighted = highlighted.replace(
        /"([^"]*)"/g,
        `${STR_OPEN}"$1"${STR_CLOSE}`
      )

      // Replace placeholders
      highlighted = highlighted
        .split(TAG_OPEN).join('<span class="text-blue-600 dark:text-blue-400">')
        .split(TAG_CLOSE).join('</span>')
        .split(ATTR_OPEN).join('<span class="text-purple-600 dark:text-purple-400">')
        .split(ATTR_CLOSE).join('</span>')
        .split(STR_OPEN).join('<span class="text-green-600 dark:text-green-400">')
        .split(STR_CLOSE).join('</span>')
    } else if (lang === 'json') {
      // Keys
      highlighted = highlighted.replace(
        /"([^"]+)":/g,
        '<span class="text-blue-600 dark:text-blue-400">"$1"</span>:'
      )
      // Strings
      highlighted = highlighted.replace(
        /: "([^"]*)"/g,
        ': <span class="text-green-600 dark:text-green-400">"$1"</span>'
      )
      // Booleans/Numbers
      highlighted = highlighted.replace(
        /: (true|false|null|[0-9.]+)/g,
        ': <span class="text-orange-600 dark:text-orange-400">$1</span>'
      )
    }

    return highlighted
  }

  return (
    <div className="mb-2 rounded-lg border border-border bg-surface overflow-hidden shadow-sm group w-full">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsCollapsed(!isCollapsed)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsCollapsed(!isCollapsed) } }}
        className="flex w-full items-center justify-between px-3 py-1.5 text-xs bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer select-none"
      >
        <div className="flex items-center gap-2 text-foreground">
          <Code2 className="h-3.5 w-3.5" />
          <span className="font-medium">
            {isStreaming ? '生成代码中...' : '代码生成'}
            {duration && !isStreaming && (
               <span className="text-xs text-muted-foreground ml-1 font-normal">
                 ({duration.toFixed(1)}s)
               </span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Copy Button */}
          {!isStreaming && (
            <button
              onClick={handleCopy}
              className="p-1 hover:bg-background rounded cursor-pointer mr-2 text-muted-foreground hover:text-foreground transition-colors z-10"
              title="复制代码"
              type="button"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <Copy className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </button>
          )}

          {isStreaming && <span className="animate-spin text-primary"><Loader2 className="h-3 w-3" /></span>}
          {isCollapsed ? (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </div>
      </div>

      {!isCollapsed && (
        <div className="relative w-full">
          <pre
            ref={codeRef}
            className="p-3 overflow-x-auto text-xs font-mono bg-background max-h-[200px] overflow-y-auto custom-scrollbar w-full"
          >
            <code
              dangerouslySetInnerHTML={{
                __html: highlightCode(code, language || 'xml')
              }}
            />
          </pre>
          {/* Language badge */}
          <div className="absolute top-2 right-2 text-[10px] text-muted-foreground bg-surface/80 px-1.5 py-0.5 rounded border border-border">
            {language?.toUpperCase()}
          </div>
        </div>
      )}
    </div>
  )
}

