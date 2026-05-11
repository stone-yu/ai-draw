import type { HtmlStyleVariant } from '@/types'
import { darkTechShell } from './darkTech'
import { flatIconShell } from './flatIcon'
import { blueprintShell } from './blueprint'
import { claudeOfficialShell } from './claudeOfficial'

export type ShellFn = (svg: string, title: string) => string

export const shells: Record<HtmlStyleVariant, ShellFn> = {
  'dark-tech': darkTechShell,
  'flat-icon': flatIconShell,
  blueprint: blueprintShell,
  'claude-official': claudeOfficialShell,
}

export function buildSrcDoc(
  variant: HtmlStyleVariant,
  svg: string,
  title: string,
): string {
  const fn = shells[variant]
  if (!fn) {
    throw new Error(`Unknown HtmlStyleVariant: ${variant}`)
  }
  return fn(svg, title)
}

/**
 * Escape a string for safe insertion into HTML text content.
 * The title comes from user input; SVG comes from validated AI output.
 */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
