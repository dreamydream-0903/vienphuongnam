// src/pages/admin/courses/[courseId]/videos/new.tsx
import { useRouter } from 'next/router'
import { useState } from 'react'
import { getSession } from 'next-auth/react'
import type { GetServerSideProps } from 'next'
import {
  Container, Typography, TextField,
  Button, Stack, Paper
} from '@mui/material'

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const courseId = ctx.params?.courseId as string
  const session = await getSession({ req: ctx.req })
  if (!session?.user?.email) {
    return {
      redirect: {
        destination: `/api/auth/signin?callbackUrl=/admin/courses/${courseId}/videos/new`,
        permanent: false
      }
    }
  }
  return { props: {} }
}

export default function NewVideoPage() {
  const router = useRouter()
  const { courseId } = router.query as { courseId: string }
  const [title, setTitle]   = useState('')
  const [r2Path, setR2Path] = useState('')

  async function handleSave() {
    await fetch(`/api/admin/courses/${courseId}/videos`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, r2Path }),
    })
    router.push(`/admin/courses/${courseId}/videos`)
  }

  return (
    <Container sx={{ py: 6 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h5" mb={2}>New Video</Typography>
        <Stack spacing={2}>
          <TextField
            label="Title"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
          <TextField
            label="R2 Path (e.g. encrypted/…/manifest.mpd)"
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
