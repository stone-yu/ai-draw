# 多语言支持实现说明

## 已完成的工作

### 1. 基础架构 ✅

#### 创建 i18n 配置和翻译文件
- **文件**: `src/lib/i18n/config.ts` - i18n 配置
- **文件**: `src/lib/i18n/zh.ts` - 简体中文翻译（约150个翻译键）
- **文件**: `src/lib/i18n/en.ts` - 英文翻译（约150个翻译键）
- **文件**: `src/lib/i18n/index.ts` - 模块导出

**翻译覆盖的模块**:
- `common` - 通用文本（确认、取消、保存、删除等）
- `nav` - 导航菜单
- `home` - 首页
- `auth` - 认证相关
- `project` - 项目管理
- `editor` - 编辑器
- `admin` - 后台管理
- `engine` - 绘图引擎
- `notification` - 通知消息
- `date` - 日期格式
- `validation` - 表单验证
- `error` - 错误页面

### 2. 状态管理 ✅

#### 更新 systemStore
- **文件**: `src/stores/systemStore.ts`
- **修改内容**:
  - 添加 `language: Locale` 状态
  - 添加 `setLanguage` 方法
  - 从 localStorage 读取和保存语言设置
  - 支持从环境变量 `_ENV_.LANGUAGE` 读取默认语言

### 3. Hooks ✅

#### useTranslation Hook
- **文件**: `src/hooks/useTranslation.ts`
- **功能**:
  - `t(path, params?)` - 翻译函数，支持嵌套键和参数替换
  - `language` - 当前语言
  - `translations` - 完整翻译对象

#### useFormatDate Hook
- **文件**: `src/hooks/useTranslation.ts`
- **功能**:
  - `formatDate(date, format)` - 根据当前语言格式化日期
  - 支持 'short', 'long', 'datetime' 三种格式

### 4. 后台管理设置 ✅

#### 语言设置选项
- **文件**: `src/pages/AdminPage.tsx` - BasicSettings 组件
- **修改内容**:
  - 添加 `language` 状态
  - 添加语言选择下拉菜单（简体中文/English）
  - 在 `loadSettings` 中加载语言设置
  - 在 `handleSave` 中保存语言设置到后端和全局状态

## 使用示例

### 基础使用

```typescript
import { useTranslation } from '@/hooks/useTranslation'

function MyComponent() {
  const { t } = useTranslation()

  return (
    <div>
      <Button>{t('common.save')}</Button>
      <Button>{t('common.cancel')}</Button>
      <h1>{t('admin.title')}</h1>
    </div>
  )
}
```

### 带参数的翻译

```typescript
const { t } = useTranslation()

// 中文: "共 10 条"
// 英文: "Total 10 records"
const text = t('admin.totalRecords', { count: '10' })
```

### 日期格式化

```typescript
import { useFormatDate } from '@/hooks/useTranslation'

function MyComponent() {
  const { formatDate } = useFormatDate()
  const date = new Date()

  return (
    <div>
      {/* 中文: 2024年01月27日 */}
      {/* 英文: January 27, 2024 */}
      {formatDate(date, 'long')}
    </div>
  )
}
```

## 待完成的工作

### 1. 更新现有组件使用翻译 ⏳

由于项目有大量的硬编码中文文本，建议采用渐进式迁移策略：

#### 优先级1 - 关键页面
- [ ] `src/pages/HomePage.tsx` - 首页
- [ ] `src/pages/LoginPage.tsx` - 登录页
- [ ] `src/pages/RegisterPage.tsx` - 注册页
- [ ] `src/components/layout/AppSidebar.tsx` - 侧边栏导航
- [ ] `src/components/layout/AppHeader.tsx` - 顶部导航

#### 优先级2 - 管理页面
- [ ] `src/pages/AdminPage.tsx` - 后台管理（部分已完成）
- [ ] `src/pages/AdminUsageStatsPage.tsx` - 使用统计
- [ ] `src/pages/AdminUserManagement.tsx` - 用户管理

#### 优先级3 - 编辑器和其他
- [ ] `src/pages/EditorPage.tsx` - 编辑器页面
- [ ] `src/pages/ProjectsPage.tsx` - 项目管理
- [ ] `src/features/chat/ChatPanel.tsx` - 对话面板
- [ ] 其他组件

### 2. 更新日期格式化 ⏳

需要全局搜索并替换以下模式：

```typescript
// 查找: toLocaleDateString('zh-CN'
// 查找: toLocaleString('zh-CN'
// 查找: new Date().toLocaleDateString
```

替换为使用 `useFormatDate` Hook

### 3. 后端API支持 ⏳

需要确保后端API支持保存和读取 `language` 字段：

```javascript
// server/index.js
// 确保 system_settings 表包含 language 字段
// 确保 getSystemSettings 返回 language
// 确保 updateSystemSettings 保存 language
```

## 迁移指南

### 步骤1: 导入 Hook

```typescript
import { useTranslation } from '@/hooks/useTranslation'
```

### 步骤2: 在组件中使用

```typescript
function MyComponent() {
  const { t } = useTranslation()

  // 将硬编码文本替换为翻译键
  // 修改前: <button>保存</button>
  // 修改后: <button>{t('common.save')}</button>
}
```

### 步骤3: 检查翻译键是否存在

在 `src/lib/i18n/zh.ts` 和 `src/lib/i18n/en.ts` 中查找或添加对应的翻译键。

### 步骤4: 测试

1. 在后台管理切换语言
2. 刷新页面验证语言是否持久化
3. 检查所有文本是否正确翻译

## 注意事项

1. **不要一次性修改所有文件** - 采用渐进式迁移
2. **保持中英文翻译同步** - 添加中文翻译时同时添加英文
3. **测试覆盖** - 每次修改后测试中英文两种语言
4. **参数化动态内容** - 使用 `{param}` 占位符
5. **日期格式** - 统一使用 `useFormatDate` Hook

## 技术细节

### 翻译文件结构

```typescript
export const zh = {
  common: { ... },      // 通用文本
  nav: { ... },         // 导航
  home: { ... },        // 首页
  auth: { ... },        // 认证
  // ... 更多模块
}
```

### 类型安全

- 英文翻译类型基于中文翻译: `en: Translation = { ... }`
- TypeScript 会自动检查结构一致性
- 翻译键不存在时会有编译警告

### 性能优化

- 使用 `useMemo` 缓存翻译对象
- 只在语言切换时重新计算
- 翻译文件在构建时静态导入

## 当前状态

✅ **基础架构完成** - 可以立即在新组件中使用
⏳ **现有组件迁移** - 需要逐步进行
⏳ **后端API支持** - 需要验证和完善

## 下一步建议

1. 从关键页面开始迁移（登录、注册、首页）
2. 更新后端API确保language字段的保存和读取
3. 编写单元测试验证翻译功能
4. 更新用户文档说明如何切换语言

