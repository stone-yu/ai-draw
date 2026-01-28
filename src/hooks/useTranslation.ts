import {useMemo} from 'react'
import {useSystemStore} from '@/stores/systemStore'
import {getTranslation} from '@/lib/i18n'

/**
 * Hook to get translation functions
 * Usage: const { t } = useTranslation()
 * Example: t('common.save') or t('admin.title')
 */
export function useTranslation() {
  const language = useSystemStore((state) => state.language)

  const translations = useMemo(() => {
    return getTranslation(language)
  }, [language])

  /**
   * Get nested translation value by path
   * @param path - dot-separated path like 'common.save' or 'admin.title'
   * @param params - optional parameters for string interpolation
   */
  const t = (path: string, params?: Record<string, string | number>): string => {
    const keys = path.split('.')
    let value: any = translations

    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key]
      } else {
        console.warn(`Translation key not found: ${path}`)
        return path
      }
    }

    if (typeof value !== 'string') {
      console.warn(`Translation value is not a string: ${path}`)
      return path
    }

    // Replace parameters in the format {param}
    if (params) {
      return value.replace(/\{(\w+)\}/g, (match, key) => {
        return params[key]?.toString() || match
      })
    }

    return value
  }

  return { t, language, translations }
}

/**
 * Utility function to format date based on current language
 */
export function useFormatDate() {
  const { language } = useTranslation()

  const formatDate = (date: Date | string | number, format: 'short' | 'long' | 'datetime' = 'long'): string => {
    const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date

    if (language === 'zh') {
      if (format === 'short') {
        return dateObj.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
      } else if (format === 'datetime') {
        return dateObj.toLocaleString('zh-CN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      } else {
        return dateObj.toLocaleDateString('zh-CN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        })
      }
    } else {
      // English
      if (format === 'short') {
        return dateObj.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' })
      } else if (format === 'datetime') {
        return dateObj.toLocaleString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      } else {
        return dateObj.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      }
    }
  }

  return { formatDate }
}

