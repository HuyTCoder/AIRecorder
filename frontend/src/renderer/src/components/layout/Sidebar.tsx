import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'
import { queryKeys } from '../../constants'
import { useApp } from '../../store/AppContext'
import { getRecordingTitle, formatDate, formatTime } from '../../utils/format'
import { useToast } from '../ui/ToastProvider'
import { CustomSelect, CustomSelectChangeEvent } from '../ui/CustomSelect'
import { RecordingSession } from '../../types/recording'
import { convertToStandardWav } from '../../utils/audioConverter'
import './Sidebar.css'

export function Sidebar({ width }: { width?: number }) {
  const { state: uiState, dispatch } = useApp()
  const queryClient = useQueryClient()
  const toast = useToast()

  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'title'>('newest')
  const [isImporting, setIsImporting] = useState(false)

  // Context Menu & Rename States
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [menuDirection, setMenuDirection] = useState<'down' | 'up'>('down')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameTitle, setRenameTitle] = useState('')

  // Query: Get list of recordings
  const {
    data: recordings = [],
    isLoading,
    error
  } = useQuery({
    queryKey: queryKeys.recordings(),
    queryFn: () => api.listRecordings(),
    // Poll list regularly in case of background state changes
    refetchInterval: (query) => {
      const data = query.state.data
      const isProcessing = data?.some(
        (r) => r.state === 'transcribing' || r.state === 'summarizing' || r.state === 'recording'
      )
      return isProcessing ? 1500 : 5000
    }
  })

  // Mutation: Delete recording
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteRecording(id),
    onSuccess: (_, deletedId) => {
      toast('Đã xoá bản ghi thành công!')
      queryClient.invalidateQueries({ queryKey: queryKeys.recordings() })
      if (uiState.activeRecordingId === deletedId) {
        dispatch({ type: 'SET_ACTIVE_RECORDING_ID', payload: null })
      }
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : 'Unknown error'
      toast(`Không thể xoá bản ghi: ${message}`)
    }
  })

  // Mutation: Rename recording
  const renameMutation = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      api.updateRecording(id, { title }),
    onSuccess: () => {
      toast('Đã đổi tên bản ghi thành công!')
      queryClient.invalidateQueries({ queryKey: queryKeys.recordings() })
      setRenamingId(null)
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : 'Unknown error'
      toast(`Không thể đổi tên: ${message}`)
    }
  })

  // Filter and sort recordings
  const filteredRecordings = useMemo(() => {
    let result = [...recordings]

    // Filter
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter((r) => getRecordingTitle(r).toLowerCase().includes(q))
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }
      if (sortBy === 'oldest') {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      }
      if (sortBy === 'title') {
        return getRecordingTitle(a).localeCompare(getRecordingTitle(b))
      }
      return 0
    })

    return result
  }, [recordings, search, sortBy])

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (confirm('Bạn có chắc chắn muốn xoá bản ghi này?')) {
      deleteMutation.mutate(id)
      setMenuOpenId(null)
    }
  }

  const handleRenameSubmit = (e: React.FormEvent, id: string) => {
    e.preventDefault()
    if (!renameTitle.trim()) {
      setRenamingId(null)
      return
    }
    renameMutation.mutate({ id, title: renameTitle.trim() })
  }

  const getBadgeClass = (state: string) => {
    switch (state) {
      case 'recording':
        return 'badge badge-recording animate-pulse-recording'
      case 'paused':
        return 'badge badge-paused'
      case 'transcribing':
        return 'badge badge-transcribing'
      case 'transcribed':
        return 'badge badge-transcribing'
      case 'summarizing':
        return 'badge badge-summarizing'
      case 'completed':
        return 'badge badge-completed'
      case 'error':
        return 'badge badge-failed'
      default:
        return 'badge'
    }
  }

  const getBadgeText = (rec: RecordingSession) => {
    switch (rec.state) {
      case 'recording':
        return 'Đang thu âm'
      case 'paused':
        return 'Tạm dừng'
      case 'stopped':
        return 'Đã dừng'
      case 'transcribing':
        return 'Đang dịch...'
      case 'transcribed':
        return 'Đã dịch xong'
      case 'summarizing':
        return 'Đang tóm tắt...'
      case 'completed':
        return 'Đã tóm tắt xong'
      case 'error':
        if (rec.error_source === 'summarize') return 'Lỗi tóm tắt'
        if (rec.error_source === 'transcribe') return 'Lỗi dịch'
        return 'Lỗi'
      default:
        return rec.state
    }
  }

  const handleImportClick = () => {
    if (isImporting) return
    document.getElementById('import-audio-file')?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsImporting(true)
    toast('Đang chuẩn hoá và nhập file âm thanh...')

    try {
      // 1. Chuyển đổi sang WAV 16kHz Mono 16-bit PCM
      const wavBlob = await convertToStandardWav(file)

      // 2. Upload file lên backend
      const title = file.name.substring(0, file.name.lastIndexOf('.')) || file.name
      const response = await api.uploadRecording(wavBlob, title)

      toast('Nhập file âm thanh thành công!')

      // 3. Reload list recordings và chọn bản ghi mới
      queryClient.invalidateQueries({ queryKey: queryKeys.recordings() })
      dispatch({ type: 'SET_CREATING_RECORDING', payload: false })
      dispatch({ type: 'SET_ACTIVE_RECORDING_ID', payload: response.id })
    } catch (error) {
      console.error(error)
      toast(`Lỗi khi nhập file: ${error instanceof Error ? error.message : 'Lỗi không xác định'}`)
    } finally {
      setIsImporting(false)
      e.target.value = ''
    }
  }

  return (
    <div
      className="sidebar"
      style={{
        width: width ? `${width}px` : undefined,
        minWidth: '200px'
      }}
    >
      {/* Hidden file input */}
      <input
        type="file"
        id="import-audio-file"
        style={{ display: 'none' }}
        accept="audio/*"
        onChange={handleFileChange}
      />

      <div className="sidebar-header">
        <button
          className="btn-new-recording"
          onClick={() => dispatch({ type: 'SET_CREATING_RECORDING', payload: true })}
        >
          <span className="btn-icon">🎙️</span> Ghi âm mới
        </button>
        <button
          className="btn-import-circle"
          onClick={handleImportClick}
          disabled={isImporting}
          title="Nhập file âm thanh từ bên ngoài"
        >
          {isImporting ? <div className="spinner-micro"></div> : '📁'}
        </button>
        <button
          className="btn-settings-circle"
          onClick={() => dispatch({ type: 'SET_SETTINGS_MODAL_OPEN', payload: true })}
          title="Cài đặt"
        >
          ⚙️
        </button>
      </div>

      {/* Bộ lọc Tìm kiếm & Sắp xếp */}
      <div className="sidebar-filter">
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Tìm kiếm bản ghi..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div style={{ minWidth: '110px' }}>
          <CustomSelect
            value={sortBy}
            onChange={(event: CustomSelectChangeEvent) =>
              setSortBy(event.target.value as 'newest' | 'oldest' | 'title')
            }
            options={[
              { value: 'newest', label: 'Mới nhất' },
              { value: 'oldest', label: 'Cũ nhất' },
              { value: 'title', label: 'Tên A-Z' }
            ]}
          />
        </div>
      </div>

      {/* Danh sách các Recording */}
      <div className="recordings-list">
        {isLoading && recordings.length === 0 ? (
          <div className="sidebar-placeholder">
            <div className="spinner" style={{ margin: '0 auto 10px' }}></div>
            <p>Đang tải dữ liệu...</p>
          </div>
        ) : error ? (
          <div className="sidebar-placeholder error-text">Lỗi tải dữ liệu</div>
        ) : filteredRecordings.length === 0 ? (
          <div className="sidebar-placeholder">Không tìm thấy bản ghi nào</div>
        ) : (
          filteredRecordings.map((rec) => {
            const isActive = uiState.activeRecordingId === rec.id
            return (
              <div
                key={rec.id}
                className={`recording-item ${isActive ? 'active' : ''}`}
                onClick={() => dispatch({ type: 'SET_ACTIVE_RECORDING_ID', payload: rec.id })}
              >
                <div className="item-header">
                  {renamingId === rec.id ? (
                    <form
                      onSubmit={(e) => handleRenameSubmit(e, rec.id)}
                      className="rename-form"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="text"
                        value={renameTitle}
                        onChange={(e) => setRenameTitle(e.target.value)}
                        autoFocus
                        onBlur={() => setRenamingId(null)}
                      />
                    </form>
                  ) : (
                    <span className="item-title" title={getRecordingTitle(rec)}>
                      {getRecordingTitle(rec)}
                    </span>
                  )}
                </div>
                <div className="item-meta">
                  <span className="item-date">{formatDate(rec.created_at)}</span>
                  <div className="item-duration-wrapper">
                    <span className="item-duration">{formatTime(rec.duration)}</span>
                    {rec.state !== 'recording' && rec.state !== 'paused' && (
                      <div className="item-menu-container">
                        <button
                          className="item-menu-btn"
                          onClick={(e) => {
                            e.stopPropagation()
                            if (menuOpenId !== rec.id) {
                              const rect = e.currentTarget.getBoundingClientRect()
                              // If within 150px of bottom, open upward
                              if (window.innerHeight - rect.bottom < 150) {
                                setMenuDirection('up')
                              } else {
                                setMenuDirection('down')
                              }
                              setMenuOpenId(rec.id)
                            } else {
                              setMenuOpenId(null)
                            }
                          }}
                          title="Tùy chọn"
                        >
                          ⋮
                        </button>

                        {menuOpenId === rec.id && (
                          <div
                            className={`item-dropdown-menu ${menuDirection === 'up' ? 'drop-up' : ''}`}
                          >
                            <button
                              className="dropdown-item"
                              onClick={(e) => {
                                e.stopPropagation()
                                setMenuOpenId(null)
                                setRenamingId(rec.id)
                                setRenameTitle(getRecordingTitle(rec))
                              }}
                            >
                              ✏️ Đổi tên
                            </button>
                            <button
                              className="dropdown-item text-error"
                              onClick={(e) => handleDelete(e, rec.id)}
                            >
                              🗑️ Xoá
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="item-status">
                  <span className={getBadgeClass(rec.state)}>
                    {(rec.state === 'transcribing' || rec.state === 'summarizing') && (
                      <div className="badge-spinner"></div>
                    )}
                    {getBadgeText(rec)}
                  </span>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
