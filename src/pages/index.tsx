// pages/index.tsx
import { useState } from 'react'
import { signIn, signOut, getSession, useSession } from 'next-auth/react'
import { GetServerSideProps } from 'next'
import Link from 'next/link'
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Stack,
  Card,
  CardActionArea,
  CardContent,
  Grid,
  Backdrop,
  CircularProgress,
} from '@mui/material'
import GoogleIcon from '@mui/icons-material/Google'
import CloseIcon from '@mui/icons-material/Close'
import { prisma } from '@/lib/prisma'
import { Container } from '@/components/Container';
import { useRouter } from 'next/router'

interface Course {
  code: string
  title: string
}

interface Props {
  courses?: Course[]
}

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  // 1) Check session
  const session = await getSession({ req: ctx.req })
  if (!session?.user?.email) {
    // No session → just render hero/login, no props needed
    return { props: {} }
  }

  try {
    // 2) Load user & enrolled courses
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    })
    if (!user) {
      // Unexpected: session exists but no User row; force sign-in again
      return {
        redirect: {
          destination: '/api/auth/signin',
          permanent: false,
        },
      }
    }

    const userCourses = await prisma.userCourse.findMany({
      where: { userId: user.id },
      include: { course: true },
    })

    const courses = userCourses.map((uc) => ({
      code: uc.course.code,
      title: uc.course.title,
    }))

    return { props: { courses } }
  } catch (error) {
    console.error('Prisma connection failed on index SSR:', error)
    return { props: {} }
  }
}

export default function Home({ courses }: Props) {
  const { data: session } = useSession()
  const [open, setOpen] = useState(false)

  const [isLoading, setIsLoading] = useState(false)
  const [loadingCode, setLoadingCode] = useState<string | null>(null)
  const router = useRouter()

  const handleCourseClick = async (code: string) => {
    if (isLoading) return

    setIsLoading(true)
    setLoadingCode(code)
    try {
      await router.push(`/course/${encodeURIComponent(code)}`)
      // navigation will replace the page; no need to unset loading
    } catch (e) {
      console.error(e)
      setIsLoading(false)
      setLoadingCode(null)
    }
  }

  // If signed in, show Dashboard
  if (session && courses) {
    return (
      <Container className="section">
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 4,
          }}
        >
          <Typography variant="h4">My Courses</Typography>
          <Button
            variant="outlined"
            onClick={() => signOut({ callbackUrl: '/' })}
            sx={{ textTransform: 'none' }}
          >
            Logout
          </Button>
        </Box>
        {courses.length === 0 ? (
          <Typography color="text.secondary">
            You're not enrolled in any courses yet.
          </Typography>
        ) : (
          <Grid container spacing={3}>
            {courses.map(({ code, title }) => (
              <Grid key={code} size={{ xs: 12, sm: 6, md: 4 }}>
                <Card>
                  <CardActionArea
                    disabled={isLoading}
                    onClick={() => handleCourseClick(code)}>
                    <CardContent>
                      <Typography variant="h6">
                        {title}
                        {isLoading && loadingCode === code ? ' • loading…' : ''}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Code: {code}
                      </Typography>
                    </CardContent>
                  </CardActionArea>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
        {/* Backdrop loader */}
        <Backdrop
          sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}
          open={isLoading}
        >
          <CircularProgress />
          <Box sx={{ ml: 2, fontWeight: 500 }}>Opening course…</Box>
        </Backdrop>
      </Container>
    )
  }

  // Otherwise, show Hero + Login Dialog
  return (
    <Box sx={{ position: 'relative', height: '100vh', overflow: 'hidden' }}>
      {/* Nav (absolute over hero) */}
      <AppBar
        position="absolute"
        color="transparent"
        elevation={0}
        sx={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
      >
        <Toolbar sx={{ justifyContent: 'space-between', minHeight: 64 }}>
          <Typography variant="h6" color="white">
            Video Streaming Platform
          </Typography>
          <Button color="info" onClick={() => setOpen(true)}>
            Đăng nhập
          </Button>
        </Toolbar>
      </AppBar>

      {/* Hero: full-window */}
      <Box
        sx={{
          height: '100%',
          backgroundImage:
            "url('https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1900&q=80')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          position: 'relative',
        }}
      >
        {/* Dark overlay */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            bgcolor: 'rgba(0, 0, 0, 0.4)',
          }}
        />
        {/* Centered content */}
        <Stack
          spacing={2}
          sx={{
            position: 'absolute',
            inset: 0,
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            color: 'white',
            px: 2,
          }}
        >
          <Typography
            variant="h1"
            component="h1"
            sx={{ fontSize: { xs: '2.5rem', md: '4rem' } }}
          >
            Viện Phương Nam
          </Typography>
          <Typography variant="h6" sx={{ maxWidth: 600 }}>
            Đăng nhập để truy cập các khoá học.
          </Typography>
        </Stack>
      </Box>

      {/* Login Dialog */}
      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogTitle sx={{ m: 0, p: 2 }}>
          Đăng nhập
          <IconButton
            aria-label="close"
            onClick={() => setOpen(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Button
            fullWidth
            variant="outlined"
            startIcon={<GoogleIcon />}
            onClick={() => signIn('google', { callbackUrl: '/' })}
            sx={{ textTransform: 'none', py: 1.5 }}
          >
            Đăng nhập với Google
          </Button>
        </DialogContent>
      </Dialog>
    </Box>
  )
}
