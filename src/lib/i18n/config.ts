export const i18n = {
  defaultLocale: 'zh',
  locales: ['zh', 'en'],
} as const

export type Locale = (typeof i18n)['locales'][number]

