import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/pages/api/auth/[...nextauth]'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  const email = session?.user?.email
  if (!email) return res.status(401).json({ error: 'Unauthorized' })

  const me = await prisma.user.findUnique({ where: { email }, select: { id: true, isAdmin: true } })
  if (!me?.isAdmin) return res.status(403).json({ error: 'Forbidden' })

  if (req.method === 'GET') {
    const { courseId } = req.query as { courseId?: string }
    if (!courseId) return res.status(400).json({ error: 'Missing courseId' })

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, code: true, title: true },
    })
    if (!course) return res.status(404).json({ error: 'Course not found' })

    const [videos, users, accessRows] = await Promise.all([
      prisma.video.findMany({ where: { courseId: course.id }, select: { id: true, title: true, r2Path: true } }),
      prisma.user.findMany({ select: { id: true, email: true } }),
      prisma.userVideoAccess.findMany({
        where: { video: { courseId: course.id } },
        select: { userId: true, videoId: true },
      }),
    ])

    // Assemble { userId: [videoId, ...] }
    const map = new Map<string, string[]>()
    for (const row of accessRows) {
      if (!map.has(row.userId)) map.set(row.userId, [])
      map.get(row.userId)!.push(row.videoId)
    }

    return res.status(200).json({
      course,
      videos,
      users: users.map(u => ({ id: u.id, email: u.email, allowedVideoIds: map.get(u.id) ?? [] })),
    })
  }

  if (req.method === 'POST') {
    // Body: { userId, courseId, videoIds[] } → Replace allowlist for that course
    const { userId, courseId, videoIds } = req.body as { userId?: string; courseId?: string; videoIds?: string[] }
    if (!userId || !courseId || !Array.isArray(videoIds)) {
      return res.status(400).json({ error: 'Missing userId/courseId/videoIds[]' })
    }

    // Ensure all provided videoIds belong to this course:
    const valid = await prisma.video.findMany({
      where: { courseId, id: { in: videoIds } },
      select: { id: true },
    })
    const validIds = new Set(valid.map(v => v.id))

    // transaction: delete existing rows for this user in this course → insert new set
    await prisma.$transaction([
      prisma.userVideoAccess.deleteMany({ where: { userId, video: { courseId } } }),
      prisma.userVideoAccess.createMany({
        data: [...validIds].map(id => ({ userId, videoId: id })),
        skipDuplicates: true,
      }),
    ])

    return res.status(204).end()
  }

  res.setHeader('Allow', ['GET', 'POST'])
  return res.status(405).json({ error: 'Method not allowed' })
}
