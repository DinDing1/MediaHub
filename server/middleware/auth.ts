import { defineEventHandler, getRequestURL, sendError, createError } from 'h3'
import { getAuthenticatedUser, hasSystemUsers } from '../utils/auth'

/**
 * Public API prefixes that do not require login.
 */
const PUBLIC_API_PREFIXES = [
  '/api/auth/',
  '/api/emby/webhook',
  '/api/d115'
]

export default defineEventHandler((event) => {
  const pathname = getRequestURL(event).pathname

  if (!pathname.startsWith('/api/')) {
    return
  }

  if (PUBLIC_API_PREFIXES.some(prefix => pathname.startsWith(prefix))) {
    return
  }

  if (!hasSystemUsers()) {
    console.warn('[auth] blocked (no users):', event.method, pathname)
    return sendError(event, createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      message: '?????????????'
    }))
  }

  const user = getAuthenticatedUser(event)
  if (user) {
    event.context.authUser = user
    return
  }

  console.warn('[auth] blocked (not logged in):', event.method, pathname)
  return sendError(event, createError({
    statusCode: 401,
    statusMessage: 'Unauthorized',
    message: '?????????'
  }))
})
