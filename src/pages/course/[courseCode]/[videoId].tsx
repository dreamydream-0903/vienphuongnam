// src/pages/course/[courseCode]/[videoId].tsx
import { GetServerSideProps } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../api/auth/[...nextauth]'
import { Container, Typography, IconButton } from '@mui/material'
import { prisma } from '@/lib/prisma'
import SecureVideoPlayer from '@/components/SecureVideoPlayer'
import CanvasWatermark from '@/components/CanvasWatermark'
import FullscreenIcon from '@mui/icons-material/Fullscreen'
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit'
import MuxEmbed from '@/components/MuxEmbed'

import React from 'react'


interface Props {
  manifestUri: string
  courseCode: string
  videoId: string
  videoDbId: string
  isApple: boolean
  hlsAesMaster?: string
  watermarkText: string
  muxPlaybackId?: string | null
}

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions)

  if (!session?.user?.email) {
    return {
      redirect: {
        destination: `/api/auth/signin?callbackUrl=${ctx.resolvedUrl}`,
        permanent: false,
      },
    }
  }

  const { courseCode, videoId } = ctx.params as any
  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  const course = await prisma.course.findUnique({ where: { code: courseCode } })
  if (!user || !course) return { notFound: true }

  const access = await prisma.userCourse.findUnique({
    where: { userId_courseId: { userId: user.id, courseId: course.id } }
  })
  if (!access) {
    return {
      redirect: {
        destination: '/access?error=not_enrolled',
        permanent: false,
      }
    }
  }

  // 🔐 Resolve the real Video.id from (courseId, slug). Create if missing.
  // (If you added @@unique([courseId, slug]) you can switch to findUnique({ where: { courseId_slug: { ... } } })
  let videoRow = await prisma.video.findFirst({
    where: { courseId: course.id, r2Path: videoId },
    select: { id: true },
  })
  if (!videoRow) {
    videoRow = await prisma.video.create({
      data: { courseId: course.id, r2Path: videoId, title: videoId },
      select: { id: true },
    })
  }
  const videoDbId = videoRow.id

  // ✅ Per-video allowlist logic:
  // If the user has any UserVideoAccess rows for *this course*, we treat them as an allowlist.
  // -> Only the listed videos are allowed.
  // If the user has none for this course, allow all videos in the course (legacy behavior).
  const perVideoCount = await prisma.userVideoAccess.count({
    where: { userId: user.id, video: { courseId: course.id } },
  })

  if (perVideoCount > 0) {
    const allowedThisVideo = await prisma.userVideoAccess.count({
      where: { userId: user.id, videoId: videoDbId },
    })
    if (allowedThisVideo === 0) {
      return {
        redirect: {
          destination: `/course/${courseCode}?no_video_access=1`,
          permanent: false,
        },
      }
    }
  }

  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const tokenRes = await fetch(
    `${baseUrl}/api/get-playback-token?courseCode=${courseCode}&videoId=${videoId}`,
    { headers: { cookie: ctx.req.headers.cookie || '' } }
  )

  if (!tokenRes.ok) {
    return {
      redirect: {
        destination: tokenRes.status === 401
          ? `/api/auth/signin?callbackUrl=${ctx.resolvedUrl}`
          : '/access?error=not_enrolled',
        permanent: false,
      }
    }
  }

  const { token } = await tokenRes.json()

  // Detect Apple (Safari on iOS/macOS)
  const ua = ctx.req.headers['user-agent'] || ''
  const isApple =
    /(iPad|iPhone|iPod|Macintosh)/.test(ua) &&
    /Safari/.test(ua) &&
    !/Chrome|Chromium|Edg\//.test(ua)

  // HLS AES-128 master (served via our playlist proxy)
  const hlsAesMaster = `/api/hls/playlist?course=${encodeURIComponent(courseCode)}&video=${encodeURIComponent(videoId)}`

  const ip =
    (ctx.req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    ctx.req.socket.remoteAddress ||
    'unknown-ip'

  const nowVN = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
  const line1 = `${session.user.email} • ${nowVN} • ${ip}`
  const watermarkText = `${line1} - Viện Phương Nam - Không chia sẻ dưới mọi hình thức`

  // NEW: Lookup Mux mapping (if any)
  const mux = await prisma.muxMapping.findUnique({
    where: { courseId_videoSlug: { courseId: course.id, videoSlug: videoId } },
    select: { playbackId: true },
  })
  return {
    props: {
      manifestUri: `/api/stream/${token}`,
      muxPlaybackId: mux?.playbackId || null,
      courseCode,
      videoId,
      videoDbId,
      isApple,
      hlsAesMaster,
      watermarkText,
    },
  }
}

export default function VideoPage({ manifestUri, courseCode, videoId, videoDbId, isApple, hlsAesMaster, watermarkText, muxPlaybackId }: Props) {
  const fsRef = React.useRef<HTMLDivElement>(null)
  const [isFs, setIsFs] = React.useState(false)

  React.useEffect(() => {
    const onChange = () => setIsFs(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) await fsRef.current?.requestFullscreen()
    else await document.exitFullscreen()
  }

  return (
    <Container sx={{ py: 4 }}>
      <Typography variant="h5" gutterBottom>
        {courseCode} — {videoId}
      </Typography>
      <div ref={fsRef} style={{ position: 'relative', overflow: 'hidden' }}>
        {isApple ? (
          muxPlaybackId ? (
            <MuxEmbed playbackId={muxPlaybackId} title={`${courseCode}/${videoId}`} />
          ) : (
            <SecureVideoPlayer
              manifestUri={manifestUri}
              courseCode={courseCode}
              videoId={videoId}
              r2Path={videoId}
              hideFullscreenButton
              videoDbId={videoDbId}
            />
          )
        ) : (
          <SecureVideoPlayer
            manifestUri={manifestUri}
            courseCode={courseCode}
            videoId={videoId}
            r2Path={videoId}
            hideFullscreenButton
            videoDbId={videoDbId}
          />
        )}
        {/* <MuxEmbed playbackId={muxPlaybackId} title={`${courseCode}/${videoId}`} /> */}

        {/* Choose one: 'moving' or 'tiled' */}
        <CanvasWatermark text={watermarkText} mode="moving" />
        {/* <CanvasWatermark text={watermarkText} mode="tiled" /> */}

        <IconButton
          onClick={toggleFullscreen}
          size="small"
          sx={{ position: 'absolute', top: 30, right: 8, zIndex: 5, bgcolor: 'rgba(0,0,0,.4)', color: '#fff' }}
          aria-label="Toggle fullscreen"
        >
          {isFs ? <FullscreenExitIcon /> : <FullscreenIcon />}
        </IconButton>
      </div>

    </Container>
  )
}