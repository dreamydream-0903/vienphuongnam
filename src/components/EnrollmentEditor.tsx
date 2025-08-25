// src/components/EnrollmentEditor.tsx
import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  IconButton,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Stack,
  Typography
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { Button } from '@/components/ui/button'

import { prisma } from '@/lib/prisma'

interface EnrollmentEditorProps {
  userId: string
  open: boolean
  onClose: () => void
}

interface CourseOption { id: string; code: string; title: string }

type Row = { courseId: string }

export default function EnrollmentEditor({ userId, open, onClose }: EnrollmentEditorProps) {
  const [rows, setRows] = useState<Row[]>([])
  const [courseOptions, setCourseOptions] = useState<CourseOption[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load existing enrollments and all courses
  useEffect(() => {
    if (!open) return
    Promise.all([
      fetch(`/api/admin/enrollments/${userId}`),
      fetch('/api/admin/courses')
    ]).then(async ([resEnroll, resCourses]) => {
      const { courseIds } = await resEnroll.json()
      const courses = await resCourses.json()
      setRows(courseIds.map((id: string) => ({ courseId: id })))
      setCourseOptions(courses)
    }).catch(err => setError('Failed to load data'))
  }, [open, userId])

  const handleAddRow = () => {
    setRows(r => [...r, { courseId: courseOptions[0]?.id || '' }])
  }
  const handleDeleteRow = (index: number) => {
    setRows(r => r.filter((_, i) => i !== index))
  }
  const handleChange = (index: number, courseId: string) => {
    setRows(r => r.map((row, i) => i === index ? { courseId } : row))
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/enrollments/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseIds: rows.map(r => r.courseId) })
      })
      if (!res.ok) throw new Error('Save failed')
      onClose()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Manage Enrollments</DialogTitle>
      <DialogContent>
        {error && <Typography color="error">{error}</Typography>}
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Course</TableCell>
              <TableCell align="right">
                <IconButton onClick={handleAddRow} size="small">
                  <AddIcon />
                </IconButton>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row, idx) => (
              <TableRow key={idx}>
                <TableCell>
                  <FormControl fullWidth>
                    <InputLabel>Course</InputLabel>
                    <Select
                      value={row.courseId}
                      label="Course"
                      onChange={e => handleChange(idx, e.target.value)}
                    >
                      {courseOptions.map(co => (
                        <MenuItem key={co.id} value={co.id}>
                          {co.code} — {co.title}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </TableCell>
                <TableCell align="right">
                  <IconButton onClick={() => handleDeleteRow(idx)} size="small">
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DialogContent>
      <DialogActions>
        <Stack direction="row" spacing={2} sx={{ m: 1 }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} variant="default" size="default">
            Save
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  )
}