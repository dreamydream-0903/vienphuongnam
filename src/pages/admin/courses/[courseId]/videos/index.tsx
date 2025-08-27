// src/pages/admin/courses/[courseId]/videos/index.tsx
import { useState } from 'react'
import { GetServerSideProps } from 'next'
import { getSession, useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import {
  Container, Typography, Button, Table, TableHead,
  TableRow, TableCell, TableBody, Paper, Stack, Box
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import { prisma } from '@/lib/prisma'

interface Video { id: string; title: string; r2Path: string }
interface Props {
  session: any
  course: { id: string; code: string; title: string }
  videos: Video[]
}

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const session = await getSession({ req: ctx.req })
  const courseId = ctx.params?.courseId as string
  if (!session?.user?.email) {
    return {
      redirect: {
        destination: `/api/auth/signin?callbackUrl=/admin/courses/${courseId}/videos`,
        permanent: false
      }
    }
  }

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, code: true, title: true }
  })
  if (!course) {
    return { notFound: true }
  }

  const videos = await prisma.video.findMany({
    where: { courseId: course.id },
    select: { id: true, title: true, r2Path: true },
    orderBy: { title: 'asc' }
  })

  return { props: { session, course, videos } }
}

export default function VideoListAdmin({ course, videos }: Props) {
  const { data: session } = useSession()

  return (
    <Container sx={{ py: 6 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={4}>
        <Typography variant="h4">Videos for {course.code}</Typography>
        <Stack direction="row" spacing={2}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            component={Link}
            href={`/admin/courses/${course.id}/videos/new`}
          >
            New Video
          </Button>
          <Button
            variant="outlined"
            component={Link}
            href={`/admin/courses/${course.id}/access`}
          >
            Per-video access
          </Button>

          <Button onClick={() => signOut({ callbackUrl: '/' })}>Logout</Button>
        </Stack>
      </Stack>

      <Box mb={2}>
        <Link href="/admin/courses" passHref>
          <Button>{'<'} Back to Courses</Button>
        </Link>
      </Box>

      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Title</TableCell>
              <TableCell>R2 Path</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {videos.map(v => (
              <TableRow key={v.id}>
                <TableCell>{v.title}</TableCell>
                <TableCell>{v.r2Path}</TableCell>
                <TableCell align="right">
                  <Link href={`/admin/courses/${course.id}/videos/${v.id}`}>
                    Edit
                  </Link>
                  {' · '}
                  <Link href="#" onClick={async e => {
                    e.preventDefault()
                    if (!confirm(`Delete video "${v.title}"?`)) return
                    await fetch(`/api/admin/courses/${course.id}/videos/${v.id}`, {
                      method: 'DELETE',
                      credentials: 'include'
                    })
                    location.reload()
                  }}>
                    Delete
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Container>
  )
}
