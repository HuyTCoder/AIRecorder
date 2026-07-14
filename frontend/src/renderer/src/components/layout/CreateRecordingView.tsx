import { useState } from 'react'
import { useApp } from '../../store/AppContext'
import { useStartRecording } from '../../hooks/useStartRecording'
import { LiveVisualizer } from '../ui/LiveVisualizer'
import './CreateRecordingView.css'

export function CreateRecordingView() {
  const { dispatch } = useApp()

  const [newTitle, setNewTitle] = useState('')
  const [useMic, setUseMic] = useState(true)
  const [useSystem, setUseSystem] = useState(true)

  const handleMicToggle = (checked: boolean) => {
    if (!checked && !useSystem) setUseSystem(true)
    setUseMic(checked)
  }

  const handleSystemToggle = (checked: boolean) => {
    if (!checked && !useMic) setUseMic(true)
    setUseSystem(checked)
  }

  const startRecordingMutation = useStartRecording()

  const handleStart = () => {
    const title = newTitle.trim() || `Bản ghi âm #${Date.now().toString().slice(-4)}`

    let deviceName = 'Unknown'
    if (useMic && useSystem) deviceName = 'Mic + System'
    else if (useMic) deviceName = 'Microphone'
    else if (useSystem) deviceName = 'System Audio'

    startRecordingMutation.mutate(
      {
        request: {
          use_mic: useMic,
          use_system: useSystem,
          mic_device_id: undefined,
          system_device_id: undefined
        },
        title,
        deviceName
      },
      {
        onSuccess: (data) => {
          setNewTitle('')
          dispatch({ type: 'SET_CREATING_RECORDING', payload: false })
          dispatch({ type: 'SET_ACTIVE_RECORDING_ID', payload: data.id })
        }
      }
    )
  }

  return (
    <div className="create-view-container animate-fade-in">
      <div className="create-view-card">
        <h2 className="create-title">🎙️ Tạo bản ghi âm mới</h2>
        <p className="create-subtitle">Thiết lập nguồn âm thanh và bắt đầu thu âm ngay</p>

        <div className="create-form">
          <div className="form-group">
            <label htmlFor="recording-title">Tên bản ghi âm</label>
            <input
              id="recording-title"
              type="text"
              placeholder="Ví dụ: Họp dự án, Phỏng vấn..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              disabled={startRecordingMutation.isPending}
              autoFocus
            />
          </div>

          <div className="form-group sources-group">
            <label>Nguồn âm thanh</label>
            <div className="source-pills">
              <label className={`source-pill ${useMic ? 'selected' : ''}`}>
                <input
                  className="source-checkbox"
                  type="checkbox"
                  checked={useMic}
                  onChange={(e) => handleMicToggle(e.target.checked)}
                  disabled={startRecordingMutation.isPending}
                />
                <span className="source-icon">🎤</span>
                <span className="source-name">Microphone</span>
              </label>

              <label className={`source-pill ${useSystem ? 'selected' : ''}`}>
                <input
                  className="source-checkbox"
                  type="checkbox"
                  checked={useSystem}
                  onChange={(e) => handleSystemToggle(e.target.checked)}
                  disabled={startRecordingMutation.isPending}
                />
                <span className="source-icon">🔊</span>
                <span className="source-name">Âm thanh hệ thống</span>
              </label>
            </div>
          </div>

          {/* Live visualizer preview */}
          {useMic && (
            <div className="live-preview-visualizer" style={{ marginTop: '8px' }}>
              <span
                className="visualizer-label"
                style={{
                  fontSize: '12px',
                  color: 'var(--text-muted)',
                  display: 'block',
                  textAlign: 'center',
                  marginBottom: '4px'
                }}
              >
                Đang thử Microphone...
              </span>
              <LiveVisualizer isActive={true} useMic={useMic} height={40} barCount={24} />
            </div>
          )}

          <div className="form-actions" style={{ marginTop: '24px' }}>
            <button
              className="modal-btn-start"
              onClick={handleStart}
              disabled={startRecordingMutation.isPending || (!useMic && !useSystem)}
            >
              {startRecordingMutation.isPending ? 'Đang khởi động...' : '▶️ Bắt đầu'}
            </button>
            <button
              className="modal-btn-cancel"
              onClick={() => dispatch({ type: 'SET_CREATING_RECORDING', payload: false })}
              disabled={startRecordingMutation.isPending}
            >
              ❌ Hủy
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
