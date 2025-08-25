// src/components/CanvasWatermark.tsx
import React, { useEffect, useRef } from 'react'

type Mode = 'moving' | 'tiled'

type Props = {
  text: string
  mode?: Mode
  intervalMs?: number
  opacity?: number
}

export default function CanvasWatermark({
  text,
  mode = 'moving',
  intervalMs = 7000,
  opacity = 0.65,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const canvas = canvasRef.current
    const parent = canvas?.parentElement
    if (!canvas || !parent) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // --- drawing helpers ---
    const drawMoving = () => {
      const w = parent.clientWidth
      const h = parent.clientHeight
      if (!w || !h) return
      ctx.clearRect(0, 0, w, h)
      ctx.save()
      ctx.globalAlpha = opacity
      const fontPx = Math.max(14, Math.min(36, Math.floor(Math.min(w, h) * 0.025)))
      ctx.font = `100 ${fontPx}px system-ui, -apple-system, Segoe UI, Roboto, Arial`
      ctx.fillStyle = '#fff'
      ctx.textBaseline = 'top'
      const metrics = ctx.measureText(text)
      const tw = Math.ceil(metrics.width)
      const th = fontPx
      const pad = Math.floor(fontPx * 0.6)
      const maxX = Math.max(pad, w - tw - pad)
      const maxY = Math.max(pad, h - th - pad)
      const x = Math.floor(pad + Math.random() * Math.max(1, maxX - pad))
      const y = Math.floor(pad + Math.random() * Math.max(1, maxY - pad))
      const rot = (Math.random() * 60 - 30) * (Math.PI / 180)
      ctx.translate(x + tw / 2, y + th / 2)
      ctx.rotate(rot)
      ctx.textAlign = 'center'
      ctx.fillText(text, 0, -th / 2)
      ctx.restore()
    }

    const drawTiled = () => {
      const w = parent.clientWidth
      const h = parent.clientHeight
      if (!w || !h) return
      ctx.clearRect(0, 0, w, h)
      ctx.save()
      ctx.globalAlpha = opacity * 0.6
      const fontPx = Math.max(12, Math.min(24, Math.floor(Math.min(w, h) * 0.025)))
      ctx.font = `100 ${fontPx}px system-ui, -apple-system, Segoe UI, Roboto, Arial`
      ctx.fillStyle = '#fff'
      ctx.textBaseline = 'top'
      const baseRot = -25 * (Math.PI / 180)
      ctx.translate(w * 0.05 + Math.random() * 20, h * 0.05 + Math.random() * 20)
      ctx.rotate(baseRot)
      const tw = Math.ceil(ctx.measureText(text).width)
      const stepX = tw + fontPx * 4
      const stepY = fontPx * 4
      for (let y = -h; y < h * 2; y += stepY) {
        for (let x = -w; x < w * 2; x += stepX) {
          ctx.fillText(text, x, y)
        }
      }
      ctx.restore()
    }

    const draw = () => (mode === 'moving' ? drawMoving() : drawTiled())

    // --- sizing: match parent & handle DPR for crisp text ---
    const resizeToParent = () => {
      const dpr = window.devicePixelRatio || 1
      const w = parent.clientWidth
      const h = parent.clientHeight
      if (!w || !h) return
      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0) // draw in CSS pixels
      draw()
    }

    // --- anti-tamper: if removed/hidden, put back & restore style ---
    const reattach = () => {
      if (!parent.contains(canvas)) parent.appendChild(canvas)
      canvas.style.display = ''
      canvas.style.visibility = ''
      canvas.style.opacity = `${opacity}`
      draw()
    }
    const parentObs = new MutationObserver(() => reattach())
    parentObs.observe(parent, { childList: true })
    const selfObs = new MutationObserver(() => reattach())
    selfObs.observe(canvas, { attributes: true, attributeFilter: ['style', 'class'] })

    // --- Resize handling (fix for optional chaining after `new`) ---
    const ResizeObserverCtor =
      (window as any).ResizeObserver as typeof ResizeObserver | undefined
    let ro: ResizeObserver | null = null
    if (ResizeObserverCtor) {
      ro = new ResizeObserverCtor(() => resizeToParent())
      ro.observe(parent)
    } else {
      // Fallback if older browser
      window.addEventListener('resize', resizeToParent)
    }

    resizeToParent()
    const timerId = window.setInterval(draw, intervalMs)

    return () => {
      clearInterval(timerId)
      if (ro) ro.disconnect()
      else window.removeEventListener('resize', resizeToParent)
      parentObs.disconnect()
      selfObs.disconnect()
    }
  }, [text, mode, intervalMs, opacity])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 9,
        pointerEvents: 'none',
        opacity,
      }}
    />
  )
}
