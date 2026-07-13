import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../api/client'
import { queryKeys } from '../../constants'
import { useApp } from '../../store/AppContext'
import { buildMarkdown } from '../../utils/markdown'
import { useToast } from '../ui/ToastProvider'
import { getRecordingTitle } from '../../utils/format'
import { useSummarize } from '../../hooks/useSummarize'
import './AIPanel.css'

export function AIPanel({ width }: { width?: number }) {
  const { state: uiState } = useApp()
  const toast = useToast()
  const activeId = uiState.activeRecordingId

  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({})

  // Load checked items for the current session from localStorage
  useEffect(() => {
    if (activeId) {
      const saved = localStorage.getItem(`checked_actions_${activeId}`)
      if (saved) {
        try {
          setCheckedItems(JSON.parse(saved))
        } catch {
          setCheckedItems({})
        }
      } else {
        setCheckedItems({})
      }
    }
  }, [activeId])

  const handleToggleAction = (itemText: string) => {
    const next = {
      ...checkedItems,
      [itemText]: !checkedItems[itemText]
    }
    setCheckedItems(next)
    if (activeId) {
      localStorage.setItem(`checked_actions_${activeId}`, JSON.stringify(next))
    }
  }

  // Query: Get active recording details
  const { data: recording } = useQuery({
    queryKey: queryKeys.recording(activeId || ''),
    queryFn: () => api.getRecording(activeId || ''),
    enabled: !!activeId,
    refetchInterval: (query) => {
      const state = query.state.data?.state
      return state === 'summarizing' || state === 'transcribing' ? 1000 : false
    }
  })

  // Query: Get summary (if completed)
  const { data: summary } = useQuery({
    queryKey: queryKeys.summary(activeId || ''),
    queryFn: () => api.getSummary(activeId || ''),
    enabled: !!activeId && recording?.state === 'completed'
  })

  // Query: Get transcript (if completed)
  const { data: transcript } = useQuery({
    queryKey: queryKeys.transcript(activeId || ''),
    queryFn: () => api.getTranscript(activeId || ''),
    enabled: !!activeId && (recording?.state === 'completed' || recording?.state === 'transcribed')
  })

  // Mutation: Trigger AI Summarization
  const summarizeMutation = useSummarize(activeId)

  const handleCopy = () => {
    if (!recording || !summary) return
    const mdContent = buildMarkdown(recording, transcript, summary)
    navigator.clipboard.writeText(mdContent)
    toast('Đã sao chép nội dung tóm tắt dạng Markdown!')
  }

  const handleExport = async () => {
    if (!recording || !summary) return
    const title = getRecordingTitle(recording)
    const filename = `${title.replace(/\s+/g, '_')}_summary.md`
    try {
      const { filePath } = await window.electronAPI.showSaveDialog(filename)
      if (filePath) {
        const mdContent = buildMarkdown(recording, transcript, summary)
        await window.electronAPI.writeFile(filePath, mdContent)
        toast('Đã xuất file Markdown thành công!')
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unknown error'
      toast(`Lỗi xuất file: ${message}`)
    }
  }

  if (!activeId || !recording) {
    return (
      <div
        className="ai-panel empty"
        style={{
          width: width ? `${width}px` : undefined,
          minWidth: '200px'
        }}
      >
        <div className="empty-state">
          <span className="empty-icon">🧠</span>
          <p>Chọn một bản ghi âm để xem Tóm tắt AI</p>
        </div>
      </div>
    )
  }

  const isSummarizing = recording.state === 'summarizing'
  const hasTranscript = Boolean(transcript && transcript.text && transcript.text.trim())
  const canSummarize = ['stopped', 'transcribed', 'completed', 'error'].includes(recording.state)
  const hasSummary = Boolean(summary && summary.summary)

  return (
    <div
      className="ai-panel"
      style={{
        width: width ? `${width}px` : undefined,
        minWidth: '200px'
      }}
    >
      <div className="ai-panel-header">
        <h2>Tóm tắt AI</h2>
        <div className="ai-actions">
          {!isSummarizing && canSummarize && hasTranscript && (
            <button
              className="ai-btn-action"
              onClick={() => summarizeMutation.mutate()}
              disabled={summarizeMutation.isPending}
              title={hasSummary ? 'Tạo lại tóm tắt' : 'Tạo tóm tắt'}
            >
              {hasSummary ? '🔄 Tạo lại' : '🤖 Tạo tóm tắt'}
            </button>
          )}
          {hasSummary && (
            <>
              <button className="ai-btn-action" onClick={handleCopy} title="Sao chép Markdown">
                📋 Sao chép
              </button>
              <button className="ai-btn-action" onClick={handleExport} title="Xuất file Markdown">
                📥 Xuất tệp
              </button>
            </>
          )}
        </div>
      </div>

      <div className="ai-panel-content">
        {isSummarizing ? (
          <div className="ai-loading">
            <div className="spinner"></div>
            <p>Đang tạo tóm tắt...</p>
          </div>
        ) : summary ? (
          <div className="ai-results animate-fade-in">
            {recording.state === 'error' && recording.error_source === 'summarize' && (
              <div className="ai-status-banner error">
                ⚠️ Đã xảy ra lỗi hoặc tác vụ bị hủy. Đang hiển thị bản tóm tắt cũ.
              </div>
            )}
            {/* Tóm tắt tổng quan */}
            <div className="ai-section">
              <h3>📝 Nội dung tóm tắt</h3>
              <p className="ai-summary-text">{summary.summary}</p>
            </div>

            {/* Ý chính */}
            {summary.key_points && summary.key_points.length > 0 && (
              <div className="ai-section">
                <h3>💡 Các điểm chính</h3>
                <ul className="ai-list">
                  {summary.key_points.map((point, index) => (
                    <li key={index}>{point}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Hành động cần làm */}
            {summary.action_items && summary.action_items.length > 0 && (
              <div className="ai-section">
                <h3>🎯 Việc cần làm</h3>
                <ul className="ai-list todo-list">
                  {summary.action_items.map((item, index) => {
                    const isChecked = !!checkedItems[item]
                    return (
                      <li key={index} className="action-item-wrapper">
                        <label className="checkbox-action-label">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleAction(item)}
                          />
                          <span className={isChecked ? 'checked' : ''}>{item}</span>
                        </label>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
          </div>
        ) : !hasTranscript ? (
          <div className="ai-empty">
            <p className="warning-text">
              ⚠️ Vui lòng hoàn tất bản dịch (Transcript) để AI có thể tóm tắt nội dung.
            </p>
          </div>
        ) : (
          <div className="ai-empty">
            {recording.state === 'error' && recording.error_source === 'summarize' ? (
              <p className="error-text">Đã xảy ra lỗi trong quá trình xử lý.</p>
            ) : (
              <p>Chưa có tóm tắt AI cho bản ghi âm này.</p>
            )}
            {canSummarize && (
              <button
                className="btn-trigger-ai"
                onClick={() => summarizeMutation.mutate()}
                disabled={summarizeMutation.isPending}
              >
                {summarizeMutation.isPending ? 'Đang xử lý...' : '✨ Tạo tóm tắt'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
