# 多语言支持 (i18n)

本项目已集成多语言支持，目前支持简体中文（zh）和英文（en）。

## 功能特性

- ✅ 支持简体中文和英文
- ✅ 语言设置持久化存储
- ✅ 管理员可在后台设置默认语言
- ✅ 提供 `useTranslation` Hook 便于在组件中使用
- ✅ 提供 `useFormatDate` Hook 用于日期格式化

## 目录结构

```
src/lib/i18n/
├── config.ts          # i18n 配置文件
├── zh.ts              # 简体中文翻译
├── en.ts              # 英文翻译
├── index.ts           # 导出模块
└── README.md          # 本文档
```

## 使用方法

### 1. 在组件中使用翻译

```typescript
import { useTranslation } from '@/hooks/useTranslation'

function MyComponent() {
  const { t } = useTranslation()

  return (
    <div>
      <h1>{t('common.save')}</h1>
      <p>{t('admin.title')}</p>
    </div>
  )
}
```

### 2. 带参数的翻译

```typescript
const { t } = useTranslation()

// 翻译文本: "共 {count} 条"
const text = t('admin.totalRecords', { count: '10' })
// 结果: "共 10 条"
```

### 3. 日期格式化

```typescript
import { useFormatDate } from '@/hooks/useTranslation'

function MyComponent() {
  const { formatDate } = useFormatDate()

  const date = new Date()

  return (
    <div>
      <p>{formatDate(date, 'short')}</p>     {/* 短日期格式 */}
      <p>{formatDate(date, 'long')}</p>      {/* 长日期格式 */}
      <p>{formatDate(date, 'datetime')}</p>  {/* 日期时间格式 */}
    </div>
  )
}
```

### 4. 获取当前语言

```typescript
const { language } = useTranslation()

if (language === 'zh') {
  // 中文逻辑
} else {
  // 英文逻辑
}
```

## 添加新的翻译

### 1. 在 zh.ts 中添加中文翻译

```typescript
export const zh = {
  // ... 现有翻译
  myFeature: {
    title: '我的功能',
    description: '这是描述',
  },
}
```

### 2. 在 en.ts 中添加对应的英文翻译

```typescript
export const en: Translation = {
  // ... 现有翻译
  myFeature: {
    title: 'My Feature',
    description: 'This is description',
  },
}
```

### 3. 在组件中使用

```typescript
const { t } = useTranslation()

<h1>{t('myFeature.title')}</h1>
<p>{t('myFeature.description')}</p>
```

## 切换语言

用户可以通过以下方式切换语言：

1. **管理员**: 在后台管理 -> 基础设置 -> 系统语言 中设置系统默认语言
2. **编程方式**: 使用 `useSystemStore` 的 `setLanguage` 方法

```typescript
import { useSystemStore } from '@/stores/systemStore'

const setLanguage = useSystemStore((state) => state.setLanguage)

// 切换到英文
setLanguage('en')

// 切换到中文
setLanguage('zh')
```

## 翻译键命名规范

- 使用小写字母和点号分隔，如: `common.save`, `admin.title`
- 按功能模块组织，如: `auth.*`, `project.*`, `admin.*`
- 保持一致的命名风格

## 类型安全

本项目的翻译系统是类型安全的：

- `Translation` 类型基于中文翻译定义
- 英文翻译必须匹配中文翻译的结构
- TypeScript 会在编译时检查翻译键是否存在

## 注意事项

1. 翻译文本中可以包含 `{参数名}` 占位符用于动态替换
2. 如果翻译键不存在，会在控制台输出警告并返回键名本身
3. 修改翻译后需要重新构建项目
4. 建议在添加新功能时同时添加中英文翻译

## 待完成工作

当前多语言支持的基础架构已完成，包括：

- ✅ i18n 配置和翻译文件结构
- ✅ 系统状态管理（systemStore）
- ✅ useTranslation 和 useFormatDate Hooks
- ✅ 后台管理的语言设置选项

仍需完成：

- ⏳ 更新主要页面和组件使用翻译功能
- ⏳ 更新所有日期格式化函数支持多语言

建议逐步迁移现有组件使用翻译系统，而不是一次性全部修改。

