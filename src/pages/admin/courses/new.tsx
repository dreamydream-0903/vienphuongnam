// src/pages/admin/courses/new.tsx
import { useRouter } from 'next/router'
import { useState } from 'react'
import { getSession } from 'next-auth/react'
import type { GetServerSideProps } from 'next'
import {
  Container, Typography, TextField,
  Button, Stack, Paper
} from '@mui/material'

export default function NewCoursePage() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [title, setTitle] = useState('')

  async function handleSubmit() {
    await fetch('/api/admin/courses', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, title }),
    })
    router.push('/admin/courses')
  }

  return (
    <Container sx={{ py: 6 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h5" mb={2}>Create New Course</Typography>
        <Stack spacing={2}>
          <TextField label="Code" value={code} onChange={e => setCode(e.target.value)} />
          <TextField label="Title" value={title} onChange={e => setTitle(e.target.value)} />
          <Stack direction="row" spacing={2}>
            <Button variant="contained" onClick={handleSubmit}>Save</Button>
            <Button onClick={() => router.back()}>Cancel</Button>
          </Stack>
        </Stack>
      </Paper>
    </Container>
  )
}

// Protect via getServerSideProps
export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getSession({ req: ctx.req })
  if (!session?.user?.email) {
    return { redirect: { destination: '/api/auth/signin?callbackUrl=/admin/courses/new', permanent: false } }
  }
  return { props: {} }
}
