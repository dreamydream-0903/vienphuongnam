// src/pages/api/drm/license.ts
export const config = { api: { bodyParser: false } }

import type { NextApiRequest, NextApiResponse } from 'next'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'
import AWS from 'aws-sdk'
import { rateLimiter } from '@/lib/rateLimiter'
import { logger } from '@/lib/logger'
import { userHasVideoAccess, resolveVideoByAnyId } from '@/lib/access'

const kms = new AWS.KMS({ region: process.env.AWS_REGION })

// helper to unwrap your encrypted data key
async function unwrapDataKey(ct: string): Promise<Buffer> {
  const buff = Buffer.from(ct, 'base64')
  const resp = await kms.decrypt({ CiphertextBlob: buff }).promise()
  if (!resp.Plaintext) throw new Error('KMS returned no plaintext')
  return resp.Plaintext as Buffer
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const start = Date.now()
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  if (!token?.email) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || '';
  try {
    const { success } = await rateLimiter.limit(token.email || ip)
    if (!success) {
      return res.status(429).json({ error: 'Too many requests' })
    }
  } catch {
    // silently pass if Redis is down
  }

  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST'])
      return res.status(405).json({ error: 'Method not allowed; use POST' })
    }

    // ── 1) Verify user session from JWT ──────────────────────────────────────
    if (!token?.email) {
      logger.warn({ ip: ip }, 'License request without session')
      return res.status(401).json({ error: 'Unauthorized' })
    }

    // ── 2) Check user entitlement ──────────────────────────────────────────
    const { courseCode, videoId } = req.query
    logger.info({ email: token.email, courseCode, videoId }, 'License requested')

    if (typeof courseCode !== 'string' || typeof videoId !== 'string') {
      return res.status(400).json({ error: 'Missing courseCode/videoId' })
    }

    const user = await prisma.user.findUnique({ where: { email: token.email } })
    const course = await prisma.course.findUnique({ where: { code: courseCode } })
    if (!user || !course) {
      return res.status(404).json({ error: 'Not found' })
    }

    const access = await prisma.userCourse.findUnique({
      where: { userId_courseId: { userId: user.id, courseId: course.id } }
    })
    if (!access) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    // Resolve the canonical Video row by either DB id or r2Path (slug)
    const video = await resolveVideoByAnyId(courseCode, videoId)
    if (!video) {
      return res.status(404).json({ error: 'Video not found' })
    }

    // Enforce per-video allowlist
    const allowed = await userHasVideoAccess(user.id, video.id)
    if (!allowed) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    // ── 3) Read the raw EME initData (same as in ey.ts) ──────────────
    let rawBody: Buffer
    if (req.body instanceof Buffer) {
      rawBody = req.body
    } else {
      const chunks: Buffer[] = []
      rawBody = await new Promise<Buffer>((resolve, reject) => {
        req.on('data', c => chunks.push(typeof c === 'string' ? Buffer.from(c) : c))
        req.on('end', () => resolve(Buffer.concat(chunks)))
        req.on('error', reject)
      })
    }

    // ── 4) Extract KIDs (JSON or PSSH) ─────────────────────────────────────
    let kidBuffers: Buffer[] = []
    try {
      const json = JSON.parse(rawBody.toString('utf8'))
      kidBuffers = json.kids.map((b64: string) => Buffer.from(b64, 'base64'))
    } catch {
      // fallback to PSSH parsing
      const count = rawBody.readUInt32BE(28)
      for (let i = 0; i < count; i++) {
        const offset = 32 + i * 16
        kidBuffers.push(rawBody.subarray(offset, offset + 16))
      }
    }

    // ── 5) Load and decrypt each key from your keystore.json ───────────────
    const record = await prisma.videoKeystore.findUnique({ where: { videoId } })

    if (!record) {
      return res.status(500).json({ error: `Keystore not found for video ${videoId}` })
    }
    const keystore = record.keystore as Record<string, { ciphertext: string }>

    // debug: list which KIDs we were asked for vs. what we have
    const requestedHexes = kidBuffers.map(buf => buf.toString('hex'))
    const availableHexes = Object.keys(keystore)
    logger.debug(
      { videoId, requestedHexes, availableHexes },
      'Keystore lookup - incoming vs. stored KIDs'
    )

    const keys = await Promise.all(
      kidBuffers.map(async buf => {
        const hex = buf.toString('hex')
        const entry = keystore[hex]
        if (!entry) throw new Error(`KID ${hex} not in keystore`)
        const plaintext = await unwrapDataKey(entry.ciphertext)
        return {
          kty: 'oct' as const,
          kid: buf.toString('base64').replace(/=+$/, ''),
          k: plaintext.toString('base64').replace(/=+$/, ''),
        }
      })
    )

    const latency = Date.now() - start
    logger.info({ email: token.email, courseCode, videoId, latency }, 'License granted')

    // ── 6) Send ClearKey response ───────────────────────────────────────────
    res.setHeader('Content-Type', 'application/json')
    return res.status(200).json({ keys })
  } catch (error: any) {
    logger.error({
      email: token?.email,
      error: error.message,
      stack: error.stack,
      path: req.url,
    }, 'License request failed')
    return res.status(500).json({ error: 'Internal server error' })
  }
}
