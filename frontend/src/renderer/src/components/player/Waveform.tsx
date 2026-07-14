import React, { useMemo, useState, useEffect } from 'react'
import { api } from '../../api/client'

interface WaveformProps {
  id: string
  currentTime: number
  duration: number
  onSeek: (ratio: number) => void
  disabled?: boolean
}

export function Waveform({ id, currentTime, duration, onSeek, disabled = false }: WaveformProps) {
  const barCount = 120
  const [peaks, setPeaks] = useState<number[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Generate deterministic fallback heights based on id hash
  const fallbackHeights = useMemo(() => {
    const heights: number[] = []
    let hash = 0
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash)
    }

    for (let i = 0; i < barCount; i++) {
      const r = Math.sin(hash + i * 0.15) * 0.5 + 0.5
      const height = Math.floor(r * 80) + 15 // 15px to 95px
      heights.push(height)
    }
    return heights
  }, [id])

  useEffect(() => {
    let active = true

    const loadPeaks = async () => {
      try {
        setIsLoading(true)
        const response = await fetch(api.streamUrl(id))
        if (!response.ok) throw new Error('WAV stream fetch failed')
        const arrayBuffer = await response.arrayBuffer()

        if (!active) return

        const AudioContextClass =
          window.AudioContext ||
          (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        const audioCtx = new AudioContextClass()
        let audioBuffer: AudioBuffer
        try {
          audioBuffer = await audioCtx.decodeAudioData(arrayBuffer)
        } finally {
          audioCtx.close().catch(console.error)
        }

        if (!active) return

        const channelData = audioBuffer.getChannelData(0)
        const step = Math.floor(channelData.length / barCount)
        const extractedPeaks: number[] = []

        let maxVal = 0.01 // safety
        for (let i = 0; i < barCount; i++) {
          const start = i * step
          const actualEnd = start + step < channelData.length ? start + step : channelData.length
          let max = 0
          for (let j = start; j < actualEnd; j++) {
            const val = Math.abs(channelData[j])
            if (val > max) max = val
          }
          extractedPeaks.push(max)
          if (max > maxVal) maxVal = max
        }

        // Scale heights to visual range (10px to 100px)
        const scaledPeaks = extractedPeaks.map((p) => {
          const normalized = p / maxVal
          return Math.floor(normalized * 90) + 10
        })

        if (active) {
          setPeaks(scaledPeaks)
          setIsLoading(false)
        }
      } catch (err) {
        console.warn('Could not extract real audio peaks, using fallback:', err)
        if (active) {
          setPeaks(fallbackHeights)
          setIsLoading(false)
        }
      }
    }

    loadPeaks()

    return () => {
      active = false
    }
  }, [id, fallbackHeights])

  const progressRatio = duration > 0 ? currentTime / duration : 0

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled || isLoading) return
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / rect.width
    onSeek(Math.min(1, Math.max(0, ratio)))
  }

  if (isLoading) {
    return (
      <div className="waveform-container disabled loading-state">
        {Array.from({ length: barCount }).map((_, i) => (
          <div
            key={i}
            className="waveform-bar loading-bar"
            style={{
              height: `${30 + Math.sin(i * 0.2) * 20}px`,
              animationDelay: `${i * 0.015}s`
            }}
          />
        ))}
        <style>{`
          .waveform-container {
            display: flex;
            align-items: center;
            justify-content: space-between;
            height: 120px;
            background: rgba(255, 255, 255, 0.01);
            border-radius: var(--radius-md);
            padding: 8px 12px;
            border: 1px dashed rgba(255, 255, 255, 0.03);
            user-select: none;
          }
          .waveform-bar {
            width: 1.5px;
            border-radius: 1px;
          }
          .loading-bar {
            background: rgba(255, 255, 255, 0.08);
            animation: shimmerBar 1.2s infinite ease-in-out;
          }
          @keyframes shimmerBar {
            0%, 100% {
              opacity: 0.3;
              transform: scaleY(0.7);
            }
            50% {
              opacity: 0.8;
              transform: scaleY(1.3);
            }
          }
        `}</style>
      </div>
    )
  }

  return (
    <div className={`waveform-container ${disabled ? 'disabled' : ''}`} onClick={handleClick}>
      {peaks.map((h, i) => {
        const barRatio = i / barCount
        const isActive = barRatio <= progressRatio
        return (
          <div
            key={i}
            className={`waveform-bar ${isActive ? 'active' : ''}`}
            style={{
              height: `${h}px`
            }}
          />
        )
      })}

      <style>{`
        .waveform-container {
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 120px;
          cursor: pointer;
          background: rgba(255, 255, 255, 0.01);
          border-radius: var(--radius-md);
          padding: 8px 12px;
          border: 1px dashed rgba(255, 255, 255, 0.03);
          transition: border-color 0.2s;
          user-select: none;
        }

        .waveform-container:hover {
          border-color: rgba(139, 92, 246, 0.2);
        }

        .waveform-bar {
          width: 1.6px;
          background: rgba(255, 255, 255, 0.15);
          border-radius: 1px;
          transition: background 0.1s, transform 0.1s;
        }

        .waveform-container:hover .waveform-bar {
          transform: scaleY(1.1);
        }

        .waveform-container.disabled {
          cursor: not-allowed;
          opacity: 0.6;
        }

        .waveform-container.disabled:hover .waveform-bar {
          transform: none;
        }

        .waveform-bar.active {
          background: var(--accent-grad);
        }
      `}</style>
    </div>
  )
}
