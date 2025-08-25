// src/pages/api/admin/check-admin.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { email } = req.query as { email?: string }
  if (!email) return res.status(400).json({ isAdmin: false })
  const user = await prisma.user.findUnique({ where: { email } })
  res.json({ isAdmin: Boolean(user?.isAdmin) })
}
