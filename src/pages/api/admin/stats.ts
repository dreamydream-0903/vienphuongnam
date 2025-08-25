// pages/api/admin/stats.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/pages/api/auth/[...nextauth]'
import { prisma } from '@/lib/prisma'

// Returns watch record counts per video per day for the last 30 days
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Auth
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.email) return res.status(401).json({ error: 'Unauthorized' })
  const admin = await prisma.user.findUnique({ where: { email: session.user.email }, select: { isAdmin: true } })
  if (!admin?.isAdmin) return res.status(403).json({ error: 'Forbidden' })

  // Time window: last 30 days
  const fromDate = new Date()
  fromDate.setDate(fromDate.getDate() - 30)

  // Fetch records with video title
  const records = await prisma.watchRecord.findMany({
    where: { watchedAt: { gte: fromDate } },
    select: { watchedAt: true, video: { select: { title: true } } }
  })

  return res.status(200).json({ records })
}