import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions }      from '../../auth/[...nextauth]'
import { prisma }           from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.email) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'GET') {
    const list = await prisma.course.findMany({ orderBy: { code: 'asc' }})
    return res.json(list)
  }

  if (req.method === 'POST') {
    const { code, title } = req.body as { code: string; title: string }
    const course = await prisma.course.create({ data: { code, title }})
    return res.status(201).json(course)
  }

  res.setHeader('Allow', ['GET','POST'])
  res.status(405).json({ error: 'Method not allowed' })
}
