// src/pages/admin/courses/[id]/edit.tsx
import { GetServerSideProps } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/pages/api/auth/[...nextauth]'
import { prisma } from '@/lib/prisma'
import { useRouter } from 'next/router'
import { useState, useRef, useEffect } from 'react'
import type { Course } from '@prisma/client'
import {
  Container, Typography, TextField,
  Button, Stack, Paper, Snackbar, Alert, Box
} from '@mui/material'
import BackButton from '@/components/BackButton'

export const getServerSideProps: GetServerSideProps<{ course: Course }> = async (ctx) => {
  const { req, res, params } = ctx
  const courseId = params?.courseId as string
  const session = await getServerSession(req, res, authOptions)

  if (!session?.user?.email) {
    return { redirect: { destination: `/api/auth/signin?callbackUrl=/admin/courses/${courseId}/edit`, permanent: false } }
  }

  try {
    const course = await prisma.course.findUnique({
      where: { id: courseId }
    })
    if (!course) {
      return { notFound: true }
    }
    return { props: { course } }
  } catch (error) {
    console.error('Error fetching course:', error)
    return { notFound: true }
  }
}

export default function EditCoursePage({ course }: { course: { id: string; code: string; title: string } }) {
  const router = useRouter()
  const { courseId } = router.query as { courseId: string }
  const [r2Paths, setR2Paths] = useState<string[]>([])
  const [message, setMessage] = useState<{ severity: 'success' | 'error'; text: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Set webkitdirectory property imperatively to avoid TypeScript error
  useEffect(() => {
    if (fileInputRef.current) {
      (fileInputRef.current as any).webkitdirectory = true
    }
  }, [])

  const [code, setCode] = useState(course.code)
  const [title, setTitle] = useState(course.title)

  const openFolderPicker = () => {
    fileInputRef.current?.click()
  }

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    const paths = new Set<string>()
    for (let i = 0; i < files.length; i++) {
      const file = files[i] as any
      // webkitRelativePath gives full path inside the folder
      const rel: string = file.webkitRelativePath || file.name
      const segments = rel.split('/')
      if (segments.length >= 2) {
        paths.add(segments[1])
      }
    }
    setR2Paths(Array.from(paths))
  }

  async function handleSave() {
    await fetch(`/api/admin/courses/${course.id}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, title }),
    })
    router.push('/admin/courses')
  }

  const handleImport = async () => {
    try {
      const res = await fetch('/api/admin/import-videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId, r2Paths }),
      })
      const data = await res.json()
      if (res.ok) {
        setMessage({ severity: 'success', text: `Imported ${data.imported} folders` })
      } else {
        setMessage({ severity: 'error', text: data.error || 'Import failed' })
      }
    } catch {
      setMessage({ severity: 'error', text: 'Network error' })
    }
  }

  return (
    <Container sx={{ py: 6 }}>
      <Box sx={{ mb: 2 }}>
        <BackButton label="< Back to Admin Courses" />
      </Box>
      <Paper sx={{ p: 4, mb: 4 }}>
        <Typography variant="h5" mb={2}>Edit Course</Typography>
        <Stack spacing={2}>
          <TextField label="Code" value={code} onChange={e => setCode(e.target.value)} />
          <TextField label="Title" value={title} onChange={e => setTitle(e.target.value)} />
          <Stack direction="row" spacing={2}>
            <Button variant="contained" onClick={handleSave}>Save</Button>
            <Button onClick={() => router.back()}>Cancel</Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="*/*"
              // Enable folder selection in Chrome/WebKit
              multiple
              style={{ display: 'none' }}
              onChange={handleFiles}
            />

            {/* The webkitdirectory property is set imperatively in useEffect */}
            <Button variant="contained" onClick={openFolderPicker}>
              Select Folder
            </Button>
            {r2Paths.length > 0 && (
              <Box>
                <Typography variant="subtitle2">Folders to import:</Typography>
                <ul>
                  {r2Paths.map(p => <li key={p}>{p}</li>)}
                </ul>
              </Box>
            )}
            <Button
              variant="contained"
              disabled={r2Paths.length === 0}
              onClick={handleImport}
            >
              Import Selected Folders
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {message && (
        <Snackbar open autoHideDuration={6000} onClose={() => setMessage(null)}>
          <Alert severity={message.severity} sx={{ width: '100%' }}>
            {message.text}
          </Alert>
        </Snackbar>
      )}
    </Container>
  )
}
