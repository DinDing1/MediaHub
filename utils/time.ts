export type ShanghaiDatePart = 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second'

export interface ShanghaiDateParts {
  year: string
  month: string
  day: string
  hour: string
  minute: string
  second: string
}

const SHANGHAI_TIME_ZONE = 'Asia/Shanghai'
const shanghaiDateTimeFormatter = new Intl.DateTimeFormat('zh-CN', {
  timeZone: SHANGHAI_TIME_ZONE,
  hour12: false,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit'
})
const shanghaiDateKeyFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: SHANGHAI_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
})

export function parseUtcLikeTime(value: string | null | undefined): Date | null {
  if (!value) {
    return null
  }

  const normalized = value.includes('T') ? value : value.replace(' ', 'T')
  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(normalized)
  const date = new Date(hasTimezone ? normalized : `${normalized}Z`)

  return Number.isNaN(date.getTime()) ? null : date
}

export function getShanghaiDateParts(date: Date = new Date()): ShanghaiDateParts {
  const parts = shanghaiDateTimeFormatter.formatToParts(date)
  const getPart = (type: ShanghaiDatePart) => parts.find(part => part.type === type)?.value || ''

  return {
    year: getPart('year'),
    month: getPart('month'),
    day: getPart('day'),
    hour: getPart('hour'),
    minute: getPart('minute'),
    second: getPart('second')
  }
}

export function formatShanghaiDateTime(
  value: string | Date | null | undefined,
  withSeconds: boolean = true
): string {
  if (!value) {
    return ''
  }

  const date = value instanceof Date ? value : parseUtcLikeTime(value)
  if (!date) {
    return typeof value === 'string' ? value : ''
  }

  const parts = getShanghaiDateParts(date)
  const suffix = withSeconds ? `:${parts.second}` : ''
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}${suffix}`
}

export function formatShanghaiDateKey(date: Date = new Date()): string {
  return shanghaiDateKeyFormatter.format(date)
}

export function getShanghaiStartOfDay(date: Date = new Date()): Date {
  return new Date(`${formatShanghaiDateKey(date)}T00:00:00+08:00`)
}
