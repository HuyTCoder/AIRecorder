import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useApp } from '../../store/AppContext'
import { api } from '../../api/client'
import { LiveVisualizer } from '../ui/LiveVisualizer'
import { queryKeys } from '../../constants'
import { formatTime, formatDate, getRecordingTitle } from '../../utils/format'
import { TitleBar } from './TitleBar'
import { Sidebar } from './Sidebar'
import { AIPanel } from './AIPanel'
import { CreateRecordingView } from './CreateRecordingView'
import { SettingsModal } from './SettingsModal'
import { AudioPlayer } from '../player/AudioPlayer'
import { TranscriptViewer } from '../transcript/TranscriptViewer'
import { useAudioPlayer } from '../../hooks/useAudioPlayer'
import { usePauseRecording } from '../../hooks/usePauseRecording'
import { useResumeRecording } from '../../hooks/useResumeRecording'
import { useStopRecording } from '../../hooks/useStopRecording'
import { useDeleteRecording } from '../../hooks/useDeleteRecording'
import { usePanelResize } from '../../hooks/usePanelResize'
import './AppShell.css'

export function AppShell() {
  const { state: uiState, dispatch } = useApp()
  const activeId = uiState.activeRecordingId
  const [isAIPanelCollapsed, setIsAIPanelCollapsed] = useState(false)

  // Query: Get active recording details (polls while transcribing/summarizing)
  const { data: activeRecording } = useQuery({
    queryKey: queryKeys.recording(activeId || ''),
    queryFn: () => api.getRecording(activeId || ''),
    enabled: !!activeId,
    refetchInterval: (query) => {
      const state = query.state.data?.state
      return state === 'transcribing' || state === 'summarizing' ? 2000 : false
    }
  })

  // 1. Tick live recording timer
  useEffect(() => {
    if (uiState.liveRecording.state !== 'recording') return
    const timer = setInterval(() => {
      dispatch({ type: 'TICK_DURATION' })
    }, 1000)
    return () => clearInterval(timer)
  }, [uiState.liveRecording.state, dispatch])

  const isLive = activeRecording?.state === 'recording' || activeRecording?.state === 'paused'
  const streamUrl = activeRecording && !isLive ? api.streamUrl(activeRecording.id) : undefined
  const {
    isPlaying,
    currentTime,
    duration: playerDuration,
    speed,
    volume,
    error: audioError,
    play,
    pause,
    seek,
    changeSpeed,
    changeVolume
  } = useAudioPlayer(streamUrl, activeRecording?.duration || 0)

  const displayDuration = playerDuration || activeRecording?.duration || 0

  // Custom recording hooks
  const pauseMutation = usePauseRecording(activeId)
  const resumeMutation = useResumeRecording(activeId)
  const stopMutation = useStopRecording(activeId)
  const deleteMutation = useDeleteRecording()

  // Resizers
  const sidebarResize = usePanelResize('sidebar', 320, 200, 600)
  const aiPanelResize = usePanelResize('aipanel', 340, 200, 600)

  return (
    <div className="app-shell">
      {/* Frameless window drag area and control buttons */}
      <TitleBar />

      {/* Main UI Body */}
      <div className="app-body">
        {/* Left column: search, sort, and list */}
        <Sidebar width={sidebarResize.width} />

        <div
          className={`panel-resizer ${sidebarResize.isDragging ? 'dragging' : ''}`}
          onMouseDown={sidebarResize.startDrag}
        />

        {/* Middle column: Main Work Area */}
        <div className="main-content">
          {uiState.isCreatingRecording ? (
            <CreateRecordingView />
          ) : activeRecording ? (
            <div className="recording-details">
              <div className="details-header">
                <div>
                  <h1 className="details-title">{getRecordingTitle(activeRecording)}</h1>
                  <span className="details-date">{formatDate(activeRecording.created_at)}</span>
                </div>
                {isAIPanelCollapsed &&
                  activeRecording.state !== 'recording' &&
                  activeRecording.state !== 'paused' &&
                  uiState.liveRecording.state !== 'saving' && (
                    <button
                      className="ai-toggle-btn-open"
                      onClick={() => setIsAIPanelCollapsed(false)}
                      title="Mở cột tóm tắt AI"
                    >
                      <svg
                        className="icon-normal"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="15" y1="3" x2="15" y2="21"></line>
                      </svg>
                      <svg
                        className="icon-hover"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="15" y1="3" x2="15" y2="21"></line>
                        <path d="M12 15l-3-3 3-3"></path>
                      </svg>
                    </button>
                  )}
              </div>

              <div className="details-body">
                {/* Live recording active dashboard */}
                {/* Check if currently saving this active recording */}
                {activeRecording.id === uiState.liveRecording.id &&
                uiState.liveRecording.state === 'saving' ? (
                  <div className="saving-loader-overlay animate-fade-in">
                    <div className="saving-spinner" />
                    <div className="saving-loader-title">Đang lưu bản ghi âm...</div>
                    <div className="saving-loader-subtitle">
                      Hệ thống đang hoàn tất tệp âm thanh và chuẩn bị dữ liệu.
                    </div>
                  </div>
                ) : activeRecording.state === 'recording' || activeRecording.state === 'paused' ? (
                  <div className="live-dashboard">
                    <div className="live-status animate-fade-in">
                      <div
                        className={`live-pulse-dot ${activeRecording.state === 'recording' ? 'animate-pulse-recording' : 'paused'}`}
                      />
                      <span>
                        {activeRecording.state === 'recording' ? 'ĐANG THU ÂM...' : 'ĐANG TẠM DỪNG'}
                      </span>
                    </div>

                    <div className="live-timer">{formatTime(uiState.liveRecording.duration)}</div>

                    <div className="live-device-label">
                      Thiết bị: {uiState.liveRecording.deviceName || 'Microphone'}
                    </div>

                    <LiveVisualizer
                      isActive={activeRecording.state === 'recording'}
                      useMic={activeRecording.use_mic}
                      height={50}
                      barCount={28}
                    />

                    {/* Live recording actions */}
                    <div className="live-actions">
                      {activeRecording.state === 'recording' ? (
                        <button
                          className="btn-live btn-pause"
                          onClick={() => pauseMutation.mutate()}
                          disabled={pauseMutation.isPending}
                        >
                          ⏸️ Tạm dừng
                        </button>
                      ) : (
                        <button
                          className="btn-live btn-resume"
                          onClick={() => resumeMutation.mutate()}
                          disabled={resumeMutation.isPending}
                        >
                          ▶️ Tiếp tục
                        </button>
                      )}
                      <button
                        className="btn-live btn-stop"
                        onClick={() => {
                          dispatch({ type: 'SAVE_LIVE_RECORDING' })
                          stopMutation.mutate()
                        }}
                        disabled={stopMutation.isPending}
                      >
                        ⏹️ Kết thúc
                      </button>
                      <button
                        className="btn-live btn-cancel"
                        onClick={() => {
                          if (
                            window.confirm(
                              'Bạn có chắc chắn muốn hủy bản ghi này không? (Dữ liệu sẽ bị xóa hoàn toàn)'
                            )
                          ) {
                            deleteMutation.mutate(activeRecording.id)
                          }
                        }}
                        disabled={deleteMutation.isPending}
                      >
                        ❌ Hủy
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Audio playback and transcripts once stopped */
                  <div className="completed-dashboard animate-fade-in">
                    {/* Native player with our custom wrapper */}
                    <AudioPlayer
                      recordingId={activeRecording.id}
                      isPlaying={isPlaying}
                      currentTime={currentTime}
                      duration={displayDuration}
                      speed={speed}
                      volume={volume}
                      error={audioError}
                      onPlay={play}
                      onPause={pause}
                      onSeek={seek}
                      onChangeSpeed={changeSpeed}
                      onChangeVolume={changeVolume}
                    />

                    {/* Speech to text viewer */}
                    <TranscriptViewer
                      recordingId={activeRecording.id}
                      recordingState={activeRecording.state}
                      errorSource={activeRecording.error_source}
                      currentTime={currentTime}
                      onSeek={seek}
                    />
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="main-placeholder">
              <span className="placeholder-icon">🎙️</span>
              <p>Hãy chọn một bản ghi âm hoặc tạo mới để bắt đầu.</p>
            </div>
          )}
        </div>

        {/* Right column: AI Panel */}
        {activeRecording &&
          !uiState.isCreatingRecording &&
          activeRecording.state !== 'recording' &&
          activeRecording.state !== 'paused' &&
          uiState.liveRecording.state !== 'saving' &&
          !isAIPanelCollapsed && (
            <>
              <div
                className={`panel-resizer ${aiPanelResize.isDragging ? 'dragging' : ''}`}
                onMouseDown={aiPanelResize.startDrag}
              />
              <AIPanel width={aiPanelResize.width} onClose={() => setIsAIPanelCollapsed(true)} />
            </>
          )}
      </div>

      {/* Modals */}
      <SettingsModal />
    </div>
  )
}
