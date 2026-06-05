import { FastifyInstance } from 'fastify'

/**
 * Security headers (Helmet-equivalent for Fastify)
 */
export function registerHelmet(app: FastifyInstance) {
  app.addHook('onSend', async (_request, reply) => {
    reply
      .header('X-Content-Type-Options', 'nosniff')
      .header('X-Frame-Options', 'DENY')
      .header('X-XSS-Protection', '1; mode=block')
      .header('Referrer-Policy', 'strict-origin-when-cross-origin')
      .header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
      .header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
      .header(
        'Content-Security-Policy',
        [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline'",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: blob:",
          "connect-src 'self' wss: https:",
          "font-src 'self' https://fonts.gstatic.com",
        ].join('; ')
      )
  })
}
