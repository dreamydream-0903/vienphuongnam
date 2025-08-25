// src/pages/admin/users/index.tsx
import { useState, ChangeEvent } from 'react'
import { GetServerSideProps } from 'next'
import { getServerSession } from 'next-auth/next'
import { signOut } from 'next-auth/react'
import { authOptions } from '@/pages/api/auth/[...nextauth]'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'
import {
  Container,
  Typography,
  Button,
  TextField,
  Box,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Paper,
  Stack,
  Snackbar,
  Alert,
  Switch,
  Checkbox
} from '@mui/material'
import BackButton from '@/components/BackButton'
import EnrollmentEditor from '@/components/EnrollmentEditor'

interface UserRow { id: string; email: string; isAdmin: boolean }
interface BulkCandidate { email: string; checked: boolean }
interface BulkResult { email: string; ok: boolean; error?: string }
interface Props { users: UserRow[] }

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions)
  const email = session?.user?.email
  if (!email) {
    return { redirect: { destination: '/api/auth/signin', permanent: false } }
  }
  const admin = await prisma.user.findUnique({ where: { email }, select: { isAdmin: true } })
  if (!admin?.isAdmin) {
    return { redirect: { destination: '/', permanent: false } }
  }
  const users = await prisma.user.findMany({
    select: { id: true, email: true, isAdmin: true },
    orderBy: { email: 'asc' },
  })
  return { props: { users } }
}

export default function AdminUsersPage({ users: initialUsers }: Props) {
  const [users, setUsers] = useState<UserRow[]>(initialUsers)
  const [email, setEmail] = useState('')
  const [candidates, setCandidates] = useState<BulkCandidate[]>([])
  const [bulkResults, setBulkResults] = useState<BulkResult[]>([])
  const [message, setMessage] = useState<{ severity: 'success' | 'error' | 'warning'; text: string } | null>(null)
  const [editingUser, setEditingUser] = useState<string | null>(null)

  // Invite a single user
  const inviteSingle = async () => {
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    if (!res.ok) {
      if (res.status === 401) {
        window.location.href = '/api/auth/signin?callbackUrl=/admin/users'
        return
      }
      setMessage({ severity: 'error', text: 'Invite failed' })
      return
    }
    const newUser = await res.json()
    setUsers((list) => [...list, newUser])
    setEmail('')
    setMessage({ severity: 'success', text: `Invited ${newUser.email}` })
  }

  // Parse XLSX to candidates with checkboxes
  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const data = await file.arrayBuffer()
    const wb = XLSX.read(data, { type: 'array' })
    const list = XLSX.utils.sheet_to_json<{ email: string }>(
      wb.Sheets[wb.SheetNames[0]],
      { header: ['email'], range: 1 }
    )
    const emails = list
      .map(r => r.email.trim())
      .filter(e => e)
      .map(email => ({ email, checked: true }))
    setCandidates(emails)
    setBulkResults([])
  }

  // Toggle candidate selection
  const toggleCandidate = (idx: number) => {
    setCandidates(cands =>
      cands.map((c, i) => i === idx ? { ...c, checked: !c.checked } : c)
    )
  }

  // Import selected candidates
  const importSelected = async () => {
    const selected = candidates.filter(c => c.checked).map(c => c.email)
    if (selected.length === 0) {
      setMessage({ severity: 'warning', text: 'No emails selected' })
      return
    }
    const res = await fetch('/api/admin/users/bulk', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emails: selected }),
    })
    if (!res.ok) {
      setMessage({ severity: 'error', text: 'Bulk import failed' })
      return
    }
    const { results } = await res.json()
    setBulkResults(results)
    // Refresh users list
    const fresh = await fetch('/api/admin/users', { credentials: 'include' }).then(r => r.json())
    setUsers(fresh)
    setMessage({ severity: 'success', text: 'Bulk import complete' })
  }

  // Toggle admin privilege
  const handleToggle = async (userId: string, newAdmin: boolean) => {
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isAdmin: newAdmin }),
    })
    if (!res.ok) {
      setMessage({ severity: 'error', text: 'Failed to update user' })
      return
    }
    setUsers(u => u.map(x => x.id === userId ? { ...x, isAdmin: newAdmin } : x))
    setMessage({ severity: 'success', text: `User ${newAdmin ? 'granted' : 'revoked'} admin` })
  }

  // Delete user
  const handleDelete = async (userId: string) => {
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: 'DELETE',
      credentials: 'include'
    })
    if (!res.ok) {
      setMessage({ severity: 'error', text: 'Failed to delete user' })
      return
    }
    setUsers(u => u.filter(x => x.id !== userId))
    setMessage({ severity: 'success', text: 'User deleted' })
  }

  return (
    <Container sx={{ py: 6 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={4}>
        <Typography variant="h4">Admin → Users</Typography>
        <Button onClick={() => signOut({ callbackUrl: '/' })}>Logout</Button>
      </Stack>

      <BackButton label="< Back to Admin Dashboard" />

      {/* Single invite */}
      <Paper sx={{ mb: 4, p: 2 }}>
        <Typography variant="h6">Invite a User</Typography>
        <Stack direction="row" spacing={2} mt={2}>
          <TextField
            label="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            sx={{ flex: 1 }}
          />
          <Button variant="contained" onClick={inviteSingle}>Invite</Button>
        </Stack>
      </Paper>

      {/* Bulk import from XLSX */}
      <Paper sx={{ mb: 4, p: 2 }}>
        <Typography variant="h6">Bulk Import from XLSX</Typography>
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFile}
          style={{ marginTop: 16 }}
        />

        {/* Candidate Selection Table */}
        {candidates.length > 0 && (
          <>
            <Table size="small" sx={{ mt: 2 }}>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox"></TableCell>
                  <TableCell>Email</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {candidates.map((c, idx) => (
                  <TableRow key={c.email}>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={c.checked}
                        onChange={() => toggleCandidate(idx)}
                      />
                    </TableCell>
                    <TableCell>{c.email}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Box sx={{ mt: 2 }}>
              <Button
                variant="contained"
                onClick={importSelected}
                disabled={!candidates.some(c => c.checked)}
              >
                Import Selected ({candidates.filter(c => c.checked).length})
              </Button>
            </Box>
          </>
        )}

        {/* Bulk results */}
        {bulkResults.length > 0 && (
          <Paper sx={{ mt: 2, maxHeight: 200, overflow: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Email</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Error</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {bulkResults.map(r => (
                  <TableRow key={r.email}>
                    <TableCell>{r.email}</TableCell>
                    <TableCell>{r.ok ? '✅' : '❌'}</TableCell>
                    <TableCell>{r.error || ''}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        )}
      </Paper>

      {/* User list with toggle/delete */}
      <Paper sx={{ p: 2, mb: 4 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Email</TableCell>
              <TableCell>Admin?</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map(u => (
              <TableRow key={u.id}>
                <TableCell>{u.email}</TableCell>
                <TableCell><Switch checked={u.isAdmin} onChange={() => handleToggle(u.id, !u.isAdmin)} /></TableCell>
                <TableCell>
                  <Stack direction="row" spacing={1}>
                    <Button onClick={() => setEditingUser(u.id)}>Edit Enrollments</Button>
                    <Button color="error" onClick={() => handleDelete(u.id)}>Delete</Button>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      {editingUser && (
        <EnrollmentEditor
          userId={editingUser}
          open={Boolean(editingUser)}
          onClose={() => setEditingUser(null)}
        />
      )}

      {/* Feedback Snackbar */}
      {message && (
        <Snackbar open autoHideDuration={5000} onClose={() => setMessage(null)}>
          <Alert severity={message.severity} sx={{ width: '100%' }}>
            {message.text}
          </Alert>
        </Snackbar>
      )}
    </Container>
  )
}
