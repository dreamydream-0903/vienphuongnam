// src/pages/api/admin/users/[userId].ts
import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/pages/api/auth/[...nextauth]'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  const email = session?.user?.email
  if (!email) return res.status(401).end()

  const dbUser = await prisma.user.findUnique({ where: { email }, select: { isAdmin: true } })
  if (!dbUser?.isAdmin) return res.status(403).end()

  const { userId } = req.query
  if (typeof userId !== 'string') return res.status(400).json({ error: 'Invalid userId' })

  if (req.method === 'PUT') {
    const { isAdmin } = req.body
    if (typeof isAdmin !== 'boolean') return res.status(400).json({ error: 'Invalid isAdmin flag' })
    const updated = await prisma.user.update({ where: { id: userId }, data: { isAdmin } })
    return res.status(200).json({ id: updated.id, isAdmin: updated.isAdmin })
  }

  if (req.method === 'DELETE') {
    await prisma.user.delete({ where: { id: userId } })
    return res.status(200).json({ ok: true })
  }

  res.setHeader('Allow', ['PUT', 'DELETE'])
  return res.status(405).end()
}