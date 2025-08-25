// pages/api/admin/keys/[videoId].ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/pages/api/auth/[...nextauth]'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  const email = session?.user?.email
  if (!email) return res.status(401).json({ error: 'Unauthorized' })
  const user = await prisma.user.findUnique({ where: { email }, select: { isAdmin: true } })
  if (!user?.isAdmin) return res.status(403).json({ error: 'Forbidden' })

  const { videoId } = req.query
  if (typeof videoId !== 'string') {
    return res.status(400).json({ error: 'Invalid videoId' })
  }

  if (req.method === 'GET') {
    const entry = await prisma.videoKeystore.findUnique({ where: { videoId } })
    if (!entry) return res.status(404).json({ error: 'Not found' })
    return res.status(200).json({ entry })
  }

  if (req.method === 'PUT') {
    const { keystore } = req.body as { keystore: any }
    if (!keystore) {
      return res.status(400).json({ error: 'Missing keystore JSON' })
    }
    const entry = await prisma.videoKeystore.update({ where: { videoId }, data: { keystore } })
    return res.status(200).json({ entry })
  }

  if (req.method === 'DELETE') {
    await prisma.videoKeystore.delete({ where: { videoId } })
    return res.status(200).json({ ok: true })
  }

  res.setHeader('Allow', ['GET', 'PUT', 'DELETE'])
  return res.status(405).end()
}
