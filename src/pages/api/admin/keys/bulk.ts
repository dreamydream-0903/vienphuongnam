// pages/api/admin/keys/bulk.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/pages/api/auth/[...nextauth]'
import { prisma } from '@/lib/prisma'

// POST: bulk upsert key entries from array of { videoId, kid, key }
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).end()
  }
  const session = await getServerSession(req, res, authOptions)
  const email = session?.user?.email
  if (!email) return res.status(401).json({ error: 'Unauthorized' })
  const user = await prisma.user.findUnique({ where: { email }, select: { isAdmin: true } })
  if (!user?.isAdmin) return res.status(403).json({ error: 'Forbidden' })

  const items = req.body as { videoId: string; keystore: any }[]
  if (!Array.isArray(items)) {
    return res.status(400).json({ error: 'Invalid payload, expected array' })
  }

  const results: { videoId: string; ok: boolean; error?: string }[] = []
  for (const { videoId, keystore } of items) {
    try {
      await prisma.videoKeystore.upsert({
        where: { videoId },
        update: { keystore },
        create: { videoId, keystore }
      })
      results.push({ videoId, ok: true })
    } catch (err: any) {
      results.push({ videoId, ok: false, error: err.message })
    }
  }
  return res.status(200).json({ results })
}