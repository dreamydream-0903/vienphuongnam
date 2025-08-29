// src/pages/course/[courseCode]/index.tsx

import { GetServerSideProps } from 'next'
import { getSession, useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import {
  Container, Typography, Card, CardActionArea, CardContent, Button, Box, Snackbar, Alert, Backdrop, CircularProgress
} from '@mui/material'
import Grid from '@mui/material/Grid';
import { useState } from 'react'
import { useRouter } from 'next/router'
import { useEffect } from 'react'

interface Video {
  id: string
  r2Path: string
  title: string
}

interface Course { code: string; title: string }

interface Props {
  course: Course
  videos: Video[]
}

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const { courseCode } = ctx.params as { courseCode: string }

  // 1) Require login
  const session = await getSession({ req: ctx.req })
  if (!session?.user?.email) {
    return {
      redirect: {
        destination: `/api/auth/signin?callbackUrl=/course/${courseCode}`,
        permanent: false,
      },
    }
  }

  // 2) Load user
  const user = await prisma.user.findUnique({
    where: { email: session.user.email! },
    select: { id: true },
  })
  if (!user) {
    return {
      redirect: {
        destination: `/api/auth/signin?callbackUrl=/course/${courseCode}`,
        permanent: false,
      },
    }
  }

  // 3) Load course
  const course = await prisma.course.findUnique({
    where: { code: courseCode },
    select: { id: true, code: true, title: true },
  })
  if (!course) return { notFound: true }

  // 4) Check enrolment
  const access = await prisma.userCourse.findUnique({
    where: {
      userId_courseId: {
        userId: user.id,
        courseId: course.id,
      },
    },
  })
  if (!access) {
    return {
      redirect: {
        destination: '/access?error=not_enrolled',
        permanent: false,
      },
    }
  }

  // 5) Fetch videos
  const perVideoCount = await prisma.userVideoAccess.count({
    where: { userId: user.id, video: { courseId: course.id } },
  })

  let videos
  if (perVideoCount === 0) {
    // No allowlist → show all videos
    videos = await prisma.video.findMany({
      where: { courseId: course.id },
      select: { id: true, r2Path: true, title: true },
      orderBy: { title: 'asc' },
    })
  } else {
    // Allowlist present → show only allowed videos
    const allowed = await prisma.userVideoAccess.findMany({
      where: { userId: user.id, video: { courseId: course.id } },
      select: { videoId: true },
    })
    const ids = allowed.map(a => a.videoId)

    videos = ids.length
      ? await prisma.video.findMany({
        where: { id: { in: ids } },
        select: { id: true, r2Path: true, title: true },
        orderBy: { title: 'asc' },
      })
      : []
  }

  return {
    props: {
      course: { code: course.code, title: course.title },
      videos,
    },
  }
}

export default function CoursePage({ course, videos }: Props) {

  const { data: session } = useSession()
  const router = useRouter()

  const [isLoading, setIsLoading] = useState(false)
  const [loadingR2Path, setLoadingR2Path] = useState<string | null>(null)
  const [toastOpen, setToastOpen] = useState(false)
  const [toastMsg, setToastMsg] = useState('❌ Watch limit reached. Please contact support.')
  const [toastSeverity, setToastSeverity] = useState<'warning' | 'error' | 'success'>('warning')

  const [openDenied, setOpenDenied] = useState(false)

  useEffect(() => {
    if (!router.isReady) return
    if (router.query.no_video_access === '1') {
      setOpenDenied(true)
      // remove the flag from the URL without a full reload
      const nextUrl = {
        pathname: router.pathname,
        query: { ...router.query } as Record<string, any>,
      }
      delete nextUrl.query.no_video_access
      // NOTE: router.pathname is /course/[courseCode], so we must keep courseCode in query
      // router.query already contains it, so the replace will build the right URL.
      router.replace(nextUrl, undefined, { shallow: true })
    }
  }, [router.isReady, router.query.no_video_access])

  const handleVideoClick = async (r2Path: string) => {
    if (isLoading) return

    setIsLoading(true)
    setLoadingR2Path(r2Path)


    const res = await fetch(`/api/course/view-count?courseCode=${course.code}&r2Path=${r2Path}`)
    const data = await res.json()

    try {
      const res = await fetch(`/api/course/view-count?courseCode=${course.code}&r2Path=${encodeURIComponent(r2Path)}`)
      if (!res.ok) {
        throw new Error(`Request failed with ${res.status}`)
      }
      const data = await res.json()

      console.log('[videoWatchCount]', data.videoWatchCount)

      if (data.videoWatchCount >= 5) {
        setToastMsg('❌ Watch limit reached. Please contact support.')
        setToastSeverity('warning')
        setToastOpen(true)
        setIsLoading(false)
        setLoadingR2Path(null)
        return
      }

      // Redirect to the player page
      router.push(`/course/${course.code}/${encodeURIComponent(r2Path)}`)
      // no need to unset loading here; page will navigate
    } catch (err) {
      console.error(err)
      setToastMsg('Network error. Please try again.')
      setToastSeverity('error')
      setToastOpen(true)
      setIsLoading(false)
      setLoadingR2Path(null)
    }
  }


  return (
    <Container sx={{ py: 6 }} aria-busy={isLoading}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h4">{course.title}</Typography>
        <Button
          variant="outlined"
          onClick={() => signOut({ callbackUrl: '/' })}
          sx={{ textTransform: 'none' }}
        >
          Logout
        </Button>
      </Box>

      {/* Back to Dashboard */}
      <Box sx={{ mb: 3 }}>
        <Link href="/" passHref>
          <Button variant="text">{'<'} Back to My Courses</Button>
        </Link>
      </Box>

      {/* Video List */}
      {videos.length === 0 ? (
        <Typography color="text.secondary">No videos in this course.</Typography>
      ) : (
        <Grid container spacing={3}>
          {videos.map(({ r2Path, title }) => (
            <Grid key={r2Path} size={{ xs: 12, sm: 6, md: 4 }}>
              <Card>
                <CardActionArea
                  disabled={isLoading}
                  onClick={() => handleVideoClick(r2Path)}>
                  <CardContent>
                    <Typography variant="subtitle1">
                      {title}
                      {isLoading && loadingR2Path === r2Path ? ' • loading…' : ''}
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <Backdrop
        sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}
        open={isLoading}
      >
        <CircularProgress />
        <Box sx={{ ml: 2, fontWeight: 500 }}>Preparing your video…</Box>
      </Backdrop>

      <Snackbar
        open={openDenied}
        autoHideDuration={10000}
        onClose={() => {
          setOpenDenied(false)
          // redirect to course main page
          window.location.reload()
        }}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          onClose={() => {
            setOpenDenied(false)
            window.location.reload()
          }}
          severity="warning"
          variant="filled"
          sx={{ width: '100%' }}
        >
          Bạn không có quyền xem video này trong khóa học. (No access to that video.)
        </Alert>
      </Snackbar>

      {/* Toast */}
      <Snackbar
        open={toastOpen}
        autoHideDuration={5000}
        onClose={() => setToastOpen(false)}
      >
        <Alert severity={toastSeverity} sx={{ width: '100%' }}>
          {toastMsg}
        </Alert>
      </Snackbar>
    </Container>
  )
}
