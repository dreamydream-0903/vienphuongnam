// src/pages/api/admin/users/index.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { getSession } from 'next-auth/react'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { authOptions }     from '../../auth/[...nextauth]'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'GET') {
        const users = await prisma.user.findMany({ select: { id: true, email: true, isAdmin: true } })
        return res.json(users)
    }

    // Create
    if (req.method === 'POST') {
        const session = await getServerSession(req, res, authOptions)
        if (!session?.user?.email) {
            res.status(401).json({ error: 'Unauthorized' })  // ← JSON error
            return
        }
        const { email } = req.body as { email: string }
        const user = await prisma.user.upsert({
            where: { email },
            create: { email },
            update: {},
        })
        res.status(200).json(user)
        return
    }

    // Not allowed
    res.setHeader('Allow', ['GET', 'POST'])
    res.status(405).json({ error: 'Method not allowed' })
}
