// src/pages/api/admin/enrollments/[userId].ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/pages/api/auth/[...nextauth]'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow GET and PUT
  if (req.method !== 'GET' && req.method !== 'PUT') {
    res.setHeader('Allow', ['GET', 'PUT'])
    return res.status(405).end()
  }

  // Authenticate and ensure admin
  const session = await getServerSession(req, res, authOptions)
  const email = session?.user?.email
  if (!email) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  const userRecord = await prisma.user.findUnique({ where: { email }, select: { isAdmin: true } })
  if (!userRecord?.isAdmin) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const { userId } = req.query
  if (typeof userId !== 'string') {
    return res.status(400).json({ error: 'Invalid userId' })
  }

  if (req.method === 'GET') {
    // Fetch enrolled course IDs for the given user
    const enrollments = await prisma.userCourse.findMany({
      where: { userId },
      select: { courseId: true }
    })
    const courseIds = enrollments.map(e => e.courseId)
    return res.status(200).json({ courseIds })
  }

  if (req.method === 'PUT') {
    const { courseIds } = req.body as { courseIds?: string[] }
    if (!Array.isArray(courseIds)) {
      return res.status(400).json({ error: 'Missing or invalid courseIds' })
    }

    // Replace enrollments: delete old and insert new
    await prisma.userCourse.deleteMany({ where: { userId } })

    // Create new enrollments in a batch
    const createData = courseIds.map(courseId => ({ userId, courseId }))
    await prisma.userCourse.createMany({ data: createData })

    return res.status(200).json({ ok: true })
  }
}
