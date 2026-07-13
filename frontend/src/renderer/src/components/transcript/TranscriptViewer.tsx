import { useMemo, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../api/client'
import { queryKeys } from '../../constants'
import { useCancelTranscribe, useTranscribe } from '../../hooks/useTranscribe'
import './TranscriptViewer.css'

interface TranscriptViewerProps {
  recordingId: string
  recordingState: string
  errorSource?: string
  currentTime: number
  onSeek?: (time: number) => void
}

export function TranscriptViewer({
  recordingId,
  recordingState,
  errorSource,
  currentTime,
  onSeek
}: TranscriptViewerProps) {
  // Query: Get transcript (polls while transcribing/stopped)
  const { data: transcript } = useQuery({
    queryKey: queryKeys.transcript(recordingId),
    queryFn: () => api.getTranscript(recordingId),
    enabled:
      recordingState === 'completed' ||
      recordingState === 'transcribed' ||
      recordingState === 'transcribing' ||
      recordingState === 'stopped' ||
      recordingState === 'error',
    refetchInterval: recordingState === 'transcribing' ? 1000 : false
  })

  // Mutation: Start transcribing
  const transcribeMutation = useTranscribe(recordingId)
  const cancelMutation = useCancelTranscribe(recordingId)

  const displaySegments = useMemo(() => transcript?.segments ?? [], [transcript])
  const containerRef = useRef<HTMLDivElement>(null)

  // Find active segment with a 250ms snapping tolerance to prevent alignment issues
  const activeSegmentId = useMemo(() => {
    if (displaySegments.length === 0) return null
    const found = displaySegments.find((s) => currentTime >= s.start - 0.25 && currentTime < s.end)
    return found !== undefined ? found.id : null
  }, [displaySegments, currentTime])

  // Auto-scroll active segment into view
  useEffect(() => {
    if (activeSegmentId !== null && containerRef.current) {
      const activeEl = containerRef.current.querySelector('.segment-item.active')
      if (activeEl) {
        activeEl.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest'
        })
      }
    }
  }, [activeSegmentId])

  const isTranscribing = recordingState === 'transcribing'

  const formatSegmentTime = (secs: number) => {
    const m = Math.floor(secs / 60)
      .toString()
      .padStart(2, '0')
    const s = Math.floor(secs % 60)
      .toString()
      .padStart(2, '0')
    return `${m}:${s}`
  }

  const getSpeakerColorIndex = (speaker?: string) => {
    if (!speaker) return 0
    const match = speaker.match(/\d+/)
    if (match) {
      return parseInt(match[0], 10) % 6
    }
    let hash = 0
    for (let i = 0; i < speaker.length; i++) {
      hash = speaker.charCodeAt(i) + ((hash << 5) - hash)
    }
    return Math.abs(hash) % 6
  }

  return (
    <div className="transcript-viewer" ref={containerRef}>
      <div className="transcript-header">
        <h3>🎙️ Nội dung chi tiết (Transcript)</h3>
        {!isTranscribing &&
          ['stopped', 'transcribed', 'completed', 'error'].includes(recordingState) && (
            <button
              className="btn-header-action"
              onClick={() => transcribeMutation.mutate()}
              disabled={transcribeMutation.isPending}
              title={displaySegments.length > 0 ? 'Tạo lại bản dịch' : 'Tạo bản dịch'}
            >
              {displaySegments.length > 0 ? '🔄 Tạo lại' : '✨ Tạo bản dịch'}
            </button>
          )}
      </div>

      <div className="transcript-body">
        {isTranscribing ? (
          <div className="transcript-loading">
            <div className="spinner"></div>
            <p>Đang tạo bản dịch...</p>
            <button
              className="btn-cancel-stt"
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? 'Đang hủy...' : 'Hủy bản dịch'}
            </button>
          </div>
        ) : displaySegments.length > 0 ? (
          <div className="segments-list">
            {recordingState === 'error' && errorSource === 'transcribe' && (
              <div className="transcript-status-banner error">
                ⚠️ Đã xảy ra lỗi hoặc tác vụ bị hủy. Đang hiển thị bản dịch cũ.
              </div>
            )}
            {displaySegments.map((seg) => {
              const isActive = seg.id === activeSegmentId
              return (
                <div
                  key={seg.id}
                  className={`segment-item ${isActive ? 'active' : ''}`}
                  onClick={() => onSeek && onSeek(seg.start)}
                >
                  <div className="segment-body">
                    <div className="segment-header">
                      <span className="segment-time">{formatSegmentTime(seg.start)}</span>
                      {seg.speaker && (
                        <span
                          className={`segment-speaker speaker-${getSpeakerColorIndex(seg.speaker)}`}
                        >
                          {seg.speaker}
                        </span>
                      )}
                    </div>
                    <p className="segment-text">{seg.text}</p>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="transcript-empty">
            {recordingState === 'error' && errorSource === 'transcribe' ? (
              <p className="error-text">Đã xảy ra lỗi trong quá trình xử lý.</p>
            ) : (
              <p>Chưa có bản dịch</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
