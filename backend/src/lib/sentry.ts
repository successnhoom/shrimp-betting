/**
 * Sentry error tracking setup
 * Install: npm install @sentry/node
 */
export function initSentry() {
  const dsn = process.env.SENTRY_DSN
  if (!dsn) {
    console.log('Sentry DSN not set — skipping init')
    return
  }

  try {
    const Sentry = require('@sentry/node')
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
    })
    console.log('✅ Sentry initialized')
  } catch {
    console.warn('Sentry package not installed — run: npm install @sentry/node')
  }
}

export function captureError(err: Error, context?: object) {
  const dsn = process.env.SENTRY_DSN
  if (!dsn) return
  try {
    const Sentry = require('@sentry/node')
    Sentry.captureException(err, { extra: context })
  } catch {}
}
