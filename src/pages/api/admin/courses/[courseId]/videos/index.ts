// src/pages/api/admin/courses/[courseId]/videos/index.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions }      from '../../../../auth/[...nextauth]'
import { prisma }           from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.email) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { courseId } = req.query as { courseId: string }

  if (req.method === 'GET') {
    const videos = await prisma.video.findMany({
      where: { courseId },
      orderBy: { title: 'asc' }
    })
    return res.json(videos)
  }

  if (req.method === 'POST') {
    const { title, r2Path } = req.body as { title: string; r2Path: string }
    const v = await prisma.video.create({
      data: { courseId, title, r2Path }
    })
    return res.status(201).json(v)
  }

  res.setHeader('Allow', ['GET','POST'])
  res.status(405).json({ error: 'Method not allowed' })
}
