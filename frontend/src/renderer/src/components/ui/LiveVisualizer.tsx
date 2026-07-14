import { useEffect, useRef, useState, useCallback } from 'react'

interface LiveVisualizerProps {
  isActive: boolean
  useMic: boolean
  height?: number
  barCount?: number
}

export function LiveVisualizer({
  isActive,
  useMic,
  height = 50,
  barCount = 20
}: LiveVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationIdRef = useRef<number | null>(null)
  const [isPermissionDenied, setIsPermissionDenied] = useState(false)

  const cleanup = useCallback(() => {
    if (animationIdRef.current) {
      cancelAnimationFrame(animationIdRef.current)
      animationIdRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(console.error)
      audioCtxRef.current = null
    }
    analyserRef.current = null
  }, [])

  const drawIdle = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = canvas.width
    const h = canvas.height
    ctx.clearRect(0, 0, w, h)

    // Draw a subtle flat/idle line with rounded dots
    const barWidth = 4
    const barGap = 6
    const totalWidth = barCount * barWidth + (barCount - 1) * barGap
    const startX = (w - totalWidth) / 2

    const gradient = ctx.createLinearGradient(0, 0, w, 0)
    gradient.addColorStop(0, 'rgba(139, 92, 246, 0.15)')
    gradient.addColorStop(0.5, 'rgba(59, 130, 246, 0.25)')
    gradient.addColorStop(1, 'rgba(139, 92, 246, 0.15)')
    ctx.fillStyle = gradient

    for (let i = 0; i < barCount; i++) {
      const x = startX + i * (barWidth + barGap)
      const y = (h - 4) / 2
      ctx.beginPath()
      ctx.roundRect(x, y, barWidth, 4, 2)
      ctx.fill()
    }
  }, [barCount])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = canvas.width
    const h = canvas.height

    const bufferLength = analyserRef.current ? analyserRef.current.frequencyBinCount : 0
    const dataArray = new Uint8Array(bufferLength)

    const barWidth = 4
    const barGap = 6
    const totalWidth = barCount * barWidth + (barCount - 1) * barGap
    const startX = (w - totalWidth) / 2

    // Animation frame render loop
    const renderFrame = () => {
      animationIdRef.current = requestAnimationFrame(renderFrame)
      ctx.clearRect(0, 0, w, h)

      if (analyserRef.current && isActive) {
        analyserRef.current.getByteFrequencyData(dataArray)
      }

      const gradient = ctx.createLinearGradient(startX, 0, startX + totalWidth, 0)
      gradient.addColorStop(0, '#a78bfa') // soft purple
      gradient.addColorStop(0.5, '#60a5fa') // soft blue
      gradient.addColorStop(1, '#f472b6') // soft pink
      ctx.fillStyle = gradient

      for (let i = 0; i < barCount; i++) {
        // Map frequency bins to the visualizer bars
        const dataIdx = Math.floor((i / barCount) * bufferLength)
        const value = analyserRef.current && isActive ? dataArray[dataIdx] : 0

        // Calculate amplitude height (minimum 4px, max 85% of canvas height)
        let barHeight = (value / 255) * h * 0.8
        if (barHeight < 4) {
          // Subtle animation ambient noise if active but quiet
          barHeight = isActive ? 4 + Math.sin(Date.now() * 0.005 + i) * 2 : 4
        }

        const x = startX + i * (barWidth + barGap)
        const y = (h - barHeight) / 2 // centered vertically

        ctx.beginPath()
        ctx.roundRect(x, y, barWidth, barHeight, 2)
        ctx.fill()
      }
    }

    renderFrame()
  }, [barCount, isActive])

  useEffect(() => {
    if (!useMic) {
      cleanup()
      drawIdle()
      return
    }

    const startRecordingStream = async () => {
      try {
        cleanup()

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        streamRef.current = stream

        const AudioContextClass =
          window.AudioContext ||
          (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        const audioCtx = new AudioContextClass()
        audioCtxRef.current = audioCtx

        const source = audioCtx.createMediaStreamSource(stream)
        const analyser = audioCtx.createAnalyser()
        analyser.fftSize = 64 // 32 bins
        source.connect(analyser)
        analyserRef.current = analyser

        setIsPermissionDenied(false)
        draw()
      } catch (err) {
        console.warn('Microphone access denied or error:', err)
        setIsPermissionDenied(true)
        drawIdle()
      }
    }

    startRecordingStream()

    return () => {
      cleanup()
    }
  }, [useMic, cleanup, drawIdle, draw])

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        margin: '12px 0'
      }}
    >
      <canvas
        ref={canvasRef}
        width={350}
        height={height}
        style={{
          width: '350px',
          height: `${height}px`,
          maxWidth: '100%',
          display: 'block'
        }}
      />
      {isPermissionDenied && (
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
          ⚠️ Không thể truy cập Microphone để hiển thị sóng live
        </span>
      )}
    </div>
  )
}
