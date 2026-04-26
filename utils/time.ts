export type ShanghaiDatePart = 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second'

export interface ShanghaiDateParts {
  year: string
  month: string
  day: string
  hour: string
  minute: string
  second: string
}

const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000

let intlAvailable: boolean | null = null
let shanghaiDateTimeFormatter: Intl.DateTimeFormat | null = null
let shanghaiDateKeyFormatter: Intl.DateTimeFormat | null = null

function checkIntl(): boolean {
  if (intlAvailable !== null) return intlAvailable
  try {
    const testFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })
    const result = testFormatter.format(new Date())
    if (result && /^\d{4}-\d{2}-\d{2}$/.test(result)) {
      shanghaiDateTimeFormatter = new Intl.DateTimeFormat('zh-CN', {
        timeZone: 'Asia/Shanghai',
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
      shanghaiDateKeyFormatter = testFormatter
      intlAvailable = true
      return true
    }
    intlAvailable = false
    return false
  } catch {
    intlAvailable = false
    return false
  }
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function getShanghaiDateManual(date: Date = new Date()): ShanghaiDateParts {
  const shanghaiTime = new Date(date.getTime() + SHANGHAI_OFFSET_MS)
  const year = shanghaiTime.getUTCFullYear()
  const month = shanghaiTime.getUTCMonth() + 1
  const day = shanghaiTime.getUTCDate()
  const hour = shanghaiTime.getUTCHours()
  const minute = shanghaiTime.getUTCMinutes()
  const second = shanghaiTime.getUTCSeconds()
  return {
    year: String(year),
    month: pad2(month),
    day: pad2(day),
    hour: pad2(hour),
    minute: pad2(minute),
    second: pad2(second)
  }
}

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
  if (checkIntl() && shanghaiDateTimeFormatter) {
    try {
      const parts = shanghaiDateTimeFormatter.formatToParts(date)
      const getPart = (type: ShanghaiDatePart) => parts.find(part => part.type === type)?.value || ''
      const result = {
        year: getPart('year'),
        month: getPart('month'),
        day: getPart('day'),
        hour: getPart('hour'),
        minute: getPart('minute'),
        second: getPart('second')
      }
      if (result.year && result.month && result.day && result.hour && result.minute && result.second) {
        return result
      }
    } catch {}
  }
  return getShanghaiDateManual(date)
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
  if (checkIntl() && shanghaiDateKeyFormatter) {
    try {
      const result = shanghaiDateKeyFormatter.format(date)
      if (result && /^\d{4}-\d{2}-\d{2}$/.test(result)) {
        return result
      }
    } catch {}
  }
  const parts = getShanghaiDateManual(date)
  return `${parts.year}-${parts.month}-${parts.day}`
}

export function getShanghaiStartOfDay(date: Date = new Date()): Date {
  return new Date(`${formatShanghaiDateKey(date)}T00:00:00+08:00`)
}
