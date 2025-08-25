import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.email) return res.status(401).end()

  const { videoId, seconds } = req.body as { videoId?: string; seconds?: number }
  if (!videoId || typeof seconds !== 'number') {
    return res.status(400).json({ error: 'Missing videoId or seconds' })
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return res.status(401).end()

  // Upsert the watch-time record, adding seconds
  await prisma.watchTime.upsert({
    where: { userId_videoId: { userId: user.id, videoId } },
    create: {
      userId: user.id,
      videoId,
      totalSeconds: seconds
    },
    update: {
      totalSeconds: { increment: seconds }
    }
  })

  return res.status(200).json({ ok: true })
}
