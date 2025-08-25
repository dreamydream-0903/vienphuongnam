// /pages/api/video/has-key.ts
import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session || !session.user?.email) return res.status(401).json({ ok: false })

  const { videoId } = req.query
  if (!videoId || typeof videoId !== 'string') return res.status(400).json({ error: 'Missing videoId' })

  const entry = await prisma.videoKeystore.findUnique({
    where: { videoId }
  })

  return res.status(200).json({ ok: !!entry })
}
