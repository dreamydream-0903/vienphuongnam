// src/components/RawShakaPlayer.tsx
import React, { useEffect, useRef } from 'react'
import 'shaka-player/dist/controls.css'
import shakaLib from 'shaka-player/dist/shaka-player.ui.js';
import type shaka from 'shaka-player'


interface RawShakaPlayerProps {
  manifestUri: string
  courseCode: string
  videoId: string
  playerRef: React.RefObject<shaka.Player | null>
  hideFullscreenButton?: boolean
}

export default function RawShakaPlayer({
  manifestUri,
  courseCode,
  videoId,
  playerRef,
  hideFullscreenButton,
}: RawShakaPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video || !shakaLib.Player.isBrowserSupported()) {
      console.error('Shaka not supported')
      return
    }

    const onDblClick = (e: MouseEvent) => e.preventDefault()
    video.addEventListener('dblclick', onDblClick)

    const player = new shakaLib.Player(videoRef.current!)
    playerRef.current = player

    // 1) Tell Shaka exactly where to get the ClearKey license
    player.configure({
      drm: {
        servers: {
          'org.w3.clearkey':
            `${window.location.origin}/api/drm/license`
            + `?courseCode=${encodeURIComponent(courseCode)}`
            + `&videoId=${encodeURIComponent(videoId)}`,
        },
      },
    })

    // 2) Override network requests (must come *after* configure)
    player.getNetworkingEngine().registerRequestFilter((type: any, request: any) => {

      const typeName = Object.entries(shakaLib.net.NetworkingEngine.RequestType)
        .find(([, val]) => val === type)?.[0] || type

      if (type === shakaLib.net.NetworkingEngine.RequestType.MANIFEST) {
        request.method = 'GET'
        request.uris = [manifestUri]   // ensure it’s targeting your proxy  // force GET so redirects + HEAD don’t fail
      }

      if (type === shakaLib.net.NetworkingEngine.RequestType.LICENSE) {
        request.method = 'POST'
        request.uris = [
          `${location.origin}/api/drm/license`
          + `?courseCode=${encodeURIComponent(courseCode)}`
          + `&videoId=${encodeURIComponent(videoId)}`,
        ]
        request.headers['Content-Type'] = 'application/octet-stream'
      }

      if (type === shakaLib.net.NetworkingEngine.RequestType.SEGMENT) {
        const segmentName = request.uris[0].split('/').pop()

        const key = `encrypted/${courseCode}/${videoId}/dash/${segmentName}`
        request.method = 'GET'
        request.uris = [
          `${window.location.origin}/api/sign-url?key=${encodeURIComponent(key)}`
        ]

        request.uris = [
          `${window.location.origin}/api/sign-url?key=${encodeURIComponent(key)}`
        ]
      }
    })

    // 3) Log any Shaka errors
    player.addEventListener('error', (e: any) => {
      console.error('⛔ Shaka Error', e.detail)
    })

    // 4) Finally, load the manifest
    player.load(manifestUri).catch((err: any) => {
      console.error('Error loading manifest:', err)
    })

    playerRef.current = player

    return () => {
      video.removeEventListener('dblclick', onDblClick)
      playerRef.current = null
      player.destroy()
    }
  }, [manifestUri, courseCode, videoId, playerRef])

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <video
        ref={videoRef}
        controls
        playsInline
        // @ts-ignore iOS attribute
        webkit-playsinline="true"
        crossOrigin="anonymous"
        preload="metadata"
        onContextMenu={(e) => e.preventDefault()}
        {...(hideFullscreenButton
          ? {
            controlsList: 'nofullscreen noremoteplayback nodownload' as any,
            // Optional: block PiP as another sharing vector
            disablePictureInPicture: true,
          }
          : {})}
        style={{ width: '100%', backgroundColor: '#000', display: 'block', position: 'relative', zIndex: 1  }}
      />
    </div>
  )
}