# 语言切换功能使用指南

## 完成的修改

### 1. 语言切换器位置 ✅
- **位置**: 首页右上角（AppHeader组件）
- **存储**: 仅保存在浏览器本地（localStorage）
- **不再**: 后台管理设置中已移除语言设置

### 2. 修改的文件

#### `src/components/layout/AppHeader.tsx`
- 添加了语言切换下拉菜单
- 使用 `Languages` 图标
- 显示当前选择的语言（简体中文 / English）
- 点击可在中英文间切换

#### `src/stores/systemStore.ts`
- `language` 状态从 localStorage 读取和保存
- 默认值: 'zh'（简体中文）
- 支持的语言: 'zh' | 'en'

#### `src/pages/AdminPage.tsx`
- 已移除 BasicSettings 中的语言设置
- 语言设置不再保存到服务器

## 使用方法

### 用户如何切换语言

1. 打开首页
2. 在右上角找到语言按钮（显示当前语言，如"简体中文"）
3. 点击语言按钮打开下拉菜单
4. 选择想要的语言：
   - 简体中文
   - English
5. 语言立即切换并保存在浏览器中

### 开发者如何在页面中使用翻译

```typescript
import { useTranslation } from '@/hooks/useTranslation'

function MyComponent() {
  const { t } = useTranslation()

  return (
    <div>
      <h1>{t('home.title')}</h1>
      <Button>{t('common.save')}</Button>
      <p>{t('home.subtitle')}</p>
    </div>
  )
}
```

### 日期格式化

```typescript
import { useFormatDate } from '@/hooks/useTranslation'

function MyComponent() {
  const { formatDate } = useFormatDate()

  return (
    <div>
      {/* 中文: 2024年01月27日 */}
      {/* 英文: January 27, 2024 */}
      <span>{formatDate(new Date(), 'long')}</span>

      {/* 中文: 2024年01月27日 10:30:45 */}
      {/* 英文: January 27, 2024 10:30:45 AM */}
      <span>{formatDate(new Date(), 'datetime')}</span>
    </div>
  )
}
```

## 已适配的页面

以下页面的日期格式化已支持多语言：

- ✅ `AdminUsageStatsPage` - 使用统计（对话记录和文件创建记录）
- ✅ `AdminUserManagement` - 用户管理（注册时间、访问时间）

## 问题排查

### 切换语言后页面没有变化？

**原因**: 页面的文本还是硬编码的中文，没有使用翻译系统。

**解决方案**:
1. 在组件中导入 `useTranslation` Hook
2. 使用 `t()` 函数替换硬编码文本
3. 确保翻译键在 `src/lib/i18n/zh.ts` 和 `src/lib/i18n/en.ts` 中都有定义

示例：
```typescript
// 修改前
<Button>保存</Button>

// 修改后
import { useTranslation } from '@/hooks/useTranslation'

function MyComponent() {
  const { t } = useTranslation()
  return <Button>{t('common.save')}</Button>
}
```

### 某些页面已支持翻译

由于时间关系，当前只是搭建了翻译框架，大部分页面还需要逐步迁移。

**已添加翻译的内容**:
- 通用文本（保存、取消、删除等）
- 导航菜单
- 首页
- 认证相关
- 项目管理
- 编辑器
- 后台管理
- 通知消息
- 日期格式
- 表单验证
- 错误页面

所有翻译键约150个，覆盖主要功能模块。

## 技术细节

### 语言存储
- **位置**: `localStorage.getItem('language')`
- **键名**: `'language'`
- **值**: `'zh'` 或 `'en'`
- **默认值**: `'zh'`

### 状态管理
- 使用 Zustand 的 `useSystemStore`
- `language` 状态自动从 localStorage 加载
- 切换语言时自动保存到 localStorage

### 翻译文件
- 中文: `src/lib/i18n/zh.ts`
- 英文: `src/lib/i18n/en.ts`
- 类型定义: `src/lib/i18n/index.ts`

## 下一步

1. **逐步迁移页面**: 按优先级迁移各个页面使用翻译系统
2. **添加更多翻译**: 根据新功能添加对应的中英文翻译
3. **测试**: 确保所有已迁移页面在两种语言下都能正常工作

## 注意事项

- 语言切换是全局的，会影响所有已适配的组件
- 新开发的功能应该直接使用翻译系统，而不是硬编码文本
- 添加新翻译时，务必同时更新 `zh.ts` 和 `en.ts` 两个文件
- 日期格式会根据语言自动调整（中文: 2024年01月27日，英文: January 27, 2024）

