import { useEffect, useState, useRef } from 'react'
import { Box, Skeleton, Typography, Alert } from '@mui/material'
import VideoPlayer from './VideoPlayer'

interface Props {
  manifestUri: string
  courseCode: string
  videoId: string
  r2Path: string
  hideFullscreenButton?: boolean
  videoDbId: string
}

export default function SecureVideoPlayer({ manifestUri, courseCode, videoId, r2Path, hideFullscreenButton = false, videoDbId }: Props) {
  const [isReady, setIsReady] = useState(false)
  const [checking, setChecking] = useState(true)
  const [viewLimitReached, setViewLimitReached] = useState(false)
  const [devtoolsOpen, setDevtoolsOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function fetchKeyStatus() {
      if (!videoId || !courseCode || !r2Path) return
      try {
        const res = await fetch(`/api/video/has-key?videoId=${videoId}`)
        const data = await res.json()

        const viewRes = await fetch(`/api/course/view-count?courseCode=${courseCode}&r2Path=${r2Path}`)
        const viewData = await viewRes.json()

        const allowPlayback = data.ok && viewData.videoWatchCount < 3

        setIsReady(allowPlayback)
        setViewLimitReached(!allowPlayback)
      } catch (err) {
        console.error('Access check failed:', err)
      } finally {
        setChecking(false)
      }
    }

    fetchKeyStatus()
  }, [videoId, courseCode, r2Path])

  useEffect(() => {
    const check = () => {
      const threshold = 160 // docks usually cause big outer/inner deltas
      const w = window.outerWidth - window.innerWidth
      const h = window.outerHeight - window.innerHeight
      const open = w > threshold || h > threshold
      setDevtoolsOpen(open)
      if (open) {
        const v = rootRef.current?.querySelector('video') as HTMLVideoElement | null
        v?.pause()
      }
    }
    const id = setInterval(check, 1000)
    return () => clearInterval(id)
  }, [])

  if (checking) {
    return (
      <Box sx={{ mt: 2 }}>
        <Skeleton variant="rectangular" height={360} />
        <Typography variant="body2" sx={{ mt: 1, color: 'gray' }}>
          Checking license and view limit...
        </Typography>
      </Box>
    )
  }

  if (viewLimitReached) {
    return (
      <Alert severity="warning" sx={{ mt: 2 }}>
        ❌ You have reached the view limit for this course. Please contact support.
      </Alert>
    )
  }

  if (!isReady) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        🔐 License key not found for this video. Please contact support.
      </Alert>
    )
  }

  return (
    <Box sx={{ mt: 3 }}>
      <VideoPlayer
        manifestUri={manifestUri}
        courseCode={courseCode}
        videoId={videoId}
        r2Path={videoId}
        hideFullscreenButton={hideFullscreenButton}
        videoDbId={videoDbId}
      />

      {devtoolsOpen && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 6,
            display: 'grid',
            placeItems: 'center',
            background: 'rgba(0,0,0,.5)',
            color: '#fff',
            fontWeight: 700,
            letterSpacing: 0.2,
          }}
        >
          DevTools detected — playback paused
        </div>
      )}
    </Box>
  )
}

