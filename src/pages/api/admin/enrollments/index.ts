// src/pages/api/admin/enrollments/index.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions }      from '../../auth/[...nextauth]'
import { prisma }           from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.email) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (req.method === 'GET') {
    // fetch all users + their enrolled course codes
    const users = await prisma.user.findMany({
      select: {
        id:     true,
        email:  true,
        courses: { select: { course: { select: { id: true, code: true } } } }
      },
      orderBy: { email: 'asc' }
    })
    const courses = await prisma.course.findMany({ select: { id: true, code: true }, orderBy: { code: 'asc' } })

    return res.json({ users, courses })
  }

  if (req.method === 'POST') {
    // body = { userId, courseIds: string[] }
    const { userId, courseIds } = req.body as { userId: string; courseIds: string[] }

    // delete any existing, then re-create the selected
    await prisma.userCourse.deleteMany({ where: { userId } })
    const data = courseIds.map(cid => ({ userId, courseId: cid }))
    await prisma.userCourse.createMany({ data })
    return res.status(204).end()
  }

  res.setHeader('Allow', ['GET','POST'])
  res.status(405).json({ error: 'Method not allowed' })
}
