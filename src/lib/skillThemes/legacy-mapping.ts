import { DEFAULT_DIAGRAM_THEME, findDiagramTheme } from './diagram-themes'

export const LEGACY_HTML_THEME_MAP: Record<string, string> = {
  'dark-tech':       'tech-dark',
  'flat-icon':       'saas-modern',
  'blueprint':       'blueprint',
  'claude-official': 'xhs-soft',
}

export function normalizeHtmlTheme(value: string | undefined | null): string {
  if (!value) return DEFAULT_DIAGRAM_THEME
  const mapped = LEGACY_HTML_THEME_MAP[value] ?? value
  return findDiagramTheme(mapped) ? mapped : DEFAULT_DIAGRAM_THEME
}
