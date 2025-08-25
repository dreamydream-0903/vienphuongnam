// src/lib/logger.ts
import pino from 'pino'

const level = process.env.LOG_LEVEL || 'info'
let logger = pino({ level })

// Only attempt Logflare in production if both env vars are set
if (
  process.env.NODE_ENV === 'production' &&
  process.env.LOGFLARE_API_KEY &&
  process.env.LOGFLARE_SOURCE_TOKEN
) {
  try {
    // Hide this require from Turbopack/Webpack static analysis
    const requireLF = eval('require')
    const { LogflarePinoVercel } = requireLF('pino-logflare')
    const stream = LogflarePinoVercel({
      apiKey:     process.env.LOGFLARE_API_KEY,
      sourceToken: process.env.LOGFLARE_SOURCE_TOKEN,
    })
    logger = pino({ level }, stream)
  } catch (err) {
    // If it fails, fall back to plain pino
    console.warn('⚠️  Could not load pino-logflare, using console only.', err)
  }
}

export { logger }
