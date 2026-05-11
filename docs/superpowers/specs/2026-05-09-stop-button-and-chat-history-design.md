# 停止按钮 & 聊天历史持久化 — 设计

## 背景

图形编辑页（`EditorPage`）的 AI 对话面板存在两个体验问题：

1. AI 流式生成过程中没有停止按钮。一旦发起请求，用户无法中途取消，只能等结果或刷新页面。
2. 聊天消息只存在于 Zustand 的内存 store（`chatStore`），并且 `EditorPage.loadProject` 会调用 `clearMessages()`。每次重新进入项目都是空白会话，看不到之前和 AI 的对话。

本设计同时解决这两个问题。

## 范围

### In scope

- 编辑页 AI 对话的"停止"能力（前端中断 + 保留画布最后一帧 + 落盘版本 + 消息状态标记）。
- 每个项目的聊天历史持久化到 IndexedDB，进入项目时自动加载全部历史。
- "新建会话"按钮变为：清空当前项目的持久化历史 + UI。
- 项目删除时级联清理该项目的聊天历史。

### Out of scope（明确不做）

- **聊天历史不参与 AI 上下文**：发给后端的 payload 仍是 `payloadStore` 里的 system + 当前编辑请求，不把历史消息塞进去。token 成本不变。
- **多会话支持**：每个项目仍只有一条线性的聊天记录，不引入"会话切换"。
- **云同步**：聊天历史只存本地 IndexedDB，与现有 `versionHistory` 表的存储策略一致。`storageMode === 'cloud'` 时也走本地存储，不上传服务端。
- **历史清理策略**：不引入按时间/容量自动清理。带图片附件的消息可能占空间，由用户主动通过"新建会话"清理。

## 设计

### Feature 1: 停止按钮

#### UI

- `ChatPanel` 输入区右下角的发送按钮：当 `isStreaming === false` 显示 `Send` 图标（保持现状），当 `isStreaming === true` 切换为停止按钮（`Square` 图标，`lucide-react`）。
- 点击停止按钮 → 调用 `chatStore.abort()`。

#### 中断后的行为

| 项 | 处理 |
|---|---|
| 已流式渲染到画布的内容 | 保留为最终内容（不回滚）|
| `editorStore.currentContent` | 取当前值作为最终结果 |
| 版本历史 | 仅当 `currentContent` 与"本次生成开始前的快照"不同才创建新版本，`changeSummary: 'AI 生成（用户中断）'`。早期点击停止（画布尚未发生变化）则不落盘空版本。 |
| 当前助手消息状态 | 设为 `'aborted'` |
| 错误 toast | 不弹（中断是用户主动行为，不是错误） |
| `payloadStore` | 已经写入了本次请求的 user/system，保留不动（与正常完成流程一致）|

#### 实现

**`aiService.streamChat` / `aiService.chat`**：增加可选 `signal?: AbortSignal` 参数：

```ts
async streamChat(
  messages: PayloadMessage[],
  onChunk: (chunk: string, accumulated: string) => void,
  onComplete?: (content: string) => void,
  signal?: AbortSignal,
): Promise<string>
```

将 `signal` 透传给内部 `fetch(...)`。`fetch` 抛出的 `AbortError` 直接向上抛出，不做友好转义（保留 `error.name === 'AbortError'` 让上层识别）。

**`chatStore`** 增加：

```ts
abortController: AbortController | null
setAbortController: (c: AbortController | null) => void
abort: () => void   // 调用 abortController?.abort() 并清空
```

**`useAIGenerate.generate` / `retryLast`**：

```ts
const controller = new AbortController()
useChatStore.getState().setAbortController(controller)
const preGenContent = useEditorStore.getState().currentContent  // 本次生成前的画布快照
try {
  // ...streamChat(messages, onChunk, undefined, controller.signal)
} catch (err) {
  const isAbort = err instanceof DOMException && err.name === 'AbortError'
  if (isAbort) {
    throttledUpdate.cancel()
    const finalContent = useEditorStore.getState().currentContent
    if (currentProject && finalContent && finalContent !== preGenContent) {
      await VersionRepository.create({
        projectId: currentProject.id,
        content: finalContent,
        changeSummary: 'AI 生成（用户中断）',
      })
      setContentFromVersion(finalContent)  // 标记为已保存
    }
    updateMessage(assistantMsgId, { status: 'aborted' })
    // 持久化最终消息（见下文 Feature 2 持久化时机）
    return  // 不走 showError
  }
  // ... 既有错误分支保持不变
} finally {
  useChatStore.getState().setAbortController(null)
  setStreaming(false)
  setLoading(false)
  throttledUpdate.cancel()
}
```

**类型扩展**：`ChatMessage.status` 增加字面量 `'aborted'`。`ChatPanel.getStatusDisplay` 增加分支：图标用 `Square` 或 `X`（灰色），文案 `已停止`。

### Feature 2: 聊天历史持久化

#### 数据模型

`src/types/index.ts` 中 `ChatMessage` 不变，新增 `StoredChatMessage = ChatMessage & { projectId: string }` 用于持久化层。

`src/services/db.ts`（注意：项目里另有一个 `src/lib/db.ts` 是遗留文件，未被任何代码引用，本次改动只动 `src/services/db.ts`）升级 Dexie schema 到版本 2：

```ts
db.version(1).stores({
  projects: 'id, title, engineType, groupId, createdAt, updatedAt',
  groups: 'id, name, createdAt, updatedAt',
  versions: 'id, projectId, timestamp',
  configs: 'key',
})

db.version(2).stores({
  projects: 'id, title, engineType, groupId, createdAt, updatedAt',
  groups: 'id, name, createdAt, updatedAt',
  versions: 'id, projectId, timestamp',
  configs: 'key',
  chatMessages: 'id, projectId, timestamp, [projectId+timestamp]',
})
```

`db` 类型签名增加 `chatMessages: EntityTable<StoredChatMessage, 'id'>`。

#### Repository

`src/services/chatRepository.ts`（新建）：

```ts
export const ChatRepository = {
  async getByProjectId(projectId: string): Promise<ChatMessage[]> {
    const stored = await db.chatMessages
      .where('[projectId+timestamp]')
      .between([projectId, Dexie.minKey], [projectId, Dexie.maxKey])
      .toArray()
    // 剥掉 projectId 字段返回 ChatMessage
  },
  async upsert(projectId: string, message: ChatMessage): Promise<void> {
    await db.chatMessages.put({ ...message, projectId })
  },
  async deleteByProjectId(projectId: string): Promise<void> {
    await db.chatMessages.where('projectId').equals(projectId).delete()
  },
}
```

#### chatStore 改动

```ts
// 新增
setMessages: (messages: ChatMessage[]) => void
// 改动：addMessage、updateMessage 内部继续操作 store；持久化由调用方（useAIGenerate / ChatPanel）负责
```

不在 store 里直接写库——store 不持有 `projectId`，让调用方在已知 project 上下文下显式持久化，避免耦合。

#### 持久化时机

在 `useAIGenerate` 中：

| 时机 | 操作 |
|---|---|
| `addMessage`（user 消息）后 | `ChatRepository.upsert(projectId, msg)` |
| `addMessage`（assistant placeholder）后 | `ChatRepository.upsert(projectId, msg)` |
| `updateMessage` 流式中间态 | **不写库**（高频，性能考虑） |
| 流式结束 / 错误 / 中断 — 最后一次 `updateMessage` 后 | `ChatRepository.upsert(projectId, finalMsg)` |

`addMessage` 当前返回 id；为拿到完整消息对象，可在 store 里再加一个 `getMessageById(id)` 工具，或直接从 `useChatStore.getState().messages.find(...)` 取。后者已足够，不新增 API。

#### 加载时机

`EditorPage.loadProject`：

```ts
// 既有
resetEditor()
clearMessages()

// 加载 project / version

// 新增：加载聊天历史
if (mode !== 'example') {
  const history = await ChatRepository.getByProjectId(id)
  useChatStore.getState().setMessages(history)
}
```

`example` 模式（演示项目）不加载历史，与现有"演示项目无版本历史"的取舍一致。

#### "新建会话"按钮

`ChatPanel` 中的 `MessageSquarePlus` 按钮 `onClick` 改为：

1. 如果 `messages.length === 0`，直接 return。
2. 弹确认（用 `window.confirm` 或现有 Dialog 组件——保持轻量，先用 `window.confirm('确认新建会话？此操作会删除当前项目的聊天历史记录。')`）。
3. 确认后：`chatRepository.deleteByProjectId(currentProject.id)` → `clearMessages()` → `payloadStore.setMessages([])`（清干净）。

#### 项目删除级联

`ProjectRepository.delete` 当前已经在事务里清理 `db.versions`。本次在该事务里追加：

```ts
await db.chatMessages.where('projectId').equals(id).delete()
```

`VersionRepository.deleteByProjectId` 已存在，本次不需要新增。

### 状态显示扩展

`ChatPanel.getStatusDisplay`：

```ts
case 'aborted':
  return { text: '已停止', icon: <Square className="h-4 w-4 text-muted" /> }
```

## 改动文件清单

| 文件 | 改动类型 | 说明 |
|---|---|---|
| `src/types/index.ts` | 改 | `ChatMessage.status` 加 `'aborted'`；导出 `StoredChatMessage` |
| `src/services/db.ts` | 改 | Dexie v2 schema 加 `chatMessages` 表 |
| `src/services/chatRepository.ts` | 新建 | CRUD |
| `src/services/projectRepository.ts` | 改 | `delete()` 事务里追加清理 chatMessages |
| `src/services/aiService.ts` | 改 | `streamChat` / `chat` 接受 `signal` |
| `src/stores/chatStore.ts` | 改 | 加 `setMessages` / `abortController` / `setAbortController` / `abort` |
| `src/hooks/useAIGenerate.ts` | 改 | 注入 AbortController；持久化消息；处理 `AbortError` 分支 |
| `src/features/chat/ChatPanel.tsx` | 改 | 流式中切换停止按钮；"新建会话"加确认 + 清库；`'aborted'` 状态显示 |
| `src/pages/EditorPage.tsx` | 改 | 加载项目后加载该项目聊天历史 |

## 关键决策与权衡

1. **中断后落盘版本而非回滚**：用户经常会中断"差不多够了"的生成，能直接拿来继续编辑比丢掉重做更符合直觉。代价是版本历史多一条，但 `versionHistory` 本来就允许人工/AI 多版本并存，不冲突。

2. **历史不进 AI 上下文**：当前 `payloadStore` 的设计就是"每次编辑都基于当前画布的全量重新提示"，已能覆盖多数编辑诉求。把历史消息塞进 payload 会让 token 涨很快，且大模型已经能从画布 XML 看出"前后状态"，多轮记忆收益有限。如果后续真有需要，可作为下一期独立特性。

3. **持久化由调用方触发，不在 store 里**：`chatStore` 不持有 `projectId`，避免双向数据绑定。`useAIGenerate` / `ChatPanel` 已经持有 `currentProject`，显式调用 repository 更直观。

4. **流式中间态不写库**：流式可能每秒几十次 `updateMessage`，每次都写 IndexedDB 会卡 UI 线程。只在终态写一次，丢失风险（页面崩溃时正在生成的消息丢失）可接受——画布内容已被 throttledUpdate 实时更新到内存 store，退出再进还能从 versionHistory 拿回最近一版。

5. **example 模式不加载历史**：演示项目是只读的共享资产，给每个用户在演示项目下保留个人聊天记录会污染示例语义。
