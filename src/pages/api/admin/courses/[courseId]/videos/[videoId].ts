// src/pages/api/admin/courses/[courseId]/videos/[videoId].ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions }      from '../../../../auth/[...nextauth]'
import { prisma }           from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.email) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { courseId, videoId } = req.query as { courseId: string; videoId: string }

  if (req.method === 'PUT') {
    const { title, r2Path } = req.body as { title: string; r2Path: string }
    const updated = await prisma.video.update({
      where: { id: videoId },
      data: { title, r2Path }
    })
    return res.json(updated)
  }

  if (req.method === 'DELETE') {
    await prisma.video.delete({ where: { id: videoId } })
    return res.status(204).end()
  }

  res.setHeader('Allow', ['PUT','DELETE'])
  res.status(405).json({ error: 'Method not allowed' })
}
