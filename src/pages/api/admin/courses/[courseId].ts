import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions }      from '../../auth/[...nextauth]'
import { prisma }           from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.email) return res.status(401).json({ error: 'Unauthorized' })

  const { id } = req.query as { id: string }

  if (req.method === 'PUT') {
    const { code, title } = req.body
    const updated = await prisma.course.update({
      where: { id },
      data: { code, title },
    })
    return res.json(updated)
  }

  if (req.method === 'DELETE') {
    await prisma.course.delete({ where: { id } })
    return res.status(204).end()
  }

  res.setHeader('Allow', ['PUT','DELETE'])
  res.status(405).json({ error: 'Method not allowed' })
}
