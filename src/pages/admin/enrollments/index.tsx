import { useEffect, useState, useMemo } from 'react'
import { GetServerSideProps } from 'next'
import { getSession, signOut, useSession } from 'next-auth/react'
import {
  Container, Typography, Box,
  Table, TableHead, TableRow, TableCell, TableBody,
  Checkbox, Button, Paper, Stack,
  FormControl, InputLabel, Select, MenuItem
} from '@mui/material'
import { prisma } from '@/lib/prisma'

interface UserRow {
  id: string
  email: string
  courses: { course: { id: string; code: string } }[]
}
interface CourseCol { id: string; code: string }

interface Props {
  initialUsers: UserRow[]
  initialCourses: CourseCol[]
}

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const session = await getSession({ req: ctx.req })
  if (!session?.user?.email) {
    return {
      redirect: {
        destination: `/api/auth/signin?callbackUrl=/admin/enrollments`,
        permanent: false
      }
    }
  }

  // reuse the same GET logic
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      courses: { select: { course: { select: { id: true, code: true } } } }
    },
    orderBy: { email: 'asc' }
  })
  const courses = await prisma.course.findMany({ select: { id: true, code: true }, orderBy: { code: 'asc' } })
  return { props: { initialUsers: users, initialCourses: courses } }
}

export default function EnrollmentsPage({ initialUsers, initialCourses }: Props) {
  const { data: session } = useSession()
  const [users, setUsers] = useState(initialUsers)
  const [courses] = useState(initialCourses)
  const [changes, setChanges] = useState<Record<string, string[]>>({})
  const [saving, setSaving] = useState(false)

  const [filterCourseId, setFilterCourseId] = useState<'ALL' | string>('ALL')

  const visibleCourses = useMemo(
    () => (filterCourseId === 'ALL'
      ? courses
      : courses.filter(c => c.id === filterCourseId)),
    [courses, filterCourseId]
  )

  const hasChanges = useMemo(() => Object.keys(changes).length > 0, [changes])

  // track checkbox toggles
  function toggle(userId: string, courseId: string) {
    const orig = users.find(u => u.id === userId)!.courses.map(c => c.course.id)
    const current = changes[userId] ?? orig
    const next = current.includes(courseId)
      ? current.filter(c => c !== courseId)
      : [...current, courseId]
    setChanges(chgs => ({ ...chgs, [userId]: next }))
  }

  async function saveAll() {
    if (!hasChanges) return
    try {
      setSaving(true)
      const payloads = Object.entries(changes).map(([userId, courseIds]) =>
        fetch('/api/admin/enrollments', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, courseIds })
        })
      )
      const results = await Promise.allSettled(payloads)

      // Option A: Hard refresh for simplicity/reliability
      window.location.reload()

      // Option B (no refresh): update local state then clear changes
      // const updatedUsers = users.map(u => {
      //   const override = changes[u.id]
      //   if (!override) return u
      //   return {
      //     ...u,
      //     courses: override.map(id => ({ course: { id, code: courses.find(c=>c.id===id)!.code } }))
      //   }
      // })
      // setUsers(updatedUsers)
      // setChanges({})
    } finally {
      setSaving(false)
    }
  }

  function clearChanges() {
    setChanges({})
  }

  return (
    <Container sx={{ py: 6 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={4}>
        <Typography variant="h4">User Enrollments</Typography>
        <Button onClick={() => signOut({ callbackUrl: '/' })}>Logout</Button>
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} mb={2} alignItems="center">
        <FormControl size="small" sx={{ minWidth: 240 }}>
          <InputLabel id="course-filter-label">Filter by course</InputLabel>
          <Select
            labelId="course-filter-label"
            label="Filter by course"
            value={filterCourseId}
            onChange={(e) => setFilterCourseId(e.target.value as any)}
          >
            <MenuItem value="ALL"><em>All courses</em></MenuItem>
            {courses.map(c => (
              <MenuItem key={c.id} value={c.id}>{c.code}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <Stack direction="row" spacing={2}>
          <Button
            variant="contained"
            disabled={!hasChanges || saving}
            onClick={saveAll}
          >
            {saving ? 'Saving…' : 'Save all changes'}
          </Button>
          <Button
            variant="outlined"
            disabled={!hasChanges || saving}
            onClick={clearChanges}
          >
            Clear pending changes
          </Button>
        </Stack>
      </Stack>

      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>User</TableCell>
              {visibleCourses.map(c => (
                <TableCell key={c.id} align="center">{c.code}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map(u => {
              const orig = u.courses.map(x => x.course.id)
              const upd = changes[u.id] ?? orig

              return (
                <TableRow key={u.id}>
                  <TableCell>{u.email}</TableCell>
                  {visibleCourses.map(c => (
                    <TableCell key={c.id} align="center">
                      <Checkbox
                        checked={upd.includes(c.id)}
                        onChange={() => toggle(u.id, c.id)}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </Paper>
    </Container>
  )
}
