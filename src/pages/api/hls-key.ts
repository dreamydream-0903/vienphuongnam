// src/pages/api/hls-key.ts
export const config = { api: { bodyParser: false } }

import type { NextApiRequest, NextApiResponse } from 'next'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'
import AWS from 'aws-sdk'
import { rateLimiter } from '@/lib/rateLimiter'
import { logger } from '@/lib/logger'
import fs from 'fs'

// KMS client
const kms = new AWS.KMS({ region: process.env.AWS_REGION })

// Decrypt a KMS-encrypted 16-byte data key (base64 ciphertext -> plaintext Buffer)
async function unwrapDataKey(ciphertextB64: string): Promise<Buffer> {
  const resp = await kms.decrypt({
    CiphertextBlob: Buffer.from(ciphertextB64, 'base64'),
  }).promise()
  if (!resp.Plaintext) throw new Error('KMS returned no plaintext')
  return resp.Plaintext as Buffer
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const startedAt = Date.now()

  // --- Method & Auth guard (mirror license.ts) ------------------------------
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).json({ error: 'Method not allowed; use GET' })
  }

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  if (!token?.email) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  // --- Rate limiting (same shape as license.ts) -----------------------------
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
    || req.socket.remoteAddress
    || ''
  try {
    const { success } = await rateLimiter.limit(token.email || ip)
    if (!success) {
      return res.status(429).json({ error: 'Too many requests' })
    }
  } catch {
    // If Redis is down, don't block playback
  }

  try {
    // --- Inputs --------------------------------------------------------------
    // Accept either ?course / ?video or ?courseCode / ?videoId
    const courseCode =
      (req.query.course as string)
      || (req.query.courseCode as string)
    const videoId =
      (req.query.video as string)
      || (req.query.videoId as string)

    if (!courseCode || !videoId) {
      return res.status(400).json({ error: 'Missing course/video' })
    }

    logger.info(
      { email: token.email, courseCode, videoId },
      'HLS AES-128 key requested'
    )

    // --- Entitlement check (mirror license.ts) ------------------------------
    const user = await prisma.user.findUnique({ where: { email: token.email } })
    const course = await prisma.course.findUnique({ where: { code: courseCode } })
    if (!user || !course) {
      return res.status(404).json({ error: 'Not found' })
    }

    const access = await prisma.userCourse.findUnique({
      where: { userId_courseId: { userId: user.id, courseId: course.id } },
    })
    if (!access) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    // --- Locate encrypted AES key -------------------------------------------
    // 1) Preferred: dedicated VideoAesKey table (if present in Prisma schema)
    let ciphertextB64: string | undefined
    const prismaAny = prisma as any

    if (prismaAny.videoAesKey?.findUnique) {
      const rec = await prismaAny.videoAesKey.findUnique({
        where: { courseCode_videoId: { courseCode, videoId } },
        select: { kmsCiphertextB64: true },
      })
      ciphertextB64 = rec?.kmsCiphertextB64
    }

    // 2) Fallback: look inside videoKeystore.keystore JSON at key "aes:<course>/<video>"
    if (!ciphertextB64 && prismaAny.videoKeystore?.findUnique) {
      const ksRec = await prismaAny.videoKeystore.findUnique({
        where: { videoId },
        select: { keystore: true },
      })
      if (ksRec?.keystore) {
        // Expecting structure: { "aes:<course>/<video>": { ciphertext: "<b64>" }, ... }
        const ks = ksRec.keystore as Record<string, any>
        const aesKey = ks[`aes:${courseCode}/${videoId}`]
        if (aesKey?.ciphertext) {
          ciphertextB64 = aesKey.ciphertext as string
        } else if (typeof ks['aesKeyCiphertextB64'] === 'string') {
          // Alternate single-field storage
          ciphertextB64 = ks['aesKeyCiphertextB64'] as string
        }
      }
    }

    // 3) Last resort: load local JSON keystore (if available to server)
    if (!ciphertextB64) {
      const jsonPath = process.env.KEYSTORE_JSON_API || process.env.KEYSTORE_JSON
      if (jsonPath && fs.existsSync(jsonPath)) {
        try {
          const file = fs.readFileSync(jsonPath, 'utf8')
          const ks = JSON.parse(file) as Record<string, { ciphertext: string }>
          const entry = ks[`aes:${courseCode}/${videoId}`]
          if (entry?.ciphertext) {
            ciphertextB64 = entry.ciphertext
          }
        } catch {
          // ignore parse errors; we'll 404 below
        }
      }
    }

    if (!ciphertextB64) {
      logger.warn({ courseCode, videoId }, 'AES key not found')
      return res.status(404).json({ error: 'AES key not found' })
    }

    // --- Decrypt with KMS ----------------------------------------------------
    const keyBytes = await unwrapDataKey(ciphertextB64)
    if (keyBytes.length !== 16) {
      logger.error({ courseCode, videoId, len: keyBytes.length }, 'Invalid AES key length')
      return res.status(500).json({ error: 'Invalid key size' })
    }

    const latency = Date.now() - startedAt
    logger.info({ email: token.email, courseCode, videoId, latency }, 'HLS AES key granted')

    // --- Return raw 16 bytes -------------------------------------------------
    res.setHeader('Content-Type', 'application/octet-stream')
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('Pragma', 'no-cache')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    return res.status(200).send(keyBytes)
  } catch (error: any) {
    logger.error(
      {
        email: (await getToken({ req, secret: process.env.NEXTAUTH_SECRET }))?.email,
        error: error?.message,
        stack: error?.stack,
        path: req.url,
      },
      'HLS AES key request failed'
    )
    return res.status(500).json({ error: 'Internal server error' })
  }
}
