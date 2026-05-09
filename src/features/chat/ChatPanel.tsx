import {useEffect, useRef, useState} from 'react'
import {
  ArrowLeftToLine,
  Bot,
  CheckCircle2,
  Copy,
  FileText,
  ImagePlus,
  Link,
  Loader2,
  MessageSquarePlus,
  MoveRight,
  RotateCcw,
  Send,
  Square,
  User,
  X
} from 'lucide-react'
import {Button, Loading} from '@/components/ui'
import {ModelSelector} from '@/components/ai/ModelSelector'
import {useChatStore} from '@/stores/chatStore'
import {selectIsEmpty, useEditorStore} from '@/stores/editorStore'
import {useAIGenerate} from '@/hooks/useAIGenerate'
import {useToast} from '@/hooks/useToast'
import {aiService} from '@/services/aiService'
import {ChatRepository} from '@/services/chatRepository'
import {useSystemStore} from '@/stores/systemStore'
import {usePayloadStore} from '@/stores/payloadStore'
import {
  fileToBase64,
  parseDocument,
  selectFiles,
  SUPPORTED_DOCUMENT_EXTENSIONS,
  SUPPORTED_IMAGE_TYPES,
  validateDocumentFile,
  validateImageFile,
} from '@/lib/fileUtils'
import type {Attachment, DocumentAttachment, ImageAttachment, UrlAttachment} from '@/types'
import {CodeBlock, ThoughtBlock} from './MessageBlocks'

type ChatPanelProps = {
  onCollapse?: () => void
}

export function ChatPanel({ onCollapse }: ChatPanelProps) {
  const [inputValue, setInputValue] = useState('')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [isProcessingFile, setIsProcessingFile] = useState(false)
  const [showUrlInput, setShowUrlInput] = useState(false)
  const [urlInputValue, setUrlInputValue] = useState('')
  const [isParsingUrl, setIsParsingUrl] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const hasHandledInitialPrompt = useRef(false)

  const { messages, isStreaming, initialPrompt, initialAttachments, clearInitialPrompt, clearMessages, abort } = useChatStore()
  const isCanvasEmpty = useEditorStore(selectIsEmpty)
  const currentProject = useEditorStore((s) => s.currentProject)
  const { generate, retryLast } = useAIGenerate()
  const { error: showError, success: showSuccess } = useToast()
  const language = useSystemStore((state) => state.language)
  const i18nTexts = useSystemStore((state) => state.i18nTexts)
  const setPayloadMessages = usePayloadStore((s) => s.setMessages)

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Handle initial prompt from Quick Start (Path A)
  useEffect(() => {
    if (initialPrompt && !hasHandledInitialPrompt.current) {
      hasHandledInitialPrompt.current = true
      const attachmentsToSend = initialAttachments ?? undefined
      clearInitialPrompt()
      handleSend(initialPrompt, attachmentsToSend)
    }
  }, [initialPrompt, initialAttachments])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px'
    }
  }, [inputValue])

  const handleImageUpload = async () => {
    const files = await selectFiles(SUPPORTED_IMAGE_TYPES.join(','))
    if (!files || files.length === 0) return

    setIsProcessingFile(true)
    try {
      const file = files[0]
      const validation = validateImageFile(file)
      if (!validation.valid) {
        showError(validation.error!)
        return
      }

      const dataUrl = await fileToBase64(file)
      const imageAttachment: ImageAttachment = {
        type: 'image',
        dataUrl,
        fileName: file.name,
      }
      setAttachments((prev) => [...prev, imageAttachment])
    } catch (err) {
      showError('图片处理失败')
      console.error(err)
    } finally {
      setIsProcessingFile(false)
    }
  }

  const handleDocumentUpload = async () => {
    const files = await selectFiles(SUPPORTED_DOCUMENT_EXTENSIONS.join(','))
    if (!files || files.length === 0) return

    setIsProcessingFile(true)
    try {
      const file = files[0]
      const validation = validateDocumentFile(file)
      if (!validation.valid) {
        showError(validation.error!)
        return
      }

      const content = await parseDocument(file)
      const docAttachment: DocumentAttachment = {
        type: 'document',
        content,
        fileName: file.name,
      }
      setAttachments((prev) => [...prev, docAttachment])
    } catch (err) {
      showError('文档处理失败')
      console.error(err)
    } finally {
      setIsProcessingFile(false)
    }
  }

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index))
  }

  const handleUrlSubmit = async () => {
    const url = urlInputValue.trim()
    if (!url) return

    setIsParsingUrl(true)
    try {
      const result = await aiService.parseUrl(url)
      if (result.data) {
        const urlAttachment: UrlAttachment = {
          type: 'url',
          content: result.data.content,
          url: result.data.url,
          title: result.data.title,
        }
        setAttachments((prev) => [...prev, urlAttachment])
        setUrlInputValue('')
        setShowUrlInput(false)
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : '链接解析失败')
      console.error(err)
    } finally {
      setIsParsingUrl(false)
    }
  }

  const handleCopyUserMessage = async (text: string) => {
    const toCopy = text?.trim()
    if (!toCopy) return
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(toCopy)
      } else {
        const textarea = document.createElement('textarea')
        textarea.value = toCopy
        textarea.setAttribute('readonly', 'true')
        textarea.style.position = 'fixed'
        textarea.style.left = '-9999px'
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
      }
      showSuccess('已复制')
    } catch (err) {
      showError('复制失败')
      console.error(err)
    }
  }

  const lastAssistantMessageId = [...messages].reverse().find((m) => m.role === 'assistant')?.id

  const handleSend = async (text?: string, initialAtts?: Attachment[]) => {
    const message = text || inputValue.trim()
    if ((!message && attachments.length === 0 && !initialAtts?.length) || isStreaming) return

    const currentAttachments = initialAtts ?? (attachments.length > 0 ? [...attachments] : undefined)
    setInputValue('')
    setAttachments([])
    await generate(message, isCanvasEmpty, currentAttachments)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // 处理剪贴板粘贴
  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items
    if (!items) return

    const filesToProcess: File[] = []

    for (const item of items) {
      if (item.kind === 'file') {
        const file = item.getAsFile()
        if (file) {
          filesToProcess.push(file)
        }
      }
    }

    if (filesToProcess.length === 0) return

    e.preventDefault()
    setIsProcessingFile(true)

    try {
      for (const file of filesToProcess) {
        // 处理图片
        if (SUPPORTED_IMAGE_TYPES.includes(file.type)) {
          const validation = validateImageFile(file)
          if (!validation.valid) {
            showError(validation.error!)
            continue
          }
          const dataUrl = await fileToBase64(file)
          const imageAttachment: ImageAttachment = {
            type: 'image',
            dataUrl,
            fileName: file.name || `pasted-image-${Date.now()}.png`,
          }
          setAttachments((prev) => [...prev, imageAttachment])
        }
        // 处理文档
        else if (SUPPORTED_DOCUMENT_EXTENSIONS.some(ext => file.name.toLowerCase().endsWith(ext.replace('*', '')))) {
          const validation = validateDocumentFile(file)
          if (!validation.valid) {
            showError(validation.error!)
            continue
          }
          const content = await parseDocument(file)
          const docAttachment: DocumentAttachment = {
            type: 'document',
            content,
            fileName: file.name,
          }
          setAttachments((prev) => [...prev, docAttachment])
        }
      }
    } catch (err) {
      showError('粘贴文件处理失败')
      console.error(err)
    } finally {
      setIsProcessingFile(false)
    }
  }

  // 获取AI消息的状态显示
  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'pending':
        return { text: '等待中...', icon: <Loader2 className="h-4 w-4 animate-spin" /> }
      case 'streaming':
        return { text: 'AI 思考中...', icon: <Loader2 className="h-4 w-4 animate-spin" /> }
      case 'complete':
        return { text: '绘制完成', icon: <CheckCircle2 className="h-4 w-4 text-green-500" /> }
      case 'error':
        return { text: '出错了', icon: <X className="h-4 w-4 text-red-500" /> }
      case 'aborted':
        return { text: '已停止', icon: <Square className="h-4 w-4 text-muted" /> }
      default:
        return { text: '处理中...', icon: <Loader2 className="h-4 w-4 animate-spin" /> }
    }
  }

  const getCodeLanguage = () => {
    const engineType = currentProject?.engineType || 'drawio'
    return engineType === 'mermaid' ? 'mermaid' : engineType === 'excalidraw' ? 'json' : 'xml'
  }

  return (
      <div className="flex h-full flex-col bg-surface">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-1">
          <div>
            <h2 className="font-medium text-primary">{i18nTexts.editorAIAssistant[language]}</h2>
          <p className="text-xs text-muted">
            {isCanvasEmpty ? i18nTexts.editorNewDiagram[language] : i18nTexts.editorModifyDiagram[language]}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {onCollapse && (
              <Button
                variant="ghost"
                size="icon"
                title={i18nTexts.chatCollapsePanel[language]}
                onClick={onCollapse}
                disabled={isStreaming}
              >
                <ArrowLeftToLine className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              title={i18nTexts.chatNewConversation[language]}
              onClick={async () => {
                if (messages.length === 0) return
                const ok = window.confirm('确认新建会话？此操作会删除当前项目的聊天历史记录。')
                if (!ok) return
                if (currentProject) {
                  try {
                    await ChatRepository.deleteByProjectId(currentProject.id)
                  } catch (err) {
                    console.error('Failed to delete chat history:', err)
                  }
                }
                clearMessages()
                setPayloadMessages([])
              }}
              disabled={isStreaming || messages.length === 0}
            >
              <MessageSquarePlus className="h-4 w-4" />
            </Button>
          </div>
        </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-muted">
            <Bot className="mb-4 h-12 w-12 opacity-50" />
            <p className="text-sm">
              {i18nTexts.chatEmptyPrompt[language]}
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 mb-4 ${
                msg.role === 'user' ? 'flex-row-reverse' : ''
              }`}
            >
              {/* Avatar */}
              <div
                className={`flex h-8 w-8 flex-shrink-0 items-center justify-center ${
                  msg.role === 'user'
                    ? 'bg-primary text-surface'
                    : 'border border-border bg-surface text-primary'
                }`}
              >
                {msg.role === 'user' ? (
                  <User className="h-4 w-4" />
                ) : (
                  <Bot className="h-4 w-4" />
                )}
              </div>

              {/* Content */}
              <div className="flex items-start gap-1 w-full max-w-[85%]">
                {msg.role === 'user' && (
                  <Button
                    variant="ghost"
                    size="icon"
                    title="复制"
                    onClick={() => handleCopyUserMessage(msg.content)}
                    disabled={!msg.content?.trim()}
                    className="h-7 w-7 flex-shrink-0"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                )}

                <div
                  className={`w-full px-3 py-2 ${
                    msg.role === 'user'
                      ? 'bg-primary text-surface'
                      : 'border border-border bg-background'
                  }`}
                >
                  {/* Show attachments for user messages */}
                  {msg.role === 'user' && msg.attachments && msg.attachments.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-2">
                      {msg.attachments.map((att, idx) => (
                        <div key={idx} className="text-xs opacity-80">
                          {att.type === 'image' ? (
                            <img
                              src={att.dataUrl}
                              alt={att.fileName}
                              className="max-h-20 max-w-20 object-cover border border-surface/30"
                            />
                          ) : att.type === 'url' ? (
                            <span className="flex items-center gap-1">
                              <Link className="h-3 w-3" />
                              {att.title}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <FileText className="h-3 w-3" />
                              {att.fileName}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* AI消息使用状态板显示 */}
                  {msg.role === 'assistant' ? (
                    <div className="flex flex-col gap-2 w-full">
                      {/* Plan Section */}
                      {msg.plan && (
                        <ThoughtBlock
                          content={msg.plan}
                          duration={msg.metrics?.planEndTime && msg.metrics?.startTime ? (msg.metrics.planEndTime - msg.metrics.startTime) / 1000 : undefined}
                          isStreaming={msg.status === 'streaming' && !msg.metrics?.planEndTime}
                        />
                      )}

                      {/* Code Section */}
                      {msg.code && (
                        <CodeBlock
                          code={msg.code}
                          language={getCodeLanguage()}
                          isStreaming={msg.status === 'streaming'}
                          duration={msg.metrics?.endTime && (msg.metrics.planEndTime || msg.metrics.startTime) ? (msg.metrics.endTime - (msg.metrics.planEndTime || msg.metrics.startTime)) / 1000 : undefined}
                        />
                      )}

                      {/* Fallback / Raw Content */}
                      {!msg.plan && !msg.code && (
                        <div className="text-sm whitespace-pre-wrap">
                          {msg.content}
                        </div>
                      )}

                      <div className="flex items-center gap-2 justify-between mt-1">
                        <div className="flex items-center gap-2">
                          {getStatusDisplay(msg.status).icon}
                          <span className="text-sm">{getStatusDisplay(msg.status).text}</span>
                        </div>
                        {msg.metrics?.endTime && msg.metrics?.startTime && (
                           <span className="text-xs text-muted-foreground">
                             总耗时: {((msg.metrics.endTime - msg.metrics.startTime) / 1000).toFixed(1)}s
                           </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>

                {msg.role === 'assistant' && msg.id === lastAssistantMessageId && (
                  <Button
                    variant="ghost"
                    size="icon"
                    title="重新发送"
                    onClick={() => retryLast(msg.id)}
                    disabled={isStreaming || msg.status === 'streaming' || msg.status === 'pending'}
                    className="h-7 w-7 flex-shrink-0"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Attachment Preview */}
      {attachments.length > 0 && (
        <div className="border-t border-border px-4 py-2">
          <div className="flex flex-wrap gap-2">
            {attachments.map((att, idx) => (
              <div
                key={idx}
                className="relative flex items-center gap-1 border border-border bg-background px-2 py-1 text-xs"
              >
                {att.type === 'image' ? (
                  <img
                    src={att.dataUrl}
                    alt={att.fileName}
                    className="h-8 w-8 object-cover"
                  />
                ) : att.type === 'url' ? (
                  <>
                    <Link className="h-3 w-3" />
                    <span className="max-w-24 truncate">{att.title}</span>
                  </>
                ) : (
                  <>
                    <FileText className="h-3 w-3" />
                    <span className="max-w-24 truncate">{att.fileName}</span>
                  </>
                )}
                <button
                  onClick={() => removeAttachment(idx)}
                  className="ml-1 text-muted hover:text-primary"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input Area - 优化后的大输入框设计 */}
      <div className="border-t border-border p-4">
        <div className="relative flex flex-col border border-border rounded-lg bg-background focus-within:border-primary transition-colors">
          {/* Textarea */}
          <textarea
            ref={textareaRef}
            placeholder={i18nTexts.chatInputPlaceholder[language]}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            disabled={isStreaming}
            rows={1}
            className="w-full resize-none bg-transparent px-4 pt-3 pb-12 text-sm outline-none placeholder:text-muted disabled:opacity-50"
            style={{ minHeight: '120px', maxHeight: '200px' }}
          />

          {/* URL Input - 行内输入框 */}
          {showUrlInput && (
            <div className="absolute left-0 right-0 bottom-40 flex items-center gap-2 z-10 bg-background p-2 rounded border border-border shadow-md">
              <input
                type="url"
                placeholder="输入网址链接..."
                value={urlInputValue}
                onChange={(e) => setUrlInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleUrlSubmit()
                  } else if (e.key === 'Escape') {
                    setShowUrlInput(false)
                    setUrlInputValue('')
                  }
                }}
                disabled={isParsingUrl}
                className="flex-1 border border-border rounded px-2 py-1 text-sm bg-surface outline-none focus:border-primary disabled:opacity-50"
                autoFocus
              />
              <Button
                size="sm"
                onClick={handleUrlSubmit}
                disabled={!urlInputValue.trim() || isParsingUrl}
                className="h-7"
              >
                <MoveRight className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowUrlInput(false)
                  setUrlInputValue('')
                }}
                disabled={isParsingUrl}
                className="h-7"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Bottom toolbar inside input */}
          <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                title="上传图片"
                onClick={handleImageUpload}
                disabled={isStreaming || isProcessingFile}
                className="h-8 w-8"
              >
                <ImagePlus className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                title="上传文档 (docx, txt, md)"
                onClick={handleDocumentUpload}
                disabled={isStreaming || isProcessingFile}
                className="h-8 w-8"
              >
                <FileText className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                title="添加网址链接"
                onClick={() => setShowUrlInput(!showUrlInput)}
                disabled={isStreaming || isProcessingFile || isParsingUrl}
                className="h-8 w-8"
              >
                <Link className="h-4 w-4" />
              </Button>
              <div className="h-3 w-[1px] bg-border mx-1" />
              <ModelSelector />
              {isProcessingFile && (
                <span className="flex items-center text-xs text-muted ml-2">
                  <Loading size="sm" className="mr-1" />
                  处理中...
                </span>
              )}
              {isParsingUrl && (
                <span className="flex items-center text-xs text-muted ml-2">
                  <Loading size="sm" className="mr-1" />
                  解析链接中...
                </span>
              )}
            </div>
            {isStreaming ? (
              <Button
                onClick={abort}
                size="sm"
                variant="destructive"
                className="h-8"
                title="停止生成"
              >
                <Square className="h-4 w-4 mr-1 fill-current" />
              </Button>
            ) : (
              <Button
                onClick={() => handleSend()}
                disabled={!inputValue.trim() && attachments.length === 0}
                size="sm"
                className="h-8"
              >
                <Send className="h-4 w-4 mr-1" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
