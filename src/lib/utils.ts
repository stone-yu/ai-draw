import {type ClassValue, clsx} from 'clsx'
import {twMerge} from 'tailwind-merge'

/**
 * Merge Tailwind CSS classes with clsx
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | string, includeSeconds: boolean = false) {
  const dateObj = new Date(date)

  // Check if it's a legacy date string (e.g. "YYYY-MM-DD")
  // If it is, we should only display the date part even if includeSeconds is true
  const isLegacyDate = typeof date === 'string' && date.length <= 10

  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }

  if (includeSeconds && !isLegacyDate) {
    options.hour = '2-digit'
    options.minute = '2-digit'
    options.second = '2-digit'
    options.hour12 = false
  }

  return dateObj.toLocaleDateString('zh-CN', options).replace(/\//g, '/')
}
