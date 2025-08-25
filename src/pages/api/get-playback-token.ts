// src/pages/api/get-playback-token.ts
import { getToken } from 'next-auth/jwt'
import { sign } from 'jsonwebtoken'
import { prisma } from '@/lib/prisma'
import { Redis } from '@upstash/redis'
import { logger } from '@/lib/logger'
import type { NextApiRequest, NextApiResponse } from 'next'
import { getSession } from 'next-auth/react'

const redis = Redis.fromEnv()

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const session = await getSession({ req })
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    const start = Date.now()

    try {
      const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
      const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || '';

      if (!token?.email) {
        logger.warn({ ip: ip }, 'Playback-token request without session')
        return res.status(401).end()
      }

      const { courseCode, videoId } = req.query as Record<string, string>
      logger.info({ email: token.email, courseCode, videoId }, 'Playback token requested')

      // 1) entitlement check (same as license endpoint)…
      // 2) generate JTI one-time ID
      const jti = crypto.randomUUID()
      // 3) sign a 5-minute JWT
      const playToken = sign(
        { email: token.email, courseCode, videoId, jti },
        process.env.PLAYBACK_JWT_SECRET!,
        { expiresIn: '5m' }
      )
      // 4) store JTI in Redis for one-time use
      await redis.set(jti, '1', { ex: 300 })

      const latency = Date.now() - start
      logger.info({ email: token.email, courseCode, videoId, jti, latency }, 'Playback token issued')

      res.json({ token: playToken })
    } catch (err: any) {
      logger.error({ err: err.message, stack: err.stack, path: req.url }, 'Playback-token error')
      return res.status(500).json({ error: err.message })
    }

  } catch (error) {
    logger.error(
      { error: (error as Error).message, stack: (error as Error).stack, path: req.url },
      'Error in get-playback-token handler'
    )
    return res.status(401).json({ error: 'Unauthorized' })
  }
}
