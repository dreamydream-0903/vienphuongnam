// src/pages/admin/keys.tsx
import { useEffect, useState, ChangeEvent } from 'react'
import { GetServerSideProps } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/pages/api/auth/[...nextauth]'
import { prisma } from '@/lib/prisma'
import {
  Container,
  Typography,
  Box,
  Button,
  Paper,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Stack,
  Snackbar,
  Alert
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import BackButton from '@/components/BackButton'

interface KeyEntry {
  videoId: string
  keystore: Record<string, { ciphertext: string; createdAt: string }>
}
interface BulkResult { videoId: string; ok: boolean; error?: string }

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions)
  const email = session?.user?.email
  if (!email) return { redirect: { destination: '/api/auth/signin', permanent: false } }
  const user = await prisma.user.findUnique({ where: { email }, select: { isAdmin: true } })
  if (!user?.isAdmin) return { redirect: { destination: '/', permanent: false } }
  return { props: {} }
}

export default function AdminKeysPage() {
  const [keys, setKeys] = useState<KeyEntry[]>([])
  const [bulkResults, setBulkResults] = useState<BulkResult[]>([])
  const [openDialog, setOpenDialog] = useState(false)
  const [editingVideoId, setEditingVideoId] = useState<string>('')
  const [fields, setFields] = useState<{
    kid: string
    ciphertext: string
    createdAt?: string
  }[]>([])
  const [message, setMessage] = useState<{ severity: 'success' | 'error'; text: string } | null>(null)

  const loadKeys = async () => {
    const res = await fetch('/api/admin/keys')
    const data = await res.json()
    setKeys(data.keys)
  }

  useEffect(() => {
    loadKeys()
  }, [])

  const handleOpenNew = () => {
    setEditingVideoId('')
    setFields([{ kid: '', ciphertext: '', createdAt: new Date().toISOString() }])
    setOpenDialog(true)
  }

  const handleOpenEdit = (entry: KeyEntry) => {
    setEditingVideoId(entry.videoId)
    setFields(
      Object.entries(entry.keystore).map(([kid, { ciphertext, createdAt }]) => ({
        kid,
        ciphertext,
        createdAt
      }))
    )
    setOpenDialog(true)
  }

  const handleDelete = async (videoId: string) => {
    const res = await fetch(`/api/admin/keys/${encodeURIComponent(videoId)}`, { method: 'DELETE' })
    if (!res.ok) return setMessage({ severity: 'error', text: 'Delete failed' })
    setMessage({ severity: 'success', text: 'Deleted' })
    loadKeys()
  }

  const handleAddField = () =>
    setFields((f) => [...f, { kid: '', ciphertext: '', createdAt: new Date().toISOString() }])
  const handleRemoveField = (idx: number) => setFields((f) => f.filter((_, i) => i !== idx))
  const handleFieldChange = (idx: number, type: 'kid' | 'ciphertext', val: string) =>
    setFields((f) => f.map((fld, i) => (i === idx ? { ...fld, [type]: val } : fld)))

  const handleSave = async () => {
    if (!editingVideoId && !fields[0].kid) {
      setMessage({ severity: 'error', text: 'Video ID required' })
      return
    }
    const videoId = editingVideoId || fields[0].kid
    const keystore: Record<string, { ciphertext: string; createdAt: string }> = {}
    fields.forEach(({ kid, ciphertext, createdAt }) => {
      if (kid) {
        keystore[kid] = { ciphertext, createdAt: createdAt || new Date().toISOString() }
      }
    })

    const url = editingVideoId
      ? `/api/admin/keys/${encodeURIComponent(videoId)}`
      : '/api/admin/keys'
    const method = editingVideoId ? 'PUT' : 'POST'
    const body = editingVideoId
      ? { keystore }
      : { videoId, keystore }

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    if (!res.ok) {
      setMessage({ severity: 'error', text: 'Save failed' })
      return
    }
    setMessage({ severity: 'success', text: editingVideoId ? 'Updated' : 'Created' })
    setOpenDialog(false)
    loadKeys()
  }

  const handleBulk = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const items = JSON.parse(await file.text()) as Record<
        string,
        { ciphertext: string; createdAt: string }
      >
      const payload = Object.entries(items).map(([videoId, keystore]) => ({ videoId, keystore }))
      const res = await fetch('/api/admin/keys/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!res.ok) throw new Error()
      const { results } = await res.json()
      setBulkResults(results)
      setMessage({ severity: 'success', text: 'Bulk import complete' })
      loadKeys()
    } catch {
      setMessage({ severity: 'error', text: 'Bulk import failed' })
    }
  }

  return (
    <Container sx={{ py: 4 }}>
      <Box mb={2} display="flex" justifyContent="space-between" alignItems="center">
        <Typography variant="h4">Admin → Video Keys</Typography>
        <BackButton />
      </Box>

      <Box mb={2}>
        <Button startIcon={<AddIcon />} variant="contained" onClick={handleOpenNew}>
          Add Key
        </Button>
        <Button sx={{ ml: 2 }} component="label">
          Import JSON
          <input type="file" accept="application/json" hidden onChange={handleBulk} />
        </Button>
      </Box>

      {bulkResults.length > 0 && (
        <Paper sx={{ mb: 2, p: 2 }}>
          <Typography variant="subtitle1">Bulk import results:</Typography>
          {bulkResults.map((r) => (
            <Typography key={r.videoId}>
              {r.videoId}: {r.ok ? '✅' : '❌ ' + r.error}
            </Typography>
          ))}
        </Paper>
      )}

      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Video ID</TableCell>
              <TableCell>Keys Count</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {keys.map((k) => (
              <TableRow key={k.videoId}>
                <TableCell>{k.videoId}</TableCell>
                <TableCell>{Object.keys(k.keystore).length}</TableCell>
                <TableCell>
                  <IconButton onClick={() => handleOpenEdit(k)}>
                    <EditIcon />
                  </IconButton>
                  <IconButton onClick={() => handleDelete(k.videoId)}>
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editingVideoId ? 'Edit Key' : 'Add Key'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Video ID"
              value={editingVideoId || ''}
              onChange={(e) => setEditingVideoId(e.target.value)}
            />
            <Typography variant="subtitle1">Key Entries</Typography>
            {fields.map((f, idx) => (
              <Stack key={idx} direction="row" spacing={1} alignItems="center">
                <TextField
                  label="Key ID"
                  value={f.kid}
                  onChange={(e) => handleFieldChange(idx, 'kid', e.target.value)}
                  sx={{ flex: 1 }}
                />
                <TextField
                  label="Ciphertext"
                  value={f.ciphertext}
                  onChange={(e) => handleFieldChange(idx, 'ciphertext', e.target.value)}
                  sx={{ flex: 2 }}
                />
                <TextField
                  label="Created At"
                  value={f.createdAt?.slice(0, 19).replace('T', ' ') || ''}
                  sx={{ flex: 1 }}
                />
                <IconButton onClick={() => handleRemoveField(idx)}>
                  <DeleteIcon />
                </IconButton>
              </Stack>
            ))}
            <Button startIcon={<AddIcon />} onClick={handleAddField}>
              Add Another
            </Button>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button onClick={handleSave} variant="contained">
            Save
          </Button>
        </DialogActions>
      </Dialog>

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
