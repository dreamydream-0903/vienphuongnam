// src/pages/api/admin/users/bulk.ts
import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/pages/api/auth/[...nextauth]'
import { prisma } from '@/lib/prisma'

interface BulkResult {
  email: string
  ok: boolean
  error?: string
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  // Authenticate admin
  const session = await getServerSession(req, res, authOptions)
  const email = session?.user?.email
  if (!email) return res.status(401).json({ error: 'Unauthorized' })
  const dbUser = await prisma.user.findUnique({ where: { email }, select: { isAdmin: true } })
  if (!dbUser?.isAdmin) return res.status(403).json({ error: 'Forbidden' })

  // Parse emails array
  const { emails } = req.body as { emails: string[] }
  if (!Array.isArray(emails)) {
    return res.status(400).json({ error: 'Invalid payload, expected emails array' })
  }

  // Bulk invite/upsert
  const results: BulkResult[] = []
  for (const userEmail of emails) {
    if (!userEmail) continue
    try {
      const user = await prisma.user.upsert({
        where: { email: userEmail },
        update: {},
        create: { email: userEmail, isAdmin: false }
      })
      results.push({ email: userEmail, ok: true })
    } catch (err: any) {
      results.push({ email: userEmail, ok: false, error: err.message })
    }
  }

  return res.status(200).json({ results })
}
