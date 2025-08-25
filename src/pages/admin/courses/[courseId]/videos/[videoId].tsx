// src/pages/admin/courses/[courseId]/videos/[videoId].tsx
import { GetServerSideProps } from 'next'
import { getSession } from 'next-auth/react'
import { prisma } from '@/lib/prisma'
import { useRouter } from 'next/router'
import { useState } from 'react'
import {
  Container, Typography, TextField,
  Button, Stack, Paper
} from '@mui/material'
import type { Video } from '@prisma/client'

export const getServerSideProps: GetServerSideProps<{ video: Video }>  = async (ctx) => {
  const session = await getSession({ req: ctx.req })
  if (!session?.user?.email) {
    return {
      redirect: {
        destination: `/api/auth/signin?callbackUrl=${ctx.resolvedUrl}`,
        permanent: false
      }
    }
  }

  const { courseId, videoId } = ctx.params as { courseId: string; videoId: string }
  const video = await prisma.video.findUnique({
    where: { id: videoId },
    select: { id: true, title: true, r2Path: true, courseId: true }
  })
  if (!video || video.courseId !== courseId) {
    return { notFound: true }
  }

  return { props: { video } }
}

interface EditVideoPageProps {
  video: Video
}

export default function EditVideoPage({ video }: EditVideoPageProps) {
  const router = useRouter()
  const [title, setTitle]   = useState(video.title)
  const [r2Path, setR2Path] = useState(video.r2Path)

  async function handleSave() {
    await fetch(`/api/admin/courses/${video.courseId}/videos/${video.id}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, r2Path }),
    })
    router.push(`/admin/courses/${video.courseId}/videos`)
  }

  return (
    <Container sx={{ py: 6 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h5" mb={2}>Edit Video</Typography>
        <Stack spacing={2}>
          <TextField
            label="Title"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
          <TextField
            label="R2 Path"
            value={r2Path}
            onChange={e => setR2Path(e.target.value)}
          />
          <Stack direction="row" spacing={2}>
            <Button variant="contained" onClick={handleSave}>Save</Button>
            <Button onClick={() => router.back()}>Cancel</Button>
          </Stack>
        </Stack>
      </Paper>
    </Container>
  )
}
