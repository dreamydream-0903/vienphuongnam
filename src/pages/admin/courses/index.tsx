import { useState } from 'react'
import { GetServerSideProps } from 'next'
import { getSession, useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import {
  Container, Typography, Button,
  Table, TableHead, TableRow, TableCell, TableBody,
  Paper, Stack,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import { prisma } from '@/lib/prisma'

interface Course { id: string; code: string; title: string }

interface Props { session: any; courses: Course[] }

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const session = await getSession({ req: ctx.req })
  if (!session?.user?.email) {
    return {
      redirect: { destination: '/api/auth/signin?callbackUrl=/admin/courses', permanent: false }
    }
  }
  const courses = await prisma.course.findMany({ select: { id: true, code: true, title: true }, orderBy: { code: 'asc' } })
  return { props: { session, courses } }
}

export default function AdminCourses({ courses }: Props) {
  const { data: session } = useSession()

  return (
    <Container sx={{ py: 6 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={4}>
        <Typography variant="h4">Admin → Courses</Typography>
        <Stack direction="row" spacing={2}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            component={Link}
            href="/admin/courses/new"
          >
            New Course
          </Button>
          <Button onClick={() => signOut({ callbackUrl: '/' })}>Logout</Button>
        </Stack>
      </Stack>

      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Code</TableCell>
              <TableCell>Title</TableCell>
              <TableCell align="right">Videos</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {courses.map(c => (
              <TableRow key={c.id}>
                <TableCell>{c.code}</TableCell>
                <TableCell>{c.title}</TableCell>
                <TableCell align="right">
                  <Link href={`/admin/courses/${c.id}/videos`}>Manage Videos</Link>
                </TableCell>
                <TableCell align="right">
                  <Link href={`/admin/courses/${c.id}/edit`}>Edit</Link> ·
                  <Link href="#" onClick={async e => {
                    e.preventDefault()
                    if (!confirm(`Delete course ${c.code}?`)) return
                    await fetch(`/api/admin/courses/${c.id}`, {
                      method: 'DELETE',
                      credentials: 'include'
                    })
                    location.reload()
                  }}>Delete</Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Container>
  )
}
