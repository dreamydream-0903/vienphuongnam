// src/pages/admin/dashboard/index.tsx
import { useEffect, useState } from 'react'
import { GetServerSideProps } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/pages/api/auth/[...nextauth]'
import { prisma } from '@/lib/prisma'
import { Container, Typography, Box } from '@mui/material'
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface RecordEntry { watchedAt: string; video: { title: string } }
interface StatsResponse { records: RecordEntry[] }

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions)
  const email = session?.user?.email
  if (!email) return { redirect: { destination: '/api/auth/signin', permanent: false } }
  const admin = await prisma.user.findUnique({ where: { email }, select: { isAdmin: true } })
  if (!admin?.isAdmin) return { redirect: { destination: '/', permanent: false } }
  return { props: {} }
}

export default function AdminDashboard() {
  const [data, setData] = useState<any[]>([])
  const [videoTitles, setVideoTitles] = useState<string[]>([])

  useEffect(() => {
    async function fetchStats() {
      const res = await fetch('/api/admin/stats')
      const { records }: StatsResponse = await res.json()

      // Transform records to { date, [title]: count }
      const map: Record<string, any> = {}
      records.forEach(r => {
        const date = new Date(r.watchedAt).toISOString().slice(0, 10)
        if (!map[date]) map[date] = { date }
        const title = r.video.title
        map[date][title] = (map[date][title] || 0) + 1
      })

      const chartData = Object.values(map).sort((a, b) => a.date.localeCompare(b.date))
      setData(chartData)
      // Extract all unique titles
      const titles = Array.from(new Set(records.map(r => r.video.title)))
      setVideoTitles(titles)
    }
    fetchStats()
  }, [])

  return (
    <Container sx={{ py: 6 }}>
      <Typography variant="h4" gutterBottom>Admin Dashboard</Typography>
      <Box sx={{ width: '100%', height: 400 }}>
        <ResponsiveContainer>
          <LineChart data={data}>
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            {videoTitles.map(title => (
              <Line key={title} type="monotone" dataKey={title} strokeWidth={2} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </Box>
    </Container>
  )
}
