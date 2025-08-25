import dynamic from 'next/dynamic'

// Load the React wrapper client-side only
const MuxPlayer = dynamic(() => import('@mux/mux-player-react').then(m => m.default), { ssr: false })

export default function MuxEmbed({ playbackId, title }: { playbackId: string; title?: string }) {
  return (
    <MuxPlayer
      playbackId={playbackId}
      streamType="on-demand"
      // keep controls but hide fullscreen; we’ll use wrapper fullscreen
      className="mux-no-fs"
      style={{ width: '100%', background: '#000', display: 'block' }}
      // nice defaults
      playsInline
      autoPlay={false}
      preload="metadata"
      title={title}
    />
  )
}
