import {useChatStore} from '@/stores/chatStore'
import {useEditorStore} from '@/stores/editorStore'
import {usePayloadStore} from '@/stores/payloadStore'
import {useStorageModeStore} from '@/stores/storageModeStore'
import {useAuthStore} from '@/stores/authStore'
import {VersionRepository} from '@/services/versionRepository'
import {ProjectRepository} from '@/services/projectRepository'
import {authService} from '@/services/authService'
import {buildEditPrompt, buildInitialPrompt, extractCode, getSystemPrompt,} from '@/lib/promptBuilder'
import {generateThumbnail} from '@/lib/thumbnail'
import {aiService} from '@/services/aiService'
import {validateContent} from '@/lib/validators'
import {sanitizeSvg} from '@/lib/validators/html'
import {useToast} from '@/hooks/useToast'
import {applyDiagramOperations, convertToLegalXml, parseResponse, replaceNodes, validateAndFixXml} from '@/lib/xmlUtils'
import type {Attachment, EngineType, PayloadMessage} from '@/types'

// Enable streaming by default, can be configured
const USE_STREAMING = true

// Maximum retry attempts for Mermaid auto-fix
const MAX_MERMAID_FIX_ATTEMPTS = 3

// Throttle helper (ensures execution every wait ms during continuous calls)
// Returns an object with the throttled function and a cancel method
const throttle = (func: Function, wait: number) => {
  let timeout: ReturnType<typeof setTimeout> | null = null
  let lastArgs: any[] | null = null

  const throttled = (...args: any[]) => {
    lastArgs = args
    if (!timeout) {
      timeout = setTimeout(() => {
        timeout = null
        if (lastArgs) {
          func(...lastArgs)
          lastArgs = null
        }
      }, wait)
    }
  }

  throttled.cancel = () => {
    if (timeout) {
      clearTimeout(timeout)
      timeout = null
    }
    lastArgs = null
  }

  return throttled
}

/**
 * Build multimodal content from text, attachments, and optional context
 * @param text - The text content (may include XML context for drawio)
 * @param attachments - Optional user attachments (images or documents)
 */
function buildMultimodalContent(
  text: string,
  attachments?: Attachment[],
): string {
  const hasAttachments = attachments && attachments.length > 0

  if (!hasAttachments) {
    return text
  }

  let result = text

  // Add user attachments
  for (const attachment of attachments) {
    if (attachment.type === 'image') {
      // For images in drawio editing, we include them as text reference
      // since we're now using XML text-based context instead of thumbnails
      result += `\n\n[User uploaded image]`
    } else if (attachment.type === 'document') {
      // For documents, append the extracted text content
      result += `\n\n[Document: ${attachment.fileName}]\n${attachment.content}`
    } else if (attachment.type === 'url') {
      // For URLs, append the extracted markdown content
      result += `\n\n[URL: ${attachment.title}]\n${attachment.content}`
    }
  }

  return result
}

export function useAIGenerate() {
  const {
    addMessage,
    updateMessage,
    setStreaming,
  } = useChatStore()

  const {
    currentProject,
    currentContent,
    setContentFromVersion,
    setContent,
    setLoading,
    thumbnailGetter,
    setProject,
  } = useEditorStore()

  const { setMessages } = usePayloadStore()
  const { success, error: showError } = useToast()

  /**
   * Generate diagram using AI with streaming support
   * @param userInput - User's description or modification request
   * @param isInitial - Whether this is initial generation (empty canvas)
   * @param attachments - Optional attachments (images or documents)
   */
  const generate = async (
    userInput: string,
    isInitial: boolean,
    attachments?: Attachment[]
  ) => {
    if (!currentProject) return

    const engineType = currentProject.engineType
    const systemPrompt = getSystemPrompt(engineType, {
      styleVariant: currentProject.styleVariant,
    })

    // Add user message to UI (with attachments)
    addMessage({
      role: 'user',
      content: userInput,
      status: 'complete',
      attachments,
    })

    // Add assistant message placeholder
    const assistantMsgId = addMessage({
      role: 'assistant',
      content: '',
      status: 'streaming',
    })

    setStreaming(true)
    setLoading(true)
    const startTime = Date.now()

    // Metrics tracking
    const metrics = {
      startTime,
      firstTokenTime: undefined as number | undefined,
      planEndTime: undefined as number | undefined,
      endTime: undefined as number | undefined,
    }

    // Track last processed XML to avoid redundant updates
    let lastProcessedXml = ''

    // Throttled editor updater for dynamic rendering
    // For partial edits (operations), the code is already complete XML from applyDiagramOperations
    // For full regeneration, the code is streaming AI output that needs convertToLegalXml
    const throttledUpdate = throttle((code: string, isPartialEdit: boolean = false) => {
      if (!code) return

      // Disable dynamic rendering for Mermaid and Excalidraw
      if (engineType === 'mermaid' || engineType === 'excalidraw') {
        return
      }

      let codeToRender = code
      // For drawio, try to fix incomplete XML (only for full regeneration, not partial edits)
      if (engineType === 'drawio' && !isPartialEdit) {
        try {
          console.log(`[ThrottledUpdate] Full regeneration mode, input length: ${code.length}`)
          // Use convertToLegalXml for streaming updates to only include complete cells
          // This avoids "invalid XML" errors from incomplete tags at the end of the stream
          const convertedXml = convertToLegalXml(code)
          console.log(`[ThrottledUpdate] Converted XML length: ${convertedXml.length}`)

          // Optimization: Skip if XML hasn't changed (ignoring incomplete tail)
          if (convertedXml === lastProcessedXml) {
             console.log(`[ThrottledUpdate] XML unchanged, skipping`)
             return
          }
          lastProcessedXml = convertedXml

          // Use replaceNodes to merge with current content (preserves viewport)
          // Get latest content from store directly to ensure we have the latest viewport state
          const currentContent = useEditorStore.getState().currentContent || `<mxfile><diagram name="Page-1" id="page-1"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel></diagram></mxfile>`
          let mergedXml = replaceNodes(currentContent, convertedXml)

          // Validate and fix the merged XML (crucial for stability)
          mergedXml = validateAndFixXml(mergedXml)
          console.log(`[ThrottledUpdate] Merged & Validated XML length: ${mergedXml.length}`)

          codeToRender = mergedXml
        } catch (error) {
          console.error('[ThrottledUpdate] Error processing XML:', error)
          return // Skip this update if processing fails
        }
      } else if (engineType === 'drawio' && isPartialEdit) {
        // Partial edit: code is already complete XML from applyDiagramOperations
        // Just validate and use it directly
        try {
          console.log(`[ThrottledUpdate] Partial edit mode, input length: ${code.length}`)
          codeToRender = validateAndFixXml(code)
          console.log(`[ThrottledUpdate] Validated XML length: ${codeToRender.length}`)
        } catch (error) {
          console.error('[ThrottledUpdate] Error validating partial edit XML:', error)
          codeToRender = code
        }
      }

      // Update editor content if we have something valid-ish
      if (codeToRender && codeToRender.trim()) {
        try {
          console.log(`[ThrottledUpdate] Updating content`)
          setContent(codeToRender)
        } catch (error) {
          console.error('[ThrottledUpdate] Error setting content:', error)
        }
      }
    }, 150)

    try {
      let finalCode: string

      if (isInitial) {
        // 暂时全都使用一步生成
        const useTwoPhase = false

        if (useTwoPhase) {
          finalCode = await twoPhaseGeneration(
            userInput,
            engineType,
            systemPrompt,
            assistantMsgId,
            attachments
          )
        } else {
          finalCode = await singlePhaseInitialGeneration(
            userInput,
            engineType,
            systemPrompt,
            assistantMsgId,
            attachments,
            metrics,
            throttledUpdate
          )
        }
      } else {
        // Single-phase for edits - use XML text context instead of thumbnail
        // This is more efficient and allows AI to do partial edits
        finalCode = await singlePhaseGeneration(
          userInput,
          currentContent,
          engineType,
          systemPrompt,
          assistantMsgId,
          attachments,
          metrics,
          throttledUpdate
        )
      }

      // Validate the generated content with auto-fix for Mermaid
      console.log('finalCode', finalCode)
      let validatedCode = finalCode

      // Snapshot of what's currently on the canvas (last good frame from throttled streaming).
      // Used as a safety fallback if post-stream validation fails for drawio.
      const streamingFallback = useEditorStore.getState().currentContent

      if (engineType === 'html') {
        validatedCode = sanitizeSvg(validatedCode)
      }

      if (engineType === 'drawio') {
        validatedCode = validateAndFixXml(validatedCode)
        // Note: For partial edits (operations), applyDiagramOperations already returns complete XML
        // For full regeneration, we use replaceNodes to preserve viewport.
        // Detect partial edits by inspecting the assistant message we just generated
        // (chatStore holds the accumulated AI response; payloadStore only has user/system messages).
        const chatMessages = useChatStore.getState().messages
        const ourAssistantMessage = chatMessages.find(m => m.id === assistantMsgId)
        const isPartialEdit = typeof ourAssistantMessage?.content === 'string' && ourAssistantMessage.content.includes('<edit_operations>')

        if (!isPartialEdit) {
          // Full regeneration: merge to preserve viewport
          const currentContent = useEditorStore.getState().currentContent || `<mxfile><diagram name="Page-1" id="page-1"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel></diagram></mxfile>`
          validatedCode = replaceNodes(currentContent, validatedCode)
        } else {
          // Partial edit: applyDiagramOperations already returned complete XML
          console.log('[generate] Partial edit detected, skipping replaceNodes')
        }
      }

      let validation = await validateContent(validatedCode, engineType)

      // Auto-fix mechanism for Mermaid engine
      if (!validation.valid && engineType === 'mermaid') {
        validatedCode = await attemptMermaidAutoFix(
          validatedCode,
          validation.error || 'Unknown error',
          systemPrompt,
          assistantMsgId
        )
        // Re-validate after fix attempts
        validation = await validateContent(validatedCode, engineType)
      }

      if (!validation.valid) {
        // For drawio, the canvas already shows a usable streaming snapshot. Don't wipe it
        // with an error toast — fall back to that snapshot and surface a warning instead.
        if (engineType === 'drawio' && streamingFallback) {
          console.warn(`[generate] Post-stream validation failed (${validation.error}); falling back to streaming snapshot (${streamingFallback.length} chars)`)
          validatedCode = streamingFallback
        } else {
          throw new Error(`Invalid ${engineType} output: ${validation.error}`)
        }
      }

      // Use the validated (possibly fixed) code
      finalCode = validatedCode

      // Update content (AI generation auto-saves, so mark as saved)
      setContentFromVersion(finalCode)

      // Update assistant message
      metrics.endTime = Date.now()
      const duration = ((metrics.endTime - metrics.startTime) / 1000).toFixed(1)

      // Final update to ensure everything is synced
      const currentMessageContent = useChatStore.getState().messages.find(m => m.id === assistantMsgId)?.content || ''
      const { plan } = parseResponse(currentMessageContent)

      updateMessage(assistantMsgId, {
        content: currentMessageContent,
        plan: plan || undefined,
        code: finalCode, // Use validated code
        status: 'complete',
        metrics
      })

      // Save version
      await VersionRepository.create({
        projectId: currentProject.id,
        content: finalCode,
        changeSummary: isInitial ? '初始生成' : 'AI 修改',
      })

      // Generate and save thumbnail
      try {
        let thumbnail: string = ''
        if (engineType === 'drawio') {
          const getThumbnailWithRetry = async (maxRetries = 3, delay = 500): Promise<string> => {
            for (let i = 0; i < maxRetries; i++) {
              await new Promise(resolve => setTimeout(resolve, delay))
              const getter = useEditorStore.getState().thumbnailGetter
              if (getter) {
                const result = await getter()
                // Validate that result is a valid data URL
                if (result && (result.startsWith('data:') || /^data:image\/[^;]+;base64,/.test(result))) {
                  return result
                }
              }
            }
            return ''
          }
          thumbnail = await getThumbnailWithRetry()
        } else {
          thumbnail = await generateThumbnail(finalCode, engineType)
        }
        if (thumbnail && thumbnail.startsWith('data:')) {
          await ProjectRepository.update(currentProject.id, { thumbnail })
          setProject({ ...currentProject, thumbnail })
        }
      } catch (err) {
        console.error('Failed to generate thumbnail:', err)
      }

      await ProjectRepository.update(currentProject.id, {})
      success('Diagram generated successfully')

      // Log AI chat - always use local user ID in local mode
      const mode = useStorageModeStore.getState().mode
      const payloadMessages = usePayloadStore.getState().messages

      // In local mode, always use local user ID regardless of cloud login status
      const localUserId = useStorageModeStore.getState().localUserId
      const userId = mode === 'local' ? localUserId : useAuthStore.getState().user?.id
      const userType = mode === 'local' ? 'local' : 'cloud'

      if (userId) {
        authService.logAIChat({
          userId,
          userType,
          modelName: '系统默认模型',
          details: {
            userInput,
            isInitial,
            engineType,
            duration: ((metrics.endTime || Date.now()) - metrics.startTime) / 1000,
            messages: payloadMessages
          }
        })
      }

    } catch (error) {
      console.error('AI generation failed:', error)
      updateMessage(assistantMsgId, {
        content: `Error: ${error instanceof Error ? error.message : 'Generation failed'}`,
        status: 'error',
      })
      showError(error instanceof Error ? error.message : 'Generation failed')
    } finally {
      // Cancel any pending throttled update so a stale trailing call cannot
      // overwrite currentContent after the try/catch has already settled.
      throttledUpdate.cancel()
      setStreaming(false)
      setLoading(false)
    }
  }

  /**
   * Retry the last AI request using the current payload context
   */
  const retryLast = async (assistantMessageId?: string) => {
    if (!currentProject) return

    const payloadMessages = usePayloadStore.getState().messages
    if (!payloadMessages || payloadMessages.length === 0) {
      showError('没有可重新发送的上下文')
      return
    }

    const engineType = currentProject.engineType
    const systemPrompt = getSystemPrompt(engineType, {
      styleVariant: currentProject.styleVariant,
    })

    const assistantMsgId =
      assistantMessageId ??
      addMessage({
        role: 'assistant',
        content: '',
        status: 'streaming',
      })

    updateMessage(assistantMsgId, {
      content: 'Retrying...',
      status: 'streaming',
    })

    setStreaming(true)
    setLoading(true)
    const startTime = Date.now()

    const metrics = {
      startTime,
      firstTokenTime: undefined as number | undefined,
      planEndTime: undefined as number | undefined,
      endTime: undefined as number | undefined,
    }

    let lastProcessedXml = ''

    const throttledUpdate = throttle((code: string) => {
      if (!code) return

      // Disable dynamic rendering for Mermaid and Excalidraw
      if (engineType === 'mermaid' || engineType === 'excalidraw') {
        return
      }

      let codeToRender = code
      if (engineType === 'drawio') {
        try {
          console.log(`[ThrottledUpdate Retry] Input length: ${code.length}`)
          // Use convertToLegalXml for streaming updates to only include complete cells
          const convertedXml = convertToLegalXml(code)

          // Optimization: Skip if XML hasn't changed
          if (convertedXml === lastProcessedXml) {
             console.log(`[ThrottledUpdate Retry] XML unchanged, skipping`)
             return
          }
          lastProcessedXml = convertedXml

          // Use replaceNodes to merge with current content (preserves viewport)
          const currentContent = useEditorStore.getState().currentContent || `<mxfile><diagram name="Page-1" id="page-1"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel></diagram></mxfile>`
          let mergedXml = replaceNodes(currentContent, convertedXml)

          // Validate and fix
          mergedXml = validateAndFixXml(mergedXml)
          console.log(`[ThrottledUpdate Retry] Merged & Validated XML length: ${mergedXml.length}`)

          codeToRender = mergedXml
        } catch (error) {
          console.error('[ThrottledUpdate Retry] Error processing XML:', error)
          return // Skip this update if processing fails
        }
      }
      if (codeToRender && codeToRender.trim()) {
        try {
          console.log(`[ThrottledUpdate Retry] Updating content`)
          setContent(codeToRender)
        } catch (error) {
          console.error('[ThrottledUpdate Retry] Error setting content:', error)
        }
      }
    }, 150)

    try {
      setMessages(payloadMessages)

      let response: string
      if (USE_STREAMING) {
        response = await aiService.streamChat(
          payloadMessages,
          (_chunk, accumulated) => {
            if (!metrics.firstTokenTime) metrics.firstTokenTime = Date.now()

            const { plan, code, operations } = parseResponse(accumulated)

            if (plan && !metrics.planEndTime && accumulated.includes('</plan>')) {
              metrics.planEndTime = Date.now()
            }

            updateMessage(assistantMsgId, {
              content: accumulated,
              plan: plan || undefined,
              code: code || undefined,
              metrics: { ...metrics },
              status: 'streaming'
            })

            // For drawio, handle operations or code
            if (engineType === 'drawio' && operations && operations.length > 0) {
              try {
                const currentContent = useEditorStore.getState().currentContent || `<mxfile><diagram name="Page-1" id="page-1"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel></diagram></mxfile>`
                const { result: editedXml } = applyDiagramOperations(currentContent, operations)
                throttledUpdate(editedXml, true) // true = isPartialEdit
              } catch (error) {
                console.error('[retryLast] Error applying operations:', error)
              }
            } else if (code) {
               throttledUpdate(code, false) // false = full regeneration
            }
          }
        )
      } else {
        response = await aiService.chat(payloadMessages)
      }

      // Parse response for operations or code
      const { operations } = parseResponse(response)

      // For drawio, handle operations
      let finalCode: string
      if (engineType === 'drawio' && operations && operations.length > 0) {
        console.log('[retryLast] Applying partial edit operations:', operations.length)
        const currentContent = useEditorStore.getState().currentContent || `<mxfile><diagram name="Page-1" id="page-1"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel></diagram></mxfile>`
        const { result: editedXml, errors } = applyDiagramOperations(currentContent, operations)
        if (errors.length > 0) {
          console.warn('[retryLast] Operation errors:', errors)
        }
        finalCode = editedXml
      } else {
        finalCode = extractCode(response, engineType)
      }

      let validatedCode = finalCode

      if (engineType === 'html') {
        validatedCode = sanitizeSvg(validatedCode)
      }

      if (engineType === 'drawio') {
        validatedCode = validateAndFixXml(validatedCode)
        // Final merge to ensure viewport preservation
        const currentContent = useEditorStore.getState().currentContent || `<mxfile><diagram name="Page-1" id="page-1"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel></diagram></mxfile>`
        validatedCode = replaceNodes(currentContent, validatedCode)
      }

      let validation = await validateContent(validatedCode, engineType)

      if (!validation.valid && engineType === 'mermaid') {
        validatedCode = await attemptMermaidAutoFix(
          validatedCode,
          validation.error || 'Unknown error',
          systemPrompt,
          assistantMsgId
        )
        validation = await validateContent(validatedCode, engineType)
      }

      if (!validation.valid) {
        throw new Error(`Invalid ${engineType} output: ${validation.error}`)
      }

      finalCode = validatedCode

      // Cancel any pending throttled updates to prevent stale updates after retry completes
      throttledUpdate.cancel()

      setContentFromVersion(finalCode)

      metrics.endTime = Date.now()
      updateMessage(assistantMsgId, {
        content: response,
        code: finalCode,
        status: 'complete',
        metrics
      })

      await VersionRepository.create({
        projectId: currentProject.id,
        content: finalCode,
        changeSummary: 'AI 重试',
      })

      try {
        let thumbnail: string = ''
        if (engineType === 'drawio') {
          const getThumbnailWithRetry = async (maxRetries = 3, delay = 500): Promise<string> => {
            for (let i = 0; i < maxRetries; i++) {
              await new Promise(resolve => setTimeout(resolve, delay))
              const getter = useEditorStore.getState().thumbnailGetter
              if (getter) {
                const result = await getter()
                if (result) return result
              }
            }
            return ''
          }
          thumbnail = await getThumbnailWithRetry()
        } else {
          thumbnail = await generateThumbnail(finalCode, engineType)
        }

        if (thumbnail) {
          await ProjectRepository.update(currentProject.id, { thumbnail })
          setProject({ ...currentProject, thumbnail })
        }
      } catch (err) {
        console.error('Failed to generate thumbnail:', err)
      }

      await ProjectRepository.update(currentProject.id, {})
      success('Diagram generated successfully')

      // Log AI chat for retry - always use local user ID in local mode
      const retryMode = useStorageModeStore.getState().mode
      const localUserId = useStorageModeStore.getState().localUserId
      const retryUserId = retryMode === 'local' ? localUserId : useAuthStore.getState().user?.id
      const retryUserType = retryMode === 'local' ? 'local' : 'cloud'

      if (retryUserId) {
        authService.logAIChat({
          userId: retryUserId,
          userType: retryUserType,
          modelName: '系统默认模型',
          details: {
            isRetry: true,
            engineType,
            duration: ((metrics.endTime || Date.now()) - metrics.startTime) / 1000,
            messages: payloadMessages
          }
        })
      }

    } catch (error) {
      console.error('AI retry failed:', error)
      updateMessage(assistantMsgId, {
        content: `Error: ${error instanceof Error ? error.message : 'Retry failed'}`,
        status: 'error',
      })
      showError(error instanceof Error ? error.message : 'Retry failed')
    } finally {
      setStreaming(false)
      setLoading(false)
    }
  }

  /**
   * Two-phase generation for initial creation (drawio/excalidraw)
   */
  const twoPhaseGeneration = async (
    userInput: string,
    engineType: EngineType,
    systemPrompt: string,
    assistantMsgId: string,
    attachments?: Attachment[]
  ): Promise<string> => {
    // Phase 1: Generate elements
    updateMessage(assistantMsgId, {
      content: 'Phase 1/2: Generating elements...',
      status: 'streaming',
    })

    const phase1Prompt = buildInitialPrompt(userInput, true, 'elements')
    const phase1Content = buildMultimodalContent(phase1Prompt, attachments)

    const phase1Messages: PayloadMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: phase1Content },
    ]

    setMessages(phase1Messages)

    let elements: string
    if (USE_STREAMING) {
      const response = await aiService.streamChat(
        phase1Messages,
        (_chunk, accumulated) => {
          updateMessage(assistantMsgId, {
            content: `Phase 1/2: Generating elements...\n\n${accumulated}`,
          })
        }
      )
      elements = extractCode(response, engineType)
    } else {
      const response = await aiService.chat(phase1Messages)
      elements = extractCode(response, engineType)
    }

    // Phase 2: Generate links/connections
    updateMessage(assistantMsgId, {
      content: 'Phase 2/2: Generating connections...',
      status: 'streaming',
    })

    let phase1Thumbnail: string | undefined
    try {
      phase1Thumbnail = await generateThumbnail(elements, engineType)
    } catch (err) {
      console.error('Failed to generate phase 1 thumbnail:', err)
    }

    const phase2Prompt = buildInitialPrompt(userInput, true, 'links', elements)
    const phase2Content = buildMultimodalContent(phase2Prompt, attachments)
    const phase2Messages: PayloadMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: phase1Content },
      { role: 'assistant', content: elements },
      { role: 'user', content: phase2Content },
    ]

    setMessages(phase2Messages)

    if (USE_STREAMING) {
      const response = await aiService.streamChat(
        phase2Messages,
        (_chunk, accumulated) => {
          updateMessage(assistantMsgId, {
            content: `Phase 2/2: Generating connections...\n\n${accumulated}`,
          })
        }
      )
      return extractCode(response, engineType)
    } else {
      const response = await aiService.chat(phase2Messages)
      return extractCode(response, engineType)
    }
  }

  /**
   * Single-phase generation for initial creation (mermaid)
   */
  const singlePhaseInitialGeneration = async (
    userInput: string,
    engineType: EngineType,
    systemPrompt: string,
    assistantMsgId: string,
    attachments?: Attachment[],
    metrics?: any,
    debouncedUpdate?: (code: string) => void
  ): Promise<string> => {
    updateMessage(assistantMsgId, {
      content: 'Generating diagram...',
      status: 'streaming',
    })

    const prompt = buildInitialPrompt(userInput, false)
    const content = buildMultimodalContent(prompt, attachments)

    const messages: PayloadMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: content },
    ]

    setMessages(messages)

    if (USE_STREAMING) {
      const response = await aiService.streamChat(
        messages,
        (_chunk, accumulated) => {
          if (metrics && !metrics.firstTokenTime) metrics.firstTokenTime = Date.now()

          const { plan, code } = parseResponse(accumulated)

          if (metrics && plan && !metrics.planEndTime && accumulated.includes('</plan>')) {
            metrics.planEndTime = Date.now()
          }

          updateMessage(assistantMsgId, {
            content: accumulated,
            plan: plan || undefined,
            code: code || undefined,
            metrics,
            status: 'streaming'
          })

          if (code && debouncedUpdate) {
             debouncedUpdate(code)
          }
        }
      )
      return extractCode(response, engineType)
    } else {
      const response = await aiService.chat(messages)
      return extractCode(response, engineType)
    }
  }

  /**
   * Single-phase generation for edits
   * Supports both full regeneration and partial edits via operations
   */
  const singlePhaseGeneration = async (
    userInput: string,
    currentCode: string,
    engineType: EngineType,
    systemPrompt: string,
    assistantMsgId: string,
    attachments?: Attachment[],
    metrics?: any,
    debouncedUpdate?: (code: string, isPartialEdit?: boolean) => void
  ): Promise<string> => {
    const editPrompt = buildEditPrompt(currentCode, userInput)
    const editContent = buildMultimodalContent(editPrompt, attachments)

    const messages: PayloadMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: editContent },
    ]

    setMessages(messages)

    if (USE_STREAMING) {
      const response = await aiService.streamChat(
        messages,
        (_chunk, accumulated) => {
          if (metrics && !metrics.firstTokenTime) metrics.firstTokenTime = Date.now()

          const { plan, code, operations } = parseResponse(accumulated)

          if (metrics && plan && !metrics.planEndTime && accumulated.includes('</plan>')) {
            metrics.planEndTime = Date.now()
          }

          updateMessage(assistantMsgId, {
            content: accumulated,
            plan: plan || undefined,
            code: code || undefined,
            metrics,
            status: 'streaming'
          })

          // For drawio, check if we have operations or full code
          if (engineType === 'drawio' && operations && operations.length > 0) {
            // Apply operations to current code for preview
            try {
              console.log('[singlePhaseGeneration] Applying operations in stream, currentCode length:', currentCode.length)
              const { result: editedXml } = applyDiagramOperations(currentCode, operations)
              console.log('[singlePhaseGeneration] Edited XML length:', editedXml.length)
              if (debouncedUpdate) {
                debouncedUpdate(editedXml, true) // true = isPartialEdit
              }
            } catch (error) {
              console.error('[singlePhaseGeneration] Error applying operations:', error)
            }
          } else if (code && debouncedUpdate) {
            console.log('[singlePhaseGeneration] Updating with code in stream, length:', code.length)
            debouncedUpdate(code, false) // false = full regeneration
          }
        }
      )

      // Parse final response
      const { operations } = parseResponse(response)

      // If drawio returned operations, apply them
      if (engineType === 'drawio' && operations && operations.length > 0) {
        console.log('[singlePhaseGeneration] Applying partial edit operations:', operations.length)
        const { result: editedXml, errors } = applyDiagramOperations(currentCode, operations)
        if (errors.length > 0) {
          console.warn('[singlePhaseGeneration] Operation errors:', errors)
        }
        return editedXml
      }

      // Otherwise return the full code
      return extractCode(response, engineType)
    } else {
      const response = await aiService.chat(messages)

      // Parse response for operations
      const { operations } = parseResponse(response)

      // If drawio returned operations, apply them
      if (engineType === 'drawio' && operations && operations.length > 0) {
        console.log('[singlePhaseGeneration] Applying partial edit operations:', operations.length)
        const { result: editedXml, errors } = applyDiagramOperations(currentCode, operations)
        if (errors.length > 0) {
          console.warn('[singlePhaseGeneration] Operation errors:', errors)
        }
        return editedXml
      }

      return extractCode(response, engineType)
    }
  }

  /**
   * Attempt to auto-fix Mermaid code errors by asking AI to fix them
   */
  const attemptMermaidAutoFix = async (
    failedCode: string,
    errorMessage: string,
    systemPrompt: string,
    assistantMsgId: string
  ): Promise<string> => {
    let currentCode = failedCode
    let currentError = errorMessage
    let attempts = 0

    while (attempts < MAX_MERMAID_FIX_ATTEMPTS) {
      attempts++

      updateMessage(assistantMsgId, {
        content: `修复报错 (尝试 ${attempts}/${MAX_MERMAID_FIX_ATTEMPTS})...\n错误: ${currentError}`,
        status: 'streaming',
      })

      const fixPrompt = `请修复下面 Mermaid 代码中的错误，只返回修复后的代码。
      报错："""${currentError}"""
      当前代码："""${currentCode}"""`

      const messages: PayloadMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: fixPrompt },
      ]

      setMessages(messages)

      let fixedCode: string
      if (USE_STREAMING) {
        const response = await aiService.streamChat(
          messages,
          (_chunk, accumulated) => {
            updateMessage(assistantMsgId, {
              content: `修复报错 (尝试 ${attempts}/${MAX_MERMAID_FIX_ATTEMPTS})...\n\n${accumulated}`,
            })
          }
        )
        fixedCode = extractCode(response, 'mermaid')
      } else {
        const response = await aiService.chat(messages)
        fixedCode = extractCode(response, 'mermaid')
      }

      // Validate the fixed code
      const validation = await validateContent(fixedCode, 'mermaid')
      if (validation.valid) {
        return fixedCode
      }

      // Update for next iteration
      currentCode = fixedCode
      currentError = validation.error || 'Unknown error'
    }

    // Return the last attempted code (will be validated again in caller)
    return currentCode
  }

  return { generate, retryLast }
}
