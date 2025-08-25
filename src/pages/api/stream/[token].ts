// src/pages/api/stream/[token].ts
import { logger } from '@/lib/logger'
import { verify } from 'jsonwebtoken'
import { Redis } from '@upstash/redis'
import type { NextApiRequest, NextApiResponse } from 'next'
import { getSignedUrl } from '@/lib/r2'

const redis = Redis.fromEnv()

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // 1) Only GET/HEAD
    if (req.method !== 'GET') {
      res.setHeader('Allow', ['GET', 'HEAD'])
      return res.status(405).end()
    }

    // 2) Verify token
    const { token } = req.query as { token: string }
    let payload: any
    try {
      payload = verify(token, process.env.PLAYBACK_JWT_SECRET!) as any
    } catch {
      logger.warn({ token }, 'Invalid playback token')
      return res.status(401).end()
    }
    const { jti, email, courseCode, videoId } = payload

    // 3) JTI check (no consume on HEAD)
    // const exists = await redis.get(jti)
    // if (!exists) {
    //   logger.warn({ jti, email }, `${req.method} on replayed token`)
    //   return res.status(403).end()
    // }

    // 4) Build & sign the R2 key
    const prefix = process.env.R2_PREFIX || 'encrypted'
    const objectKey = `${prefix}/${courseCode}/${videoId}/dash/manifest.mpd`
    let signedUrl: string
    try {
      signedUrl = await getSignedUrl(objectKey, 300)
    } catch (err: any) {
      logger.error({ err: err.message, stack: err.stack }, 'Failed to sign R2 URL')
      return res.status(500).end()
    }

    logger.info({ email, courseCode, videoId }, 'Proxying manifest from R2')

    // 5) Fetch from R2
    let upstream: Response
    try {
      upstream = await fetch(signedUrl, {
        method: req.method,
        // forward Range if requested
        headers: req.headers.range ? { Range: req.headers.range } : undefined,
      })
    } catch (err: any) {
      logger.error({ err: err.message, stack: err.stack }, 'Error fetching upstream manifest')
      return res.status(502).end()
    }

    // 6) Mirror status & headers
    res.status(upstream.status)
    upstream.headers.forEach((value, name) => {
      if (
        /^(content-type|content-length|content-range|accept-ranges|cache-control)$/i.test(name)
      ) {
        res.setHeader(name, value)
      }
    })

    res.setHeader('Content-Type', 'application/dash+xml')

    // // 7) On HEAD, just end
    // if (req.method === 'HEAD') {
    //   return res.end()
    // }

    // 8) On GET, read the entire body, then consume the JTI
    const buf = Buffer.from(await upstream.arrayBuffer())
    // await redis.del(jti)

    // 9) Send the manifest bytes
    return res.send(buf)
  } catch (err) {
    console.error('Stream handler error (falling back to 405):', err);
    res.setHeader('Allow', ['GET', 'HEAD']);
    return res.status(405).end();
  }
}
