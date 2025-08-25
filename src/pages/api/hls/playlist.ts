// // src/pages/api/hls/playlist.ts
// export const config = { api: { bodyParser: false } }

// import type { NextApiRequest, NextApiResponse } from 'next'
// import { getToken } from 'next-auth/jwt'
// import { prisma } from '@/lib/prisma'
// import { rateLimiter } from '@/lib/rateLimiter'
// import { logger } from '@/lib/logger'
// import { getSignedUrl } from '@/lib/r2'

// function isUnsafePath(p: string) {
//   return !p ||
//     p.startsWith('/') ||
//     p.includes('..') ||
//     p.includes('\\') ||
//     p.includes('%2f') || p.includes('%2F')
// }

// export default async function handler(req: NextApiRequest, res: NextApiResponse) {
//   const startedAt = Date.now()

//   if (req.method !== 'GET') {
//     res.setHeader('Allow', ['GET'])
//     return res.status(405).json({ error: 'Method not allowed; use GET' })
//   }

//   const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
//   if (!token?.email) {
//     return res.status(401).json({ error: 'Unauthorized' })
//   }

//   const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
//     || req.socket.remoteAddress
//     || ''
//   try {
//     const { success } = await rateLimiter.limit(token.email || ip)
//     if (!success) {
//       return res.status(429).json({ error: 'Too many requests' })
//     }
//   } catch {
//     // don't block playback if Redis is down
//   }

//   try {
//     // Accept ?course / ?video or ?courseCode / ?videoId
//     const courseCode =
//       (req.query.course as string) || (req.query.courseCode as string)
//     const videoId =
//       (req.query.video as string) || (req.query.videoId as string)
//     const pathArg = (req.query.path as string) || 'master.m3u8'

//     if (!courseCode || !videoId) {
//       return res.status(400).json({ error: 'Missing course/video' })
//     }
//     if (isUnsafePath(pathArg)) {
//       return res.status(400).json({ error: 'Invalid path' })
//     }

//     logger.info({ email: token.email, courseCode, videoId, pathArg }, 'HLS playlist requested')

//     // Entitlement (mirror license.ts)
//     const user = await prisma.user.findUnique({ where: { email: token.email } })
//     const course = await prisma.course.findUnique({ where: { code: courseCode } })
//     if (!user || !course) return res.status(404).json({ error: 'Not found' })

//     const access = await prisma.userCourse.findUnique({
//       where: { userId_courseId: { userId: user.id, courseId: course.id } }
//     })
//     if (!access) return res.status(403).json({ error: 'Forbidden' })

//     // Pull upstream playlist from R2
//     const r2Prefix = process.env.R2_PREFIX || 'encrypted'
//     // AES-128 outputs live under hls-aes128/
//     const baseKey = `${r2Prefix}/${courseCode}/${videoId}/hls-aes128`
//     const key = `${baseKey}/${pathArg}`

//     const signed = await getSignedUrl(key, 300)
//     const upstream = await fetch(signed)
//     if (!upstream.ok) {
//       logger.warn({ key, status: upstream.status }, 'Upstream playlist fetch failed')
//       return res.status(502).json({ error: 'Upstream error' })
//     }
//     const text = await upstream.text()

//     // Determine playlist type
//     const isMaster = /#EXT-X-STREAM-INF/i.test(text)

//     // Rewriter
//     const lines = text.split('\n')
//     const out: string[] = []
//     const keyApi = `/api/hls-key?course=${encodeURIComponent(courseCode)}&video=${encodeURIComponent(videoId)}`
//     const selfBase = `/api/hls/playlist?course=${encodeURIComponent(courseCode)}&video=${encodeURIComponent(videoId)}&path=`

//     for (const raw of lines) {
//       const line = raw.trim()
//       if (line.length === 0 || line.startsWith('#')) {
//         // Rewrite KEY line in media playlists
//         if (!isMaster && line.startsWith('#EXT-X-KEY')) {
//           // Ensure URI points to our same-origin key endpoint
//           // Keep METHOD=AES-128 and any IV attributes intact
//           const replaced = line.replace(/URI="[^"]*"/, `URI="${keyApi}"`)
//           out.push(replaced)
//         } else {
//           out.push(raw) // keep as-is (preserve original whitespace)
//         }
//         continue
//       }

//       // URI line
//       // Absolute URLs (http/https) are left as-is (rare for our case)
//       if (/^https?:\/\//i.test(line)) {
//         out.push(line)
//         continue
//       }

//       if (isMaster) {
//         // Child playlist path (e.g., v0/index.m3u8) -> point back to this API
//         out.push(`${selfBase}${encodeURIComponent(line)}`)
//       } else {
//         // Media playlist segment (.ts) -> sign absolute R2 URL
//         const segKey = `${baseKey}/${line}`
//         const segUrl = await getSignedUrl(segKey, 300)
//         out.push(segUrl)
//       }
//     }

//     const body = out.join('\n')
//     const latency = Date.now() - startedAt
//     logger.info({ email: token.email, courseCode, videoId, pathArg, latency }, 'HLS playlist served')

//     res.setHeader('Content-Type', 'application/vnd.apple.mpegurl')
//     res.setHeader('Cache-Control', 'no-store')
//     res.setHeader('Pragma', 'no-cache')
//     res.setHeader('X-Content-Type-Options', 'nosniff')
//     return res.status(200).send(body)
//   } catch (error: any) {
//     logger.error(
//       {
//         email: (await getToken({ req, secret: process.env.NEXTAUTH_SECRET }))?.email,
//         error: error?.message,
//         stack: error?.stack,
//         path: req.url,
//       },
//       'HLS playlist request failed'
//     )
//     return res.status(500).json({ error: 'Internal server error' })
//   }
// }

// src/pages/api/hls/playlist.ts
export const config = { api: { bodyParser: false } }

import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/pages/api/auth/[...nextauth]'
import { prisma } from '@/lib/prisma'
import { rateLimiter } from '@/lib/rateLimiter'
import { logger } from '@/lib/logger'
import type { Session } from "next-auth"


function isUnsafePath(p: string) {
  return !p || p.startsWith('/') || p.includes('..') || p.includes('\\') || /%2f/i.test(p)
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const startedAt = Date.now()
  const debug = req.query.debug === '1' && process.env.NODE_ENV !== 'production'

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).json({ error: 'Method not allowed; use GET' })
  }

  try {
    // Auth (server session works for JWT or DB sessions)
    const session = await getServerSession(req, res, authOptions as any) as Session | null
    if (!session?.user?.email) return res.status(401).json({ error: 'Unauthorized' })
    const email = session.user.email

    // Rate limit
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || ''
    try {
      const { success } = await rateLimiter.limit(email || ip)
      if (!success) return res.status(429).json({ error: 'Too many requests' })
    } catch { /* don’t block playback if RL backend down */ }

    // Inputs
    const courseCode = (req.query.course as string) || (req.query.courseCode as string)
    const videoId = (req.query.video as string) || (req.query.videoId as string)
    const pathArg = (req.query.path as string) || 'master.m3u8'
    if (!courseCode || !videoId) return res.status(400).json({ error: 'Missing course/video' })
    if (isUnsafePath(pathArg)) return res.status(400).json({ error: 'Invalid path' })

    // Entitlement
    const user = await prisma.user.findUnique({ where: { email } })
    const course = await prisma.course.findUnique({ where: { code: courseCode } })
    if (!user || !course) return res.status(404).json({ error: 'Not found' })
    const access = await prisma.userCourse.findUnique({
      where: { userId_courseId: { userId: user.id, courseId: course.id } }
    })
    if (!access) return res.status(403).json({ error: 'Forbidden' })

    // Public R2 base for assets (segments + playlists)
    const assetBaseRaw = process.env.NEXT_PUBLIC_ASSET_BASE || process.env.ASSET_BASE
    if (!assetBaseRaw) {
      return res.status(500).json({ error: 'ASSET_BASE not configured (set NEXT_PUBLIC_ASSET_BASE=https://pub-...r2.dev/encrypted)' })
    }
    const assetBase = assetBaseRaw.replace(/\/+$/, '') // trim trailing slash

    // Build public base for this video’s AES-128 HLS
    // Example: https://pub-...r2.dev/encrypted/<course>/<video>/hls-aes128
    const playlistPublicBase =
      `${assetBase}/${encodeURIComponent(courseCode)}/${encodeURIComponent(videoId)}/hls-aes128`

    // Upstream playlist URL (public)
    const objectUrl = `${playlistPublicBase}/${pathArg}`

    const upstream = await fetch(objectUrl)
    if (!upstream.ok) {
      const detail = `Upstream ${upstream.status} for ${objectUrl}`
      logger.warn({ objectUrl, status: upstream.status }, 'Upstream playlist fetch failed')
      return res.status(upstream.status === 404 ? 404 : 502)
        .json({ error: 'Upstream fetch failed', detail: debug ? detail : undefined })
    }

    const text = await upstream.text()
    const isMaster = /#EXT-X-STREAM-INF/i.test(text)
    const lines = text.split('\n')

    // If media playlist, segments are relative to its directory:
    // e.g., pathArg = 'v0/index.m3u8' -> mediaDirRel = 'v0'
    const relDir = pathArg.includes('/') ? pathArg.slice(0, pathArg.lastIndexOf('/')) : ''
    const mediaDirRel = isMaster ? '' : relDir

    const keyApi = `/api/hls-key?course=${encodeURIComponent(courseCode)}&video=${encodeURIComponent(videoId)}`
    const selfBase = `/api/hls/playlist?course=${encodeURIComponent(courseCode)}&video=${encodeURIComponent(videoId)}&path=`

    const out: string[] = []
    if (debug) {
      out.push(`#DEBUG assetBase=${assetBase}`)
      out.push(`#DEBUG playlistPublicBase=${playlistPublicBase}`)
      out.push(`#DEBUG objectUrl=${objectUrl}`)
      out.push(`#DEBUG mediaDirRel=${mediaDirRel}`)
    }

    for (const raw of lines) {
      const line = raw.trim()

      if (line.length === 0 || line.startsWith('#')) {
        if (!isMaster && line.startsWith('#EXT-X-KEY')) {
          // Force same-origin key URL
          const replaced = line.replace(/URI="[^"]*"/, `URI="${keyApi}"`)
          out.push(replaced)
        } else {
          out.push(raw) // preserve original comments/whitespace
        }
        continue
      }

      // Absolute URLs: keep as-is
      if (/^https?:\/\//i.test(line)) {
        out.push(line)
        continue
      }

      // Normalize "./seg.ts" -> "seg.ts"
      const norm = line.replace(/^\.\//, '')

      if (isMaster && norm.endsWith('.m3u8')) {
        // Child playlist still goes through our API (to enforce auth)
        out.push(`${selfBase}${encodeURIComponent(norm)}`)
      } else {
        // Segment (media playlist): point to public R2 (no presign)
        // Example: <assetBase>/<course>/<video>/hls-aes128/v0/seg_000.ts
        const segUrl = `${playlistPublicBase}/${mediaDirRel ? mediaDirRel + '/' : ''}${norm}`
        if (debug) out.push(`#DEBUG segUrl=${segUrl}`)
        out.push(segUrl)
      }
    }

    const body = out.join('\n')
    logger.info({ email, courseCode, videoId, pathArg, ms: Date.now() - startedAt }, 'HLS playlist served')
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl')
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    return res.status(200).send(body)
  } catch (error: any) {
    logger.error({ error: error?.message, stack: error?.stack, path: req.url }, 'HLS playlist request failed')
    return res.status(500).json({ error: 'Internal server error' })
  }
}
