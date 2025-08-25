// src/pages/api/drm/clearkey.ts
export const config = { api: { bodyParser: false } }

import type { NextApiRequest, NextApiResponse } from 'next'
import AWS from 'aws-sdk'
import { prisma } from '@/lib/prisma'


const kms = new AWS.KMS({ region: process.env.AWS_REGION })

interface KeystoreEntry { ciphertext: string; createdAt: string }
type Keystore = Record<string, KeystoreEntry>

async function unwrapDataKey(ct: string): Promise<Buffer> {
  const buff = Buffer.from(ct, 'base64')
  const resp = await kms.decrypt({ CiphertextBlob: buff }).promise()
  if (!resp.Plaintext) throw new Error('KMS returned no plaintext')
  return resp.Plaintext as Buffer
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ error: 'Method not allowed; use POST' })
  }

  try {
    // 1) Read the raw body into a Buffer
    const rawBody: Buffer = req.body instanceof Buffer
      ? req.body
      : await new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = []
        req.on('data', c => chunks.push(typeof c === 'string' ? Buffer.from(c) : c))
        req.on('end', () => resolve(Buffer.concat(chunks)))
        req.on('error', reject)
      })

    // 2) Try parsing as JSON { kids: [ base64 ], type: ... }
    let kidBuffers: Buffer[] = []
    try {
      const json = JSON.parse(rawBody.toString('utf8'))
      console.log('↪ [clearkey] JSON request body =', json)
      if (!Array.isArray(json.kids) || json.kids.length === 0) {
        throw new Error('Missing kids array')
      }
      kidBuffers = json.kids.map((b64: string) => Buffer.from(b64, 'base64'))
    } catch (_e) {
      // 3) Fallback to CENC PSSH parsing
      console.log('↪ [clearkey] Falling back to PSSH parsing')
      if (rawBody.length < 48) {
        return res.status(400).json({ error: 'initData too short; cannot parse KID' })
      }
      const count = rawBody.readUInt32BE(28)  // number of KIDs
      console.log('↪ [clearkey] PSSH kidCount =', count)
      for (let i = 0; i < count; i++) {
        const offset = 32 + i * 16
        if (rawBody.length >= offset + 16) {
          kidBuffers.push(rawBody.subarray(offset, offset + 16))
        }
      }
      if (kidBuffers.length === 0) {
        return res.status(400).json({ error: 'No KIDs extracted' })
      }
    }

    // 4) Load your keystore.json
    const { videoId } = req.query as { videoId: string }
    const record = await prisma.videoKeystore.findUnique({ where: { videoId } })
    console.log('🔥 fetched keystore for', videoId, '- record:', record)

    if (!record) {
      return res.status(500).json({ error: `No keystore for video ${videoId}` })
    }
    const keystore = record.keystore as Record<string, { ciphertext: string }>

    // 5) For each requested KID, decrypt and build the ClearKey response
    const keys = await Promise.all(
      kidBuffers.map(async buf => {
        const hex = buf.toString('hex')
        const entry = keystore[hex]
        if (!entry) {
          return Promise.reject(new Error(`KID ${hex} not in keystore`))
        }
        const plaintext = await unwrapDataKey(entry.ciphertext)
        return {
          kty: 'oct' as const,
          kid: buf.toString('base64').replace(/=+$/, ''),
          k: plaintext.toString('base64').replace(/=+$/, '')
        }
      })
    )

    res.setHeader('Content-Type', 'application/json')
    return res.status(200).json({ keys })

  } catch (err: any) {
    console.error('Error in /api/drm/clearkey:', err)
    return res.status(500).json({ error: err.message || 'Unknown error' })
  }
}
