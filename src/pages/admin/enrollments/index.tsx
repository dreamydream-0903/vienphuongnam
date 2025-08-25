import { useEffect, useState } from 'react'
import { GetServerSideProps }   from 'next'
import { getSession, signOut, useSession } from 'next-auth/react'
import {
  Container, Typography, Box,
  Table, TableHead, TableRow, TableCell, TableBody,
  Checkbox, Button, Paper, Stack
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
      id:     true,
      email:  true,
      courses:{ select:{ course:{ select:{ id:true, code:true } } } }
    },
    orderBy: { email: 'asc' }
  })
  const courses = await prisma.course.findMany({ select:{ id:true, code:true }, orderBy:{ code:'asc' } })
  return { props: { initialUsers: users, initialCourses: courses } }
}

export default function EnrollmentsPage({ initialUsers, initialCourses }: Props) {
  const { data: session } = useSession()
  const [users, setUsers]       = useState(initialUsers)
  const [courses] = useState(initialCourses)
  const [changes, setChanges]   = useState<Record<string,string[]>>({})

  // track checkbox toggles
  function toggle(userId: string, courseId: string) {
    const prev = users.find(u=>u.id===userId)!.courses.map(c=>c.course.id)
    const next = prev.includes(courseId)
      ? prev.filter(c=>c!==courseId)
      : [...prev, courseId]
    setChanges(chgs => ({ ...chgs, [userId]: next }))
  }

  async function save(userId: string) {
    const courseIds = changes[userId] ?? users.find(u=>u.id===userId)!.courses.map(c=>c.course.id)
    await fetch('/api/admin/enrollments', {
      method: 'POST',
      credentials:'include',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ userId, courseIds })
    })
    // reload page or re-fetch
    window.location.reload()
  }

  return (
    <Container sx={{ py:6 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={4}>
        <Typography variant="h4">User Enrollments</Typography>
        <Button onClick={()=>signOut({callbackUrl:'/'})}>Logout</Button>
      </Stack>

      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>User</TableCell>
              {courses.map(c=>(
                <TableCell key={c.id} align="center">{c.code}</TableCell>
              ))}
              <TableCell align="center">Save</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map(u=> {
              const orig = u.courses.map(x=>x.course.id)
              const upd  = changes[u.id] ?? orig

              return (
                <TableRow key={u.id}>
                  <TableCell>{u.email}</TableCell>
                  {courses.map(c=>(
                    <TableCell key={c.id} align="center">
                      <Checkbox
                        checked={upd.includes(c.id)}
                        onChange={()=>toggle(u.id, c.id)}
                      />
                    </TableCell>
                  ))}
                  <TableCell align="center">
                    {changes[u.id] ? (
                      <Button size="small" onClick={()=>save(u.id)}>Save</Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </Paper>
    </Container>
  )
}
