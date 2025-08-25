// pages/admin/watch-time.tsx

import { GetServerSideProps } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../api/auth/[...nextauth]'
import { prisma } from '@/lib/prisma'
import BackButton from '@/components/BackButton'
import {
  Container, Typography, Box, Table, TableHead, TableRow,
  TableCell, TableBody, Paper, IconButton, Dialog,
  DialogTitle, DialogContent, TextField, DialogActions,
  Button,
} from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import { useState } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid
} from 'recharts'

interface Stat {
  id: number
  userEmail: string
  courseCode: string
  videoTitle: string
  totalSeconds: number
}

interface Props {
  stats: Stat[]
}

function formatSeconds(sec: number) {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':')
}

function parseHMS(h: number, m: number, s: number) {
  return h * 3600 + m * 60 + s
}

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions)
  const email = session?.user?.email

  if (!email) {
    return { redirect: { destination: '/api/auth/signin', permanent: false } }
  }

  const admin = await prisma.user.findUnique({
    where: { email },
    select: { isAdmin: true },
  })
  if (!admin?.isAdmin) {
    return { redirect: { destination: '/', permanent: false } }
  }

  const entries = await prisma.watchTime.findMany({
    include: { user: true, video: { include: { course: true } } },
  })

  const stats: Stat[] = entries.map((e) => ({
    id: e.id,
    userEmail: e.user.email!,
    courseCode: e.video.course.code,
    videoTitle: e.video.title,
    totalSeconds: e.totalSeconds,
  }))

  return { props: { stats } }
}

export default function AdminWatchTime({ stats: initialStats }: Props) {
  const [stats, setStats] = useState<Stat[]>(initialStats)
  const [editing, setEditing] = useState<Stat | null>(null)
  const [hours, setHours] = useState(0)
  const [minutes, setMinutes] = useState(0)
  const [seconds, setSeconds] = useState(0)

  const chartData = stats.map(s => ({
    videoTitle: s.videoTitle,
    totalMinutes: Math.round(s.totalSeconds / 60),
  }))

  const openEditor = (row: Stat) => {
    setEditing(row)
    const h = Math.floor(row.totalSeconds / 3600)
    const m = Math.floor((row.totalSeconds % 3600) / 60)
    const s = row.totalSeconds % 60
    setHours(h); setMinutes(m); setSeconds(s)
  }

  const saveEdit = async () => {
    if (!editing) return
    const totalSeconds = parseHMS(hours, minutes, seconds)
    const res = await fetch(`/api/admin/watch-time/${editing.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ totalSeconds }),
    })
    if (res.ok) {
      setStats((prev) =>
        prev.map((r) =>
          r.id === editing.id ? { ...r, totalSeconds } : r
        )
      )
      setEditing(null)
    } else {
      console.error('Update failed', await res.text())
    }
  }

  return (
    <Container sx={{ py: 4 }}>
      <Box sx={{ mb: 2 }}>
        <BackButton label="< Back to Dashboard" />
      </Box>

      <Typography variant="h4" gutterBottom>
        Watch-Time Records
      </Typography>

      <Box sx={{ width: '100%', height: 300, mb: 4 }}>
        <ResponsiveContainer>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="videoTitle" />
            <YAxis label={{ value: 'Minutes', angle: -90, position: 'insideLeft' }} />
            <Tooltip formatter={(value: any) => [`${value} min`, 'Watched']} />
            <Bar dataKey="totalMinutes" />
          </BarChart>
        </ResponsiveContainer>
      </Box>

      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>User</TableCell>
              <TableCell>Course</TableCell>
              <TableCell>Video</TableCell>
              <TableCell align="right">Time Watched</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {stats.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.userEmail}</TableCell>
                <TableCell>{row.courseCode}</TableCell>
                <TableCell>{row.videoTitle}</TableCell>
                <TableCell align="right">
                  {formatSeconds(row.totalSeconds)}
                </TableCell>
                <TableCell align="center">
                  <IconButton onClick={() => openEditor(row)}>
                    <EditIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={!!editing} onClose={() => setEditing(null)}>
        <DialogTitle>Edit Watch Time</DialogTitle>
        <DialogContent sx={{ display: 'flex', gap: 2, mt: 1 }}>
          <TextField
            label="Hours"
            type="number"
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
            slotProps={{ htmlInput: { min: 0 } }}
            fullWidth
            margin="normal"
          />
          <TextField
            label="Minutes"
            type="number"
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
            slotProps={{ htmlInput: { min: 0, max: 59 } }}
            fullWidth
            margin="normal"
          />
          <TextField
            label="Seconds"
            type="number"
            value={seconds}
            onChange={(e) => setSeconds(Number(e.target.value))}
            slotProps={{ htmlInput: { min: 0, max: 59 } }}
            fullWidth
            margin="normal"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditing(null)}>Cancel</Button>
          <Button variant="contained" onClick={saveEdit} color="primary">Save</Button>
        </DialogActions>
      </Dialog>
    </Container>
  )
}
