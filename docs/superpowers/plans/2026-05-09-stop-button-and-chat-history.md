# 停止按钮 & 聊天历史持久化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在编辑页 AI 对话面板加入"停止"按钮，并把每个项目的聊天历史持久化到 IndexedDB，重新进入项目时自动加载。

**Architecture:**
1. AbortController 通过 chatStore 注入 useAIGenerate，并透传到 aiService.streamChat 的 fetch；UI 在 isStreaming 时把 Send 按钮换成 Stop 按钮。
2. 在 IndexedDB 增加 `chatMessages` 表（projectId 索引），新建 ChatRepository。useAIGenerate 在消息终态时持久化，EditorPage 在加载项目时回填到 chatStore。

**Tech Stack:** React 19、Zustand、Dexie.js（IndexedDB）、Lucide Icons、Vite。无测试框架，采用浏览器手动验证。

**Spec:** [`docs/superpowers/specs/2026-05-09-stop-button-and-chat-history-design.md`](../specs/2026-05-09-stop-button-and-chat-history-design.md)

**前置说明（验证）：**
- 启动开发服务器：`pnpm run dev`，访问 `http://localhost:8787`
- 项目无单元测试框架，每个 Task 末尾的"验证"使用浏览器手动测试 + DevTools 检查 IndexedDB
- 打开 DevTools → Application → IndexedDB → `AiDrawDatabase` 可以查看表结构和数据

---

## File Structure

| 文件 | 类型 | 责任 |
|---|---|---|
| `src/types/index.ts` | 改 | `ChatMessage.status` 加 `'aborted'`；导出 `StoredChatMessage` |
| `src/services/db.ts` | 改 | Dexie schema v2，加 `chatMessages` 表 |
| `src/services/chatRepository.ts` | 新建 | 聊天消息 CRUD |
| `src/services/projectRepository.ts` | 改 | `delete()` 事务追加清理 chatMessages |
| `src/services/aiService.ts` | 改 | `streamChat` / `chat` 接受 `signal` 参数 |
| `src/stores/chatStore.ts` | 改 | 加 `setMessages` / `abortController` / `setAbortController` / `abort` |
| `src/hooks/useAIGenerate.ts` | 改 | 注入 AbortController；持久化消息；处理 AbortError 分支 |
| `src/features/chat/ChatPanel.tsx` | 改 | 流式中显示 Stop 按钮；"新建会话"加确认 + 清库；`'aborted'` 状态显示 |
| `src/pages/EditorPage.tsx` | 改 | 加载项目后加载该项目聊天历史 |

---

## Task 1: 扩展 ChatMessage 类型

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: 修改 ChatMessage.status，新增 StoredChatMessage 类型**

打开 `src/types/index.ts`，找到 `ChatMessage` 接口（第 56-72 行附近）。

把 `status` 字面量类型从：
```ts
status: 'pending' | 'streaming' | 'complete' | 'error'
```
改为：
```ts
status: 'pending' | 'streaming' | 'complete' | 'error' | 'aborted'
```

在 `ChatMessage` 接口定义之后，新增：
```ts
// Persisted chat message (with project association for IndexedDB)
export interface StoredChatMessage extends ChatMessage {
  projectId: string
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `pnpm run build`
Expected: 编译通过；如果出现 "Type ... is not assignable to type ..." 在引用 `status` 的位置报错，记录文件，下一个 task 再处理。本步骤通过即可。

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(types): add aborted status and StoredChatMessage"
```

---

## Task 2: Dexie schema v2 — 加 chatMessages 表

**Files:**
- Modify: `src/services/db.ts`

- [ ] **Step 1: 修改 db.ts 增加 chatMessages 表**

把 `src/services/db.ts` 完整替换为：

```ts
import Dexie, {type EntityTable} from 'dexie';
import type {Group, Project, StoredChatMessage, VersionHistory} from '@/types';

interface Config {
  key: string;
  value: any;
}

const db = new Dexie('AiDrawDatabase') as Dexie & {
  projects: EntityTable<Project, 'id'>;
  groups: EntityTable<Group, 'id'>;
  versions: EntityTable<VersionHistory, 'id'>;
  configs: EntityTable<Config, 'key'>;
  chatMessages: EntityTable<StoredChatMessage, 'id'>;
};

db.version(1).stores({
  projects: 'id, title, engineType, groupId, createdAt, updatedAt',
  groups: 'id, name, createdAt, updatedAt',
  versions: 'id, projectId, timestamp',
  configs: 'key'
});

db.version(2).stores({
  projects: 'id, title, engineType, groupId, createdAt, updatedAt',
  groups: 'id, name, createdAt, updatedAt',
  versions: 'id, projectId, timestamp',
  configs: 'key',
  chatMessages: 'id, projectId, timestamp, [projectId+timestamp]'
});

export { db };
```

注意：v1 的定义保留不动（Dexie 升级要求），v2 是叠加新表。

- [ ] **Step 2: 验证浏览器中数据库升级成功**

启动 `pnpm run dev`，访问 `http://localhost:8787`，进入任意项目（确保浏览器之前已经创建过该项目，触发 db 打开）。

打开 DevTools → Application → IndexedDB → `AiDrawDatabase`：
- 应看到 `projects`、`groups`、`versions`、`configs`、`chatMessages` 五张表
- `chatMessages` 表为空

如果看到错误 "VersionError" 或类似 schema 升级失败：检查 v1 定义是否被改动。

- [ ] **Step 3: Commit**

```bash
git add src/services/db.ts
git commit -m "feat(db): add chatMessages table in schema v2"
```

---

## Task 3: 创建 ChatRepository

**Files:**
- Create: `src/services/chatRepository.ts`

- [ ] **Step 1: 创建 chatRepository.ts**

写入 `src/services/chatRepository.ts`：

```ts
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
    return stored.map(({projectId: _pid, ...msg}) => msg as ChatMessage)
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
```

- [ ] **Step 2: 在浏览器 DevTools Console 中手动验证**

启动 `pnpm run dev`，进入任意项目页面后打开 DevTools → Console：

```js
const {ChatRepository} = await import('/src/services/chatRepository.ts')
const testMsg = {
  id: 'test-1',
  role: 'user',
  content: 'hello',
  timestamp: new Date(),
  status: 'complete',
}
await ChatRepository.upsert('test-project', testMsg)
const got = await ChatRepository.getByProjectId('test-project')
console.log('got:', got)  // 应该看到 [{id: 'test-1', role: 'user', ...}]，且不含 projectId 字段
await ChatRepository.deleteByProjectId('test-project')
const after = await ChatRepository.getByProjectId('test-project')
console.log('after delete:', after)  // 应该是 []
```

Expected: 三步打印分别得到正确数据、`got` 没有 `projectId` 字段、`after delete` 是空数组。

- [ ] **Step 3: Commit**

```bash
git add src/services/chatRepository.ts
git commit -m "feat(chat): add ChatRepository for per-project history"
```

---

## Task 4: ProjectRepository.delete 级联清理 chatMessages

**Files:**
- Modify: `src/services/projectRepository.ts:197-214`

- [ ] **Step 1: 在 delete 事务中追加 chatMessages 清理**

打开 `src/services/projectRepository.ts`，找到第 197 行附近的 `delete` 方法。当前实现：

```ts
async delete(id: string): Promise<void> {
  const mode = useStorageModeStore.getState().mode

  if (mode === 'local') {
    await db.transaction('rw', db.projects, db.versions, async () => {
      await db.projects.delete(id)
      await db.versions.where('projectId').equals(id).delete()
    })
    return
  }
  // ...云端分支保持不变
}
```

修改为（事务参数和事务体都要改）：

```ts
async delete(id: string): Promise<void> {
  const mode = useStorageModeStore.getState().mode

  if (mode === 'local') {
    await db.transaction('rw', db.projects, db.versions, db.chatMessages, async () => {
      await db.projects.delete(id)
      await db.versions.where('projectId').equals(id).delete()
      await db.chatMessages.where('projectId').equals(id).delete()
    })
    return
  }
  // ...云端分支保持不变
}
```

- [ ] **Step 2: 验证级联清理**

`pnpm run dev`，进入项目，与 AI 对话产生一条消息（等 Task 8 之后才会写库；如果当前还没接入持久化，本步骤可在 Task 10 完成后回头补做，先标记为 TODO 并继续下一 Task）。

回到 ProjectsPage 删除该项目，进 DevTools 检查 `chatMessages` 表对应 `projectId` 的记录已被清空。

如果 Task 10 还没做，本验证步骤暂时跳过——记下"Task 4 验证待 Task 10 之后回归测试"。

- [ ] **Step 3: Commit**

```bash
git add src/services/projectRepository.ts
git commit -m "feat(project): cascade delete chat messages on project delete"
```

---

## Task 5: aiService 增加 AbortSignal 支持

**Files:**
- Modify: `src/services/aiService.ts:203-298` (chat method)
- Modify: `src/services/aiService.ts:307-438` (streamChat method)

- [ ] **Step 1: 修改 streamChat 接受 signal 参数**

打开 `src/services/aiService.ts`，找到 `streamChat` 方法（第 307 行附近）。修改签名和 fetch 调用：

```ts
async streamChat(
  messages: PayloadMessage[],
  onChunk: (chunk: string, accumulated: string) => void,
  onComplete?: (content: string) => void,
  signal?: AbortSignal,
): Promise<string> {
```

在该方法体内找到 `fetch(\`${API_BASE_URL}/chat\`, {...})`（第 330 行附近），把 `signal` 加到 fetch options：

```ts
const response = await fetch(`${API_BASE_URL}/chat`, {
  method: 'POST',
  headers: getHeaders(),
  body: JSON.stringify(request),
  signal,
})
```

在 `streamChat` 的 `catch (error)` 分支（第 426 行附近），最前面增加 AbortError 透传：

```ts
} catch (error) {
  const duration = Date.now() - startTime
  // Re-throw abort errors as-is so callers can handle them distinctly
  if (error instanceof DOMException && error.name === 'AbortError') {
    console.log(`[AI Service] Stream Request Aborted. Duration: ${duration}ms`)
    throw error
  }
  console.error(`[AI Service] Stream Request Failed. Duration: ${duration}ms`, error)
  // ... 既有错误转换逻辑保持不变
```

- [ ] **Step 2: 修改 chat 方法接受 signal 参数**

找到 `chat` 方法（第 203 行附近）。修改签名：

```ts
async chat(messages: PayloadMessage[], signal?: AbortSignal): Promise<string> {
```

在 fetch options 加 `signal`：

```ts
const response = await fetch(`${API_BASE_URL}/chat`, {
  method: 'POST',
  headers: getHeaders(),
  body: JSON.stringify(request),
  signal,
})
```

在 `chat` 的 `catch (error)` 分支（第 286 行附近）最前面增加 AbortError 透传：

```ts
} catch (error) {
  const duration = Date.now() - startTime
  if (error instanceof DOMException && error.name === 'AbortError') {
    console.log(`[AI Service] Request Aborted. Duration: ${duration}ms`)
    throw error
  }
  console.error(`[AI Service] Request Failed. Duration: ${duration}ms`, error)
  // ...既有逻辑
```

- [ ] **Step 3: 验证 TypeScript 编译**

Run: `pnpm run build`
Expected: 编译通过。`useAIGenerate.ts` 中 `streamChat` 调用因为新增可选参数不需要改动（向后兼容）。

- [ ] **Step 4: Commit**

```bash
git add src/services/aiService.ts
git commit -m "feat(ai): support AbortSignal in chat and streamChat"
```

---

## Task 6: chatStore 加 setMessages / abortController / abort

**Files:**
- Modify: `src/stores/chatStore.ts`

- [ ] **Step 1: 完整重写 chatStore.ts**

把 `src/stores/chatStore.ts` 替换为：

```ts
import {create} from 'zustand'
import {v4 as uuidv4} from 'uuid'
import type {Attachment, ChatMessage} from '@/types'

interface ChatState {
  // UI messages for display
  messages: ChatMessage[]
  // Initial prompt from Quick Start (Path A)
  initialPrompt: string | null
  // Initial attachments from Quick Start (Path A)
  initialAttachments: Attachment[] | null
  // Streaming state
  isStreaming: boolean
  // Abort controller for the in-flight AI request
  abortController: AbortController | null

  // Actions
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => string
  updateMessage: (id: string, data: Partial<ChatMessage>) => void
  clearMessages: () => void
  setMessages: (messages: ChatMessage[]) => void
  setInitialPrompt: (prompt: string | null, attachments?: Attachment[] | null) => void
  clearInitialPrompt: () => void
  setStreaming: (streaming: boolean) => void
  setAbortController: (controller: AbortController | null) => void
  abort: () => void
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  initialPrompt: null,
  initialAttachments: null,
  isStreaming: false,
  abortController: null,

  addMessage: (message) => {
    const id = uuidv4()
    const newMessage: ChatMessage = {
      ...message,
      id,
      timestamp: new Date(),
    }
    set((state) => ({
      messages: [...state.messages, newMessage],
    }))
    return id
  },

  updateMessage: (id, data) => {
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === id ? {...msg, ...data} : msg
      ),
    }))
  },

  clearMessages: () => set({messages: []}),

  setMessages: (messages) => set({messages}),

  setInitialPrompt: (prompt, attachments) =>
    set({initialPrompt: prompt, initialAttachments: attachments ?? null}),

  clearInitialPrompt: () =>
    set({initialPrompt: null, initialAttachments: null}),

  setStreaming: (streaming) => set({isStreaming: streaming}),

  setAbortController: (controller) => set({abortController: controller}),

  abort: () => {
    const controller = get().abortController
    if (controller) {
      controller.abort()
      set({abortController: null})
    }
  },
}))
```

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `pnpm run build`
Expected: 编译通过。`ChatPanel.tsx` 既有的 `clearMessages` / `addMessage` / `updateMessage` 调用不受影响。

- [ ] **Step 3: Commit**

```bash
git add src/stores/chatStore.ts
git commit -m "feat(chat-store): add setMessages, abortController and abort actions"
```

---

## Task 7: useAIGenerate 注入 AbortController + 处理 AbortError

**Files:**
- Modify: `src/hooks/useAIGenerate.ts`

- [ ] **Step 1: 在 generate 入口创建 controller 并注入 store**

打开 `src/hooks/useAIGenerate.ts`，找到 `generate` 函数（第 114 行附近）。

在解构 chatStore 的位置（第 88-93 行）增加 `setAbortController`：

```ts
const {
  addMessage,
  updateMessage,
  setStreaming,
  setAbortController,
} = useChatStore()
```

在 `generate` 函数体内，找到 `setStreaming(true)` 一行（第 139 行附近）。在它之前插入：

```ts
// Snapshot canvas content before generation, used to detect early abort
const preGenContent = useEditorStore.getState().currentContent

// Create abort controller for this request
const controller = new AbortController()
setAbortController(controller)
```

- [ ] **Step 2: 把 signal 透传给 streamChat 调用**

`generate` 函数会调用 `singlePhaseInitialGeneration` 或 `singlePhaseGeneration`。这两个函数内部调用 `aiService.streamChat`。需要把 signal 传进去。

修改 `singlePhaseInitialGeneration` 签名（第 755-763 行附近），增加 `signal?` 参数：

```ts
const singlePhaseInitialGeneration = async (
  userInput: string,
  engineType: EngineType,
  systemPrompt: string,
  assistantMsgId: string,
  attachments?: Attachment[],
  metrics?: any,
  debouncedUpdate?: (code: string) => void,
  signal?: AbortSignal,
): Promise<string> => {
```

在 `singlePhaseInitialGeneration` 内部 `aiService.streamChat(messages, ...)` 调用（第 780 行附近），把 signal 加进去：

```ts
const response = await aiService.streamChat(
  messages,
  (_chunk, accumulated) => { /* 原内容不变 */ },
  undefined,
  signal,
)
```

非流式分支也加：
```ts
const response = await aiService.chat(messages, signal)
```

对 `singlePhaseGeneration`（第 815-823 行附近）做同样改造，签名增加 `signal?: AbortSignal`，并把 signal 透传给 `aiService.streamChat` 和 `aiService.chat`。

`twoPhaseGeneration` 当前不会被调用（`useTwoPhase = false`，第 226 行写死），不需要改。

回到 `generate` 函数体，把 signal 传到调用：

```ts
finalCode = await singlePhaseInitialGeneration(
  userInput,
  engineType,
  systemPrompt,
  assistantMsgId,
  attachments,
  metrics,
  throttledUpdate,
  controller.signal,
)
```

```ts
finalCode = await singlePhaseGeneration(
  userInput,
  currentContent,
  engineType,
  systemPrompt,
  assistantMsgId,
  attachments,
  metrics,
  throttledUpdate,
  controller.signal,
)
```

- [ ] **Step 3: 在 generate 的 catch 分支处理 AbortError**

找到 `generate` 函数的 `catch (error)` 块（第 400 行附近）。当前实现：

```ts
} catch (error) {
  console.error('AI generation failed:', error)
  updateMessage(assistantMsgId, {
    content: `Error: ${error instanceof Error ? error.message : 'Generation failed'}`,
    status: 'error',
  })
  showError(error instanceof Error ? error.message : 'Generation failed')
}
```

替换为：

```ts
} catch (error) {
  const isAbort = error instanceof DOMException && error.name === 'AbortError'

  if (isAbort) {
    // User-initiated stop: keep canvas, save snapshot if it changed
    throttledUpdate.cancel()
    const finalContent = useEditorStore.getState().currentContent
    if (currentProject && finalContent && finalContent !== preGenContent) {
      try {
        await VersionRepository.create({
          projectId: currentProject.id,
          content: finalContent,
          changeSummary: 'AI 生成（用户中断）',
        })
        setContentFromVersion(finalContent)
      } catch (versionErr) {
        console.error('Failed to save aborted version:', versionErr)
      }
    }
    updateMessage(assistantMsgId, {status: 'aborted'})
  } else {
    console.error('AI generation failed:', error)
    updateMessage(assistantMsgId, {
      content: `Error: ${error instanceof Error ? error.message : 'Generation failed'}`,
      status: 'error',
    })
    showError(error instanceof Error ? error.message : 'Generation failed')
  }
}
```

- [ ] **Step 4: 在 finally 中清理 abortController**

找到 `generate` 的 `finally` 块（第 407-413 行附近）。当前实现：

```ts
} finally {
  throttledUpdate.cancel()
  setStreaming(false)
  setLoading(false)
}
```

改为：

```ts
} finally {
  throttledUpdate.cancel()
  setAbortController(null)
  setStreaming(false)
  setLoading(false)
}
```

- [ ] **Step 5: 对 retryLast 做同样改造**

找到 `retryLast` 函数（第 419 行附近）。

5a. 在 `setStreaming(true)` 之前插入：
```ts
const preGenContent = useEditorStore.getState().currentContent
const controller = new AbortController()
setAbortController(controller)
```

5b. 找到 `retryLast` 内的 `aiService.streamChat` 调用（第 508-540 行附近），signal 传进去：
```ts
response = await aiService.streamChat(
  payloadMessages,
  (_chunk, accumulated) => { /* 原内容不变 */ },
  undefined,
  controller.signal,
)
```

非流式分支：`response = await aiService.chat(payloadMessages, controller.signal)`

5c. 替换 retryLast 的 `catch (error)` 块（第 657-663 行附近）为：

```ts
} catch (error) {
  const isAbort = error instanceof DOMException && error.name === 'AbortError'

  if (isAbort) {
    throttledUpdate.cancel()
    const finalContent = useEditorStore.getState().currentContent
    if (currentProject && finalContent && finalContent !== preGenContent) {
      try {
        await VersionRepository.create({
          projectId: currentProject.id,
          content: finalContent,
          changeSummary: 'AI 生成（用户中断）',
        })
        setContentFromVersion(finalContent)
      } catch (versionErr) {
        console.error('Failed to save aborted version:', versionErr)
      }
    }
    updateMessage(assistantMsgId, {status: 'aborted'})
  } else {
    console.error('AI retry failed:', error)
    updateMessage(assistantMsgId, {
      content: `Error: ${error instanceof Error ? error.message : 'Retry failed'}`,
      status: 'error',
    })
    showError(error instanceof Error ? error.message : 'Retry failed')
  }
}
```

5d. 在 retryLast 的 `finally` 块（第 664-667 行附近）增加 `setAbortController(null)`：

```ts
} finally {
  setAbortController(null)
  setStreaming(false)
  setLoading(false)
}
```

- [ ] **Step 6: 验证 TypeScript 编译**

Run: `pnpm run build`
Expected: 编译通过。

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useAIGenerate.ts
git commit -m "feat(ai): wire AbortController into generate and retryLast"
```

---

## Task 8: ChatPanel — 流式中显示停止按钮 + aborted 状态显示

**Files:**
- Modify: `src/features/chat/ChatPanel.tsx`

- [ ] **Step 1: 引入 Square 图标 + abort action**

`src/features/chat/ChatPanel.tsx` 顶部 import 块：把 `Square` 加入 `lucide-react` 引入（第 2-17 行附近）：

```tsx
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
```

第 53 行附近从 `useChatStore` 解构里增加 `abort`：

```tsx
const {messages, isStreaming, initialPrompt, initialAttachments, clearInitialPrompt, clearMessages, abort} = useChatStore()
```

- [ ] **Step 2: getStatusDisplay 增加 aborted 分支**

找到 `getStatusDisplay`（第 276-289 行附近）。在 `case 'error'` 之后增加：

```tsx
case 'aborted':
  return {text: '已停止', icon: <Square className="h-4 w-4 text-muted" />}
```

- [ ] **Step 3: 把 Send 按钮改成在流式时切换为 Stop**

找到底部输入区的 Send 按钮（第 623-630 行附近）。当前实现：

```tsx
<Button
  onClick={() => handleSend()}
  disabled={(!inputValue.trim() && attachments.length === 0) || isStreaming}
  size="sm"
  className="h-8"
>
  <Send className="h-4 w-4 mr-1" />
</Button>
```

替换为：

```tsx
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
```

如果 `<Button variant="destructive">` 在项目 ui Button 组件里没定义，回退到 `variant="default"` 并加 `className="h-8 bg-red-500 hover:bg-red-600 text-white"`。打开 `src/components/ui/Button.tsx` 确认 variant 列表。

- [ ] **Step 4: 浏览器验证 — 停止按钮**

`pnpm run dev`，进入项目，发送一个复杂提示（例如"画一个 50 个节点的复杂流程图"）让 AI 流式生成。

观察：
- 流式过程中右下角按钮变成红色方块（停止图标）
- 点击后请求立即终止，不弹错误 toast
- 助手消息状态显示"已停止"，图标为灰色方块
- 如果画布已经有部分内容，保留；DevTools → IndexedDB → versions 表看到一条新版本，`changeSummary` 为 "AI 生成（用户中断）"
- 早期立刻点击停止（未渲染任何内容前）：versions 表 **不应** 多出新版本

- [ ] **Step 5: Commit**

```bash
git add src/features/chat/ChatPanel.tsx
git commit -m "feat(chat-panel): add stop button during streaming and aborted state"
```

---

## Task 9: useAIGenerate 持久化消息到 ChatRepository

**Files:**
- Modify: `src/hooks/useAIGenerate.ts`

- [ ] **Step 1: 引入 ChatRepository**

`src/hooks/useAIGenerate.ts` 顶部增加 import：

```ts
import {ChatRepository} from '@/services/chatRepository'
```

- [ ] **Step 2: 在 generate 函数里增加持久化辅助**

在 `generate` 函数最开头（`if (!currentProject) return` 之后）添加一个本地辅助函数：

```ts
const persistMessage = async (msgId: string) => {
  const msg = useChatStore.getState().messages.find((m) => m.id === msgId)
  if (msg && currentProject) {
    try {
      await ChatRepository.upsert(currentProject.id, msg)
    } catch (err) {
      console.error('Failed to persist chat message:', err)
    }
  }
}
```

- [ ] **Step 3: addMessage 之后立即持久化**

找到 user 消息和 assistant placeholder 创建（第 124-137 行附近）。`chatStore.addMessage` 本来就返回 id，原代码对 user 消息没接收。改为：

```ts
const userMsgId = addMessage({
  role: 'user',
  content: userInput,
  status: 'complete',
  attachments,
})
await persistMessage(userMsgId)

const assistantMsgId = addMessage({
  role: 'assistant',
  content: '',
  status: 'streaming',
})
await persistMessage(assistantMsgId)
```

- [ ] **Step 4: 在终态写库**

在 `generate` 的成功路径（找到最后一次 `updateMessage(assistantMsgId, {...status: 'complete'...})`，第 328 行附近），其后追加：

```ts
await persistMessage(assistantMsgId)
```

在 `catch` 的 abort 分支里 `updateMessage(assistantMsgId, {status: 'aborted'})` 之后追加：
```ts
await persistMessage(assistantMsgId)
```

在 error 分支 `showError(...)` 之前（或之后皆可）追加：
```ts
await persistMessage(assistantMsgId)
```

- [ ] **Step 5: 对 retryLast 做同样持久化**

retryLast 中 assistant 消息已经在 generate 时存过了。这里只需要：

5a. retryLast 在最后成功路径 `updateMessage(assistantMsgId, {content: response, code: finalCode, status: 'complete', metrics})` 之后（第 594-599 行附近）增加：
```ts
await persistMessage(assistantMsgId)
```

5b. retryLast 的 abort 和 error 分支（与 generate 类似的位置）都加 `await persistMessage(assistantMsgId)`。

5c. 在 retryLast 函数顶部也定义同样的 `persistMessage` 辅助（或者把它提到外层 hook 作用域内复用）。推荐提到外层 — 把 Step 2 里定义的 `persistMessage` 移到 `useAIGenerate()` 函数体内、`generate` 之外，让 `generate` 和 `retryLast` 都能访问。

- [ ] **Step 6: 浏览器验证 — 持久化**

`pnpm run dev`，进入项目，与 AI 对话产生 1 条 user + 1 条 assistant 消息。

DevTools → IndexedDB → `chatMessages`：应该看到 2 条记录，`projectId` 等于当前项目 id，`role` 分别是 user 和 assistant。

中断生成产生的消息：检查 `status === 'aborted'` 的记录已写入。

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useAIGenerate.ts
git commit -m "feat(ai): persist chat messages to IndexedDB on terminal states"
```

---

## Task 10: EditorPage 加载项目时回填聊天历史

**Files:**
- Modify: `src/pages/EditorPage.tsx:95-138`

- [ ] **Step 1: 引入 ChatRepository 和 setMessages**

`src/pages/EditorPage.tsx` 顶部增加：
```ts
import {ChatRepository} from '@/services/chatRepository'
```

第 60 行附近从 `useChatStore` 解构里增加 `setMessages`：
```tsx
const {clearMessages, setMessages} = useChatStore()
```

- [ ] **Step 2: 在 loadProject 里加载历史**

找到 `loadProject` 函数（第 95 行附近）。在 normal mode 分支（第 116-131 行）末尾、`setIsLoading(false)` 之前增加历史加载。

修改 normal mode 分支为：

```ts
} else {
  const project = await ProjectRepository.getById(id)
  if (!project) {
    navigate('/projects')
    return
  }

  setProject(project)
  setEditedTitle(project.title)

  // Load latest version content
  const latestVersion = await VersionRepository.getLatest(id)
  if (latestVersion) {
    setContentFromVersion(latestVersion.content)
  }

  // Load chat history
  try {
    const history = await ChatRepository.getByProjectId(id)
    setMessages(history)
  } catch (err) {
    console.error('Failed to load chat history:', err)
  }
}
```

example mode 分支不加载历史（与 spec 一致）。

- [ ] **Step 3: 浏览器验证 — 历史加载**

`pnpm run dev`：
1. 进入项目 A，发送几条消息
2. 返回项目列表，重新进入项目 A
3. 应该看到之前的对话历史按时间顺序排列在聊天面板中
4. 进入项目 B（应当显示 B 自己的历史，不串项目）
5. 进入示例项目（example mode）：聊天面板为空，不显示历史

- [ ] **Step 4: Commit**

```bash
git add src/pages/EditorPage.tsx
git commit -m "feat(editor): load chat history on project entry"
```

---

## Task 11: "新建会话"按钮 — 加确认 + 清库

**Files:**
- Modify: `src/features/chat/ChatPanel.tsx:318-326`

- [ ] **Step 1: 引入 ChatRepository 和 currentProject**

确认 `src/features/chat/ChatPanel.tsx` 顶部已经有：
```tsx
const currentProject = useEditorStore((s) => s.currentProject)
```
（Task 8 之前就存在，第 55 行）

新增 import：
```ts
import {ChatRepository} from '@/services/chatRepository'
```

也从 chatStore 解构里加一个 `setMessages`（清 UI）和 payloadStore 清空：
```tsx
import {usePayloadStore} from '@/stores/payloadStore'
// ...
const {messages, isStreaming, initialPrompt, initialAttachments, clearInitialPrompt, clearMessages, abort} = useChatStore()
const setPayloadMessages = usePayloadStore((s) => s.setMessages)
```

- [ ] **Step 2: 替换"新建会话"按钮的 onClick**

找到 MessageSquarePlus Button（第 318-326 行附近）：

```tsx
<Button
  variant="ghost"
  size="icon"
  title={i18nTexts.chatNewConversation[language]}
  onClick={clearMessages}
  disabled={isStreaming || messages.length === 0}
>
  <MessageSquarePlus className="h-4 w-4" />
</Button>
```

替换为：

```tsx
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
```

- [ ] **Step 3: 跳过（payloadStore.setMessages 已存在）**

`src/stores/payloadStore.ts` 已实现 `setMessages: (messages) => set({ messages })`，本 Task 直接复用，不需要新增。

- [ ] **Step 4: 浏览器验证 — 新建会话**

`pnpm run dev`，进入有历史的项目：
1. 点"新建会话"图标 → 弹出 confirm
2. 取消：UI 和 IndexedDB 都不变
3. 确认：UI 清空、`chatMessages` 表中该 projectId 的所有记录被删
4. 重新进入项目：聊天面板为空（验证持久化层确实被清）

- [ ] **Step 5: Commit**

```bash
git add src/features/chat/ChatPanel.tsx
git commit -m "feat(chat-panel): confirm and clear persisted history on new session"
```

---

## Task 12: 端到端回归 + Task 4 级联清理验证

**Files:** (无代码改动)

- [ ] **Step 1: 端到端流程**

`pnpm run dev`，按以下顺序操作并观察：

1. 创建新项目 A（drawio 引擎），发送提示生成图。等待完成。
2. 修改：发送修改提示，生成中**点停止按钮**。验证：画布保留、`chatMessages` 多了对应记录、`versions` 多一条 "AI 生成（用户中断）"。
3. 离开 A 进项目列表，重新进入 A。验证：聊天历史恢复。
4. 在 A 中点"新建会话" → 确认。验证：UI 清空、`chatMessages` 中 A 的记录全部删除。
5. 在项目列表删除 A。验证：`chatMessages`、`versions`、`projects` 表中关于 A 的记录都不在了（这是 Task 4 的级联清理验证）。

- [ ] **Step 2: 多引擎冒烟**

分别用 mermaid、excalidraw 引擎重复 Step 1 的 1-3 项，确保所有引擎下停止按钮和历史都正常。

- [ ] **Step 3: TypeScript 编译 + Lint**

```bash
pnpm run build
pnpm run lint
```

Expected: 都通过。

- [ ] **Step 4: 最终 commit（如果端到端发现遗漏需修复）**

如果回归发现问题，修复后单独 commit；否则本 Task 不产生 commit。

---

## Self-Review 完成清单

- 文件路径全部使用绝对/项目根路径，db 文件锁定在 `src/services/db.ts`（已 self-review 修正）
- 每个 Task 的 commit 都是独立可运行的：Task 1 改类型，下游 Task 6/8 用到才会真正生效；Task 2 升库，Task 3 起依赖。顺序保证可逐步通过编译。
- 中断分支与正常分支共用 finally 清理 `setAbortController(null)` 和 throttledUpdate.cancel
- 早期中断（无内容变化）跳过空版本落盘 — 在 Task 7 Step 3 用 `finalContent !== preGenContent` 守卫
- example 模式不加载/不持久化历史 — Task 10 显式说明
- 项目删除级联 chatMessages — Task 4 在事务里追加；验证留到 Task 12
