// pages/api/video/record-watch.ts
import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.email) return res.status(401).end()

  const { r2Path } = req.body
  console.log('[POST /record-watch] r2Path:', r2Path)

  if (!r2Path || typeof r2Path !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid r2Path' })
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  })
  if (!user) return res.status(401).end()

  const video = await prisma.video.findFirst({
    where: { r2Path },
    select: { id: true, courseId: true }
  })

  if (!video) return res.status(404).json({ error: 'Video not found' })

  // Insert watch record
  await prisma.watchRecord.create({
    data: {
      userId: user.id,
      videoId: video.id,
      courseId: video.courseId,
    },
  })

  return res.status(200).json({ ok: true })
}
