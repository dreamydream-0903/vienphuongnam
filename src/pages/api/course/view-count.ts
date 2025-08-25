// /pages/api/course/view-count.ts
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'
import { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const session = await getServerSession(req, res, authOptions)
    if (!session?.user?.email) return res.status(401).end()

    const { courseCode } = req.query as { courseCode?: string }
    if (!courseCode) return res.status(400).json({ error: 'missing courseCode' })

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    })
    if (!user) return res.status(401).json({ error: 'unauthorized' })

    const course = await prisma.course.findUnique({
      where: { code: courseCode },
      select: { id: true },
    })
    if (!course) return res.status(404).json({ error: 'course not found' })

    if (!user || !course) return res.status(401).end()

    const watched = await prisma.watchTime.findMany({
      where: {
        userId: user.id,
        video: { courseId: course.id },
      },
      select: { videoId: true },
      distinct: ['videoId'],
    })


    const videoWatchCount = watched.length

    return res.status(200).json({ ok: true, videoWatchCount })

  } catch (error) {
    console.error('Error fetching view count:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}