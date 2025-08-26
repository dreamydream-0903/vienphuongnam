// src/components/VideoPlayer.tsx

import React, { useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import type shaka from 'shaka-player'

// “RawShakaPlayer” will only render on the client (never on the server).
const RawShakaPlayer = dynamic(
  () => import('./RawShakaPlayer'),
  { ssr: false }
)

interface Props {
  manifestUri: string
  courseCode: string
  videoId: string
  r2Path: string
  hideFullscreenButton?: boolean
  videoDbId: string
}

export default function VideoPlayer({ manifestUri, courseCode, videoId, r2Path, hideFullscreenButton, videoDbId }: Props) {
  const reportedRef = useRef(false)
  const playerRef = useRef<shaka.Player | null>(null)
  const lastReportedTimeRef = useRef(0)

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (reportedRef.current) return
      reportedRef.current = true

      await fetch('/api/video/record-watch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ r2Path }),
      })
    }, 30 * 60 * 1000)

    return () => clearTimeout(timer)
  }, [videoId])

  useEffect(() => {
    const controller = new AbortController()

    const id = window.setInterval(async () => {
      const player = playerRef.current
      if (!player) return

      // Shaka: total seconds watched since load (only counts while playing)
      const stats = player.getStats()
      const played = Math.floor(stats.playTime || 0)

      // delta since last report
      let delta = played - Math.floor(lastReportedTimeRef.current || 0)
      if (delta < 0) delta = 0               // guard against seeks/backwards
      if (delta < 5) return                  // only report every ≥5s watched

      try {
        await fetch('/api/video/record-time', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            courseCode,          // optional but nice for logs/analytics
            videoSlug: videoId,  // your URL slug (optional)
            videoDbId,           // ✅ real FK to Video.id (Option B)
            seconds: delta,      // how many seconds to add this tick
          }),
        })
        lastReportedTimeRef.current = played
      } catch (e) {
        // swallow network aborts; log others
        if (!(e instanceof DOMException && e.name === 'AbortError')) {
          console.error('record-time failed', e)
        }
      }
    }, 30000)

    return () => {
      controller.abort()
      window.clearInterval(id)
    }
    // include the identifiers so a route change resets reporting correctly
  }, [courseCode, videoId, videoDbId])


  return <RawShakaPlayer manifestUri={manifestUri} courseCode={courseCode} videoId={videoId} playerRef={playerRef} hideFullscreenButton={hideFullscreenButton} />
}