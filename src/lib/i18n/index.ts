import {zh} from './zh'
import {en} from './en'
import type {Locale} from './config'

export const translations = {
  zh,
  en,
}

export function getTranslation(locale: Locale) {
  return translations[locale] || translations.zh
}

export * from './config'
export type { Translation } from './zh'

