// pages/api/admin/keys/index.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/pages/api/auth/[...nextauth]'
import { prisma } from '@/lib/prisma'

// GET: list all keys, optionally filtered by courseId
// POST: create a new key entry
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  const email = session?.user?.email
  if (!email) return res.status(401).json({ error: 'Unauthorized' })
  const user = await prisma.user.findUnique({ where: { email }, select: { isAdmin: true } })
  if (!user?.isAdmin) return res.status(403).json({ error: 'Forbidden' })

  if (req.method === 'GET') {
    const keys = await prisma.videoKeystore.findMany()
    return res.status(200).json({ keys })
  }

  if (req.method === 'POST') {
    const { videoId, keystore } = req.body as { videoId: string; keystore: any }
    if (!videoId || !keystore) {
      return res.status(400).json({ error: 'Missing videoId or keystore JSON' })
    }
    const entry = await prisma.videoKeystore.create({ data: { videoId, keystore } })
    return res.status(201).json({ entry })
  }

  res.setHeader('Allow', ['GET', 'POST'])
  return res.status(405).end()
}