import { useEffect, useState } from 'react'
import { Waveform } from './Waveform'
import { formatTime } from '../../utils/format'
import './AudioPlayer.css'

interface AudioPlayerProps {
  recordingId: string
  isPlaying: boolean
  currentTime: number
  duration: number
  speed: number
  volume: number
  disabled?: boolean
  error: string | null
  onPlay: () => void
  onPause: () => void
  onSeek: (ratio: number) => void
  onChangeSpeed: (speed: 0.5 | 1 | 1.25 | 1.5 | 2) => void
  onChangeVolume: (volume: number) => void
}

export function AudioPlayer({
  recordingId,
  isPlaying,
  currentTime,
  duration,
  speed,
  volume,
  disabled = false,
  error,
  onPlay,
  onPause,
  onSeek,
  onChangeSpeed,
  onChangeVolume
}: AudioPlayerProps) {
  const hasError = Boolean(error)

  const [previousVolume, setPreviousVolume] = useState<number>(1)

  useEffect(() => {
    if (disabled) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLButtonElement
      ) {
        return
      }
      if (e.code === 'Space') {
        e.preventDefault()
        if (isPlaying) {
          onPause()
        } else {
          onPlay()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isPlaying, disabled, onPlay, onPause])

  const toggleMute = () => {
    if (volume > 0) {
      setPreviousVolume(volume)
      onChangeVolume(0)
    } else {
      onChangeVolume(previousVolume > 0 ? previousVolume : 1)
    }
  }

  const getVolumeIcon = () => {
    if (volume === 0) {
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
          <line x1="23" y1="9" x2="17" y2="15"></line>
          <line x1="17" y1="9" x2="23" y2="15"></line>
        </svg>
      )
    }
    if (volume < 0.5) {
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
        </svg>
      )
    }
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
      </svg>
    )
  }

  return (
    <div className="audio-player">
      {hasError && (
        <div className="audio-error">
          <span>⚠️ Không thể phát audio: {error}. Hãy nhấn phát để thử lại.</span>
        </div>
      )}
      {disabled && <div className="player-status">Đang tạo bản dịch, tạm khóa nghe lại...</div>}
      <div className="player-main">
        <button
          className="play-btn"
          onClick={isPlaying ? onPause : onPlay}
          disabled={disabled}
          aria-label={isPlaying ? 'Tạm dừng audio' : 'Phát audio'}
        >
          {isPlaying ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        <div className="waveform-wrapper">
          <Waveform
            id={recordingId}
            currentTime={currentTime}
            duration={duration}
            onSeek={(ratio) => onSeek(ratio * duration)}
            disabled={disabled}
          />
        </div>
      </div>

      <div className="player-meta">
        {/* Time display */}
        <div className="time-display">
          <span>{formatTime(currentTime)}</span>
          <span className="time-separator">/</span>
          <span>{formatTime(duration)}</span>
        </div>

        {/* Speed Selector */}
        <div className="speed-selector">
          {([0.5, 1, 1.25, 1.5, 2] as const).map((s) => (
            <button
              key={s}
              className={`speed-btn ${speed === s ? 'active' : ''}`}
              onClick={() => onChangeSpeed(s)}
              disabled={disabled}
            >
              {s}x
            </button>
          ))}
        </div>

        <div className="volume-control-container">
          <button
            className="volume-icon-btn"
            onClick={toggleMute}
            disabled={disabled}
            title={volume === 0 ? 'Bật âm thanh' : 'Tắt âm thanh'}
          >
            {getVolumeIcon()}
          </button>

          <div className="volume-popover">
            <input
              className="volume-slider"
              type="range"
              min="0"
              max="2"
              step="0.05"
              value={volume}
              onChange={(event) => onChangeVolume(Number(event.target.value))}
              disabled={disabled}
              title="Âm lượng"
            />
            <span className="volume-popover-text">{Math.round(volume * 100)}%</span>
          </div>
        </div>
      </div>
    </div>
  )
}
