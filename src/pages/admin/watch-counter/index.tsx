// src/pages/admin/watch-counter.tsx

import { GetServerSideProps } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../api/auth/[...nextauth]'
import { prisma } from '@/lib/prisma'
import { useRouter } from 'next/router'
import BackButton from '@/components/BackButton'
import {
    Container,
    Typography,
    Box,
    Button,
    Table,
    TableHead,
    TableRow,
    TableCell,
    TableBody,
} from '@mui/material'

interface Stat {
    userEmail: string
    courseCode: string
    videoTitle: string
    watchCount: number
}

interface Props {
    stats: Stat[]
}

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
    const session = await getServerSession(ctx.req, ctx.res, authOptions)
    const email = session?.user?.email

    // 1) Ensure logged in
    if (!email) {
        return {
            redirect: { destination: '/api/auth/signin', permanent: false }
        }
    }

    // 2) Fetch full user record to check isAdmin
    const user = await prisma.user.findUnique({
        where: { email },
        select: { isAdmin: true }
    })

    if (!user?.isAdmin) {
        return {
            redirect: { destination: '/', permanent: false }
        }
    }

    // 1) Group by userId + videoId to count watches per video
    const raw = await prisma.watchRecord.groupBy({
        by: ['userId', 'videoId'],
        _count: { id: true },
    })

    // 2) Enrich with user, video & course details
    const stats: Stat[] = await Promise.all(raw.map(async r => {
        const user = await prisma.user.findUnique({ where: { id: r.userId } })
        const video = await prisma.video.findUnique({
            where: { id: r.videoId },
            include: { course: true }
        })
        return {
            userEmail: user?.email || '—',
            courseCode: video?.course.code || '—',
            videoTitle: video?.title || '—',
            watchCount: r._count.id,
        }
    }))

    return { props: { stats } }
}

export default function WatchCounterAdmin({ stats }: Props) {
    const router = useRouter()

    return (
        <Container sx={{ py: 4 }}>
            <Box sx={{ mb: 2 }}>
                <BackButton label="< Back to Dashboard" />
            </Box>

            <Typography variant="h4" gutterBottom>
                Watch Counter Dashboard
            </Typography>

            <Table>
                <TableHead>
                    <TableRow>
                        <TableCell>User Email</TableCell>
                        <TableCell>Course Code</TableCell>
                        <TableCell>Video Title</TableCell>
                        <TableCell align="right">Watch Count</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {stats.map((row, idx) => (
                        <TableRow key={idx}>
                            <TableCell>{row.userEmail}</TableCell>
                            <TableCell>{row.courseCode}</TableCell>
                            <TableCell>{row.videoTitle}</TableCell>
                            <TableCell align="right">{row.watchCount}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </Container>
    )
}
