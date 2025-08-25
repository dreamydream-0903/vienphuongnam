// src/pages/api/admin/import-videos.ts
import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'

interface ImportRequest {
    courseId: string
    r2Paths: string[]
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') return res.status(405).end()

    const session = await getServerSession(req, res, authOptions)
    const email = session?.user?.email
    if (!email) return res.status(401).json({ error: 'Unauthorized' })

    const dbUser = await prisma.user.findUnique({ where: { email }, select: { isAdmin: true } })
    if (!dbUser?.isAdmin) return res.status(403).json({ error: 'Forbidden' })

    const { courseId, r2Paths } = req.body as ImportRequest
    if (!courseId || typeof courseId !== 'string' || !Array.isArray(r2Paths)) {
        return res.status(400).json({ error: 'Missing or invalid payload' })
    }

    // List video folders under the course prefix
    const imported: string[] = []
    for (const r2Path of r2Paths) {
        const title = r2Path.replace(/.*\//, '').replace(/_/g, ' ')
        const upserted = await prisma.video.upsert({
            where: { r2Path },
            update: { title },
            create: { r2Path, title, course: { connect: { id: courseId } } }
        })
        imported.push(upserted.id)
    }

    return res.status(200).json({ imported: imported.length, r2Paths })
}
