import React, { useMemo } from 'react'

interface WaveformProps {
  id: string
  currentTime: number
  duration: number
  onSeek: (ratio: number) => void
  disabled?: boolean
}

export function Waveform({ id, currentTime, duration, onSeek, disabled = false }: WaveformProps) {
  const barCount = 60

  // Generate deterministic bar heights based on id hash
  const barHeights = useMemo(() => {
    const heights: number[] = []
    let hash = 0
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash)
    }

    for (let i = 0; i < barCount; i++) {
      // Deterministic pseudo-random height between 10% and 90%
      const r = Math.sin(hash + i * 0.15) * 0.5 + 0.5
      const height = Math.floor(r * 40) + 8 // 8px to 48px
      heights.push(height)
    }
    return heights
  }, [id])

  const progressRatio = duration > 0 ? currentTime / duration : 0

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / rect.width
    if (!disabled) {
      onSeek(Math.min(1, Math.max(0, ratio)))
    }
  }

  return (
    <div className={`waveform-container ${disabled ? 'disabled' : ''}`} onClick={handleClick}>
      {barHeights.map((h, i) => {
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
          height: 60px;
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
          width: 3px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 2px;
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
