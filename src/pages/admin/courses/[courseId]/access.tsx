import { GetServerSideProps } from 'next'
import { getSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import {
  Container, Typography, Box, Paper, Stack, FormControl, InputLabel, Select, MenuItem,
  FormGroup, FormControlLabel, Checkbox, Button
} from '@mui/material'

interface Video { id: string; title: string; r2Path: string }
interface Course { id: string; code: string; title: string }
interface UserRow { id: string; email: string; allowedVideoIds: string[] }

export const getServerSideProps: GetServerSideProps<{ courseId: string }> = async (ctx) => {
  const session = await getSession({ req: ctx.req })
  if (!session?.user?.email) return { redirect: { destination: '/', permanent: false } }
  return { props: { courseId: ctx.params!.courseId as string } }
}

export default function AccessPage({ courseId }: { courseId: string }) {
  const router = useRouter()
  const [course, setCourse] = useState<Course | null>(null)
  const [videos, setVideos] = useState<Video[]>([])
  const [users, setUsers] = useState<UserRow[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string>('')

  useEffect(() => {
    const load = async () => {
      const res = await fetch(`/api/admin/video-access?courseId=${courseId}`)
      const data = await res.json()
      setCourse(data.course)
      setVideos(data.videos)
      setUsers(data.users)
    }
    load()
  }, [courseId])

  const selected = users.find(u => u.id === selectedUserId)

  const toggleVideo = (vid: string) => {
    if (!selected) return
    const next = new Set(selected.allowedVideoIds)
    next.has(vid) ? next.delete(vid) : next.add(vid)
    setUsers(users.map(u => u.id === selectedUserId ? { ...u, allowedVideoIds: [...next] } : u))
  }

  const save = async () => {
    if (!selected) return
    await fetch('/api/admin/video-access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: selected.id, courseId, videoIds: selected.allowedVideoIds }),
    })
  }

  return (
    <Container sx={{ py: 5 }}>
      <Typography variant="h4" gutterBottom>Per-video Access · {course?.code} – {course?.title}</Typography>
      <Paper sx={{ p: 3 }}>
        <Stack direction="row" spacing={3} alignItems="center">
          <FormControl sx={{ minWidth: 320 }}>
            <InputLabel>User</InputLabel>
            <Select
              label="User"
              value={selectedUserId}
              onChange={e => setSelectedUserId(e.target.value)}
            >
              {users.map(u => <MenuItem key={u.id} value={u.id}>{u.email}</MenuItem>)}
            </Select>
          </FormControl>

          <Button variant="outlined" onClick={() => router.back()}>Back</Button>
        </Stack>

        {selected && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="h6" gutterBottom>Allowed videos (leave empty = allow all)</Typography>
            <FormGroup>
              {videos.map(v => (
                <FormControlLabel
                  key={v.id}
                  control={
                    <Checkbox
                      checked={selected.allowedVideoIds.includes(v.id)}
                      onChange={() => toggleVideo(v.id)}
                    />
                  }
                  label={`${v.title} — ${v.r2Path}`}
                />
              ))}
            </FormGroup>
            <Button sx={{ mt: 2 }} variant="contained" onClick={save}>Save</Button>
          </Box>
        )}
      </Paper>
    </Container>
  )
}
