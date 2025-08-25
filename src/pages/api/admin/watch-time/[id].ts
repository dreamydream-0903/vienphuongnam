// pages/api/admin/watch-time/[id].ts
import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const session = await getServerSession(req, res, authOptions)
    if (!session?.user?.email) return res.status(401).end()

    // Ensure admin
    const admin = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { isAdmin: true },
    })
    if (!admin?.isAdmin) return res.status(403).end()

    const id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id

    if (!id) {
        return res.status(400).json({ error: 'Missing or invalid `id` in the URL' })
    }

    const recordId = parseInt(id, 10)

    if (Number.isNaN(recordId)) {
        return res.status(400).json({ error: '`id` must be a number' })
    }

    if (req.method === 'PUT') {
        const { totalSeconds } = req.body
        if (typeof totalSeconds !== 'number') {
            return res.status(400).json({ error: 'totalSeconds must be a number' })
        }
        const entry = await prisma.watchTime.update({
            where: { id: recordId },
            data: { totalSeconds },
        })
        return res.status(200).json({ entry })
    }

    return res.status(405).end()
}
