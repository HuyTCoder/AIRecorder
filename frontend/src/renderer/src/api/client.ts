import { API_BASE_URL } from '../constants'
import { DeviceListResponse } from '../types/device'
import { RecordingSession, StartRecordingRequest } from '../types/recording'
import { TranscriptData } from '../types/transcript'
import { SummaryData } from '../types/summary'
import { TaskResponse } from '../types/api'
import { Settings, SettingsUpdate } from '../types/settings'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// TOGGLE MOCK MODE (Set to false when connecting to the real backend)
const USE_MOCK = false
const API_REQUEST_TIMEOUT_MS = 10000

// Initial Mock Data
const INITIAL_RECORDINGS: RecordingSession[] = [
  {
    id: 'rec_1',
    state: 'completed',
    source_type: 'mixed',
    use_mic: true,
    use_system: true,
    created_at: '2026-07-08T09:30:00Z',
    duration: 45,
    title: 'Cuộc họp Daily Sync'
  },
  {
    id: 'rec_2',
    state: 'completed',
    source_type: 'mic',
    use_mic: true,
    use_system: false,
    created_at: '2026-07-07T15:45:00Z',
    duration: 32,
    title: 'Ý tưởng dự án mới'
  },
  {
    id: 'rec_3',
    state: 'completed',
    source_type: 'system',
    use_mic: false,
    use_system: true,
    created_at: '2026-07-06T10:15:00Z',
    duration: 50,
    title: 'Học Tiếng Anh - Unit 5'
  }
]

const INITIAL_TRANSCRIPTS: Record<string, TranscriptData> = {
  rec_1: {
    recording_id: 'rec_1',
    text: 'Chào mọi người, hôm nay chúng ta review lại tiến độ Giai đoạn 2 nhé. Phần Backend ghi âm cơ bản và pipeline WAV đã được tôi deploy test thử, chạy rất mượt. Tuyệt vời, vậy ngày mai mình bắt đầu tích hợp Zipformer luôn nha.',
    segments: [
      {
        id: 1,
        start: 0,
        end: 15,
        text: 'Chào mọi người, hôm nay chúng ta review lại tiến độ Giai đoạn 2 nhé.',
        speaker: 'Minh Anh'
      },
      {
        id: 2,
        start: 15,
        end: 30,
        text: 'Phần Backend ghi âm cơ bản và pipeline WAV đã được tôi deploy test thử, chạy rất mượt.',
        speaker: 'Quốc Bảo'
      },
      {
        id: 3,
        start: 30,
        end: 45,
        text: 'Tuyệt vời, vậy ngày mai mình bắt đầu tích hợp Zipformer luôn nha.',
        speaker: 'Minh Anh'
      }
    ]
  },
  rec_2: {
    recording_id: 'rec_2',
    text: 'Tôi nghĩ chúng ta nên tích hợp thêm tính năng xuất báo cáo cuộc họp sang file PDF để chia sẻ nhanh. Người dùng cũng có thể cấu hình phím tắt global để nhấn ghi âm mà không cần mở cửa sổ app.',
    segments: [
      {
        id: 1,
        start: 0,
        end: 18,
        text: 'Tôi nghĩ chúng ta nên tích hợp thêm tính năng xuất báo cáo cuộc họp sang file PDF để chia sẻ nhanh.',
        speaker: 'Minh Anh'
      },
      {
        id: 2,
        start: 18,
        end: 32,
        text: 'Người dùng cũng có thể cấu hình phím tắt global để nhấn ghi âm mà không cần mở cửa sổ app.',
        speaker: 'Minh Anh'
      }
    ]
  },
  rec_3: {
    recording_id: 'rec_3',
    text: 'Today we will practice active listening with news audio chunks from BBC. Make sure you focus on the linking words used by the speakers.',
    segments: [
      {
        id: 1,
        start: 0,
        end: 25,
        text: 'Today we will practice active listening with news audio chunks from BBC.',
        speaker: 'Giảng viên'
      },
      {
        id: 2,
        start: 25,
        end: 50,
        text: 'Make sure you focus on the linking words used by the speakers.',
        speaker: 'Giảng viên'
      }
    ]
  }
}

const INITIAL_SUMMARIES: Record<string, SummaryData> = {
  rec_1: {
    recording_id: 'rec_1',
    summary:
      'Cuộc họp nhanh đánh giá tiến độ Giai đoạn 2. Backend ghi âm hoạt động ổn định và kế hoạch tiếp theo là tích hợp mô hình chuyển đổi giọng nói (Zipformer).',
    key_points: [
      'Đã hoàn thành cơ bản pipeline thu âm WAV ở Backend.',
      'Đã thống nhất cấu trúc file metadata.json.',
      'Sẵn sàng chuyển sang Phase 4 vào ngày mai.'
    ],
    action_items: [
      'Cài đặt thư viện sherpa-onnx ở Backend.',
      'Thiết kế giao diện cho Electron Renderer.'
    ]
  },
  rec_2: {
    recording_id: 'rec_2',
    summary:
      'Ghi chú cá nhân về các ý tưởng mở rộng ứng dụng AI Recorder bao gồm xuất PDF và phím tắt toàn hệ thống.',
    key_points: [
      'Ý tưởng xuất báo cáo PDF tự động chứa tóm tắt và hành động chính.',
      'Ý tưởng phím tắt toàn hệ thống (Global Hotkeys) tối ưu hóa trải nghiệm.'
    ],
    action_items: [
      'Khảo sát thư viện export PDF trong Node/Python.',
      'Nghiên cứu API globalShortcut của Electron.'
    ]
  },
  rec_3: {
    recording_id: 'rec_3',
    summary:
      'Ghi lại bài giảng trực tuyến Unit 5 phần Luyện nghe Tiếng Anh qua các đoạn tin ngắn của BBC.',
    key_points: [
      'Bài học tập trung vào Linking Words (Từ nối).',
      'Sử dụng tin tức BBC để làm ngữ liệu thực hành.'
    ],
    action_items: [
      'Xem lại các từ nối đã ghi chú trong transcript.',
      'Hoàn thành bài tập nghe trên hệ thống LMS.'
    ]
  }
}

// LocalStorage Helper
const getStore = <T>(key: string, initial: T): T => {
  const data = localStorage.getItem(`mock_${key}`)
  if (!data) {
    localStorage.setItem(`mock_${key}`, JSON.stringify(initial))
    return initial
  }
  try {
    return JSON.parse(data)
  } catch {
    return initial
  }
}

const setStore = <T>(key: string, value: T): void => {
  localStorage.setItem(`mock_${key}`, JSON.stringify(value))
}

// Initialize Mock Databases
getStore('recordings', INITIAL_RECORDINGS)
getStore('transcripts', INITIAL_TRANSCRIPTS)
getStore('summaries', INITIAL_SUMMARIES)

export async function request<T>(
  path: string,
  init?: RequestInit,
  signal?: AbortSignal
): Promise<T> {
  const controller = new AbortController()
  let timedOut = false
  const timeoutId = window.setTimeout(() => {
    timedOut = true
    controller.abort()
  }, API_REQUEST_TIMEOUT_MS)
  const abortRequest = () => controller.abort()

  signal?.addEventListener('abort', abortRequest, { once: true })

  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...init?.headers
      },
      signal: controller.signal
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new ApiError(
        res.status,
        body.error?.message || body.detail || `HTTP Error ${res.status}`
      )
    }

    if (res.status === 204) {
      return undefined as T
    }

    return res.json()
  } catch (error) {
    if (timedOut) {
      throw new Error(`API request timed out after ${API_REQUEST_TIMEOUT_MS / 1000} seconds`)
    }
    throw error
  } finally {
    window.clearTimeout(timeoutId)
    signal?.removeEventListener('abort', abortRequest)
  }
}

export const api = {
  // Settings endpoints
  getSettings: async (signal?: AbortSignal): Promise<Settings> => {
    if (!USE_MOCK) {
      return request<Settings>('/settings', {}, signal)
    }
    return getStore<Settings>('settings', {
      ai_provider: 'gemini',
      gemini_api_key: '',
      chatgpt_api_key: '',
      claude_api_key: '',
      model: '',
      theme: 'dark',
      font_size: 'small',
      prompt:
        'Bạn là một trợ lý AI chuyên nghiệp. Dưới đây là nội dung giải băng (transcript) của một buổi ghi âm.\nHãy tóm tắt cuộc thảo luận này và trích xuất các ý chính (key points) cùng các hành động cần thực hiện (action items).\nTất cả kết quả đầu ra phải được viết bằng tiếng Việt. Trả về định dạng JSON bám sát schema sau: {"summary": "...", "key_points": ["..."], "action_items": ["..."]}'
    })
  },

  updateSettings: async (body: SettingsUpdate): Promise<Settings> => {
    if (!USE_MOCK) {
      return request<Settings>('/settings', {
        method: 'POST',
        body: JSON.stringify(body)
      })
    }
    const current = getStore<Settings>('settings', {
      ai_provider: 'gemini',
      gemini_api_key: '',
      chatgpt_api_key: '',
      claude_api_key: '',
      model: '',
      theme: 'dark',
      font_size: 'small',
      prompt:
        'Bạn là một trợ lý AI chuyên nghiệp. Dưới đây là nội dung giải băng (transcript) của một buổi ghi âm.\nHãy tóm tắt cuộc thảo luận này và trích xuất các ý chính (key points) cùng các hành động cần thực hiện (action items).\nTất cả kết quả đầu ra phải được viết bằng tiếng Việt. Trả về định dạng JSON bám sát schema sau: {"summary": "...", "key_points": ["..."], "action_items": ["..."]}'
    })
    const updated = {
      ...current,
      ...body
    }
    setStore('settings', updated)
    return updated
  },

  // Device endpoints
  getDevices: async (advanced = false, signal?: AbortSignal): Promise<DeviceListResponse> => {
    if (!USE_MOCK) {
      const qs = advanced ? '?advanced=true' : ''
      return request<DeviceListResponse>(`/devices${qs}`, {}, signal)
    }
    return {
      microphones: [
        {
          id: 0,
          name: 'Realtek Microphone',
          full_name: 'Microphone (Realtek HD Audio Mic input)',
          max_input_channels: 2,
          max_output_channels: 0,
          default_samplerate: 44100.0,
          is_default: true
        },
        {
          id: 1,
          name: 'Virtual Mic (VoiceMeeter)',
          full_name: 'Virtual Mic (VoiceMeeter)',
          max_input_channels: 2,
          max_output_channels: 0,
          default_samplerate: 44100.0,
          is_default: false
        },
        {
          id: 2,
          name: 'VB-Audio Cable',
          full_name: 'VB-Audio Cable',
          max_input_channels: 2,
          max_output_channels: 0,
          default_samplerate: 48000.0,
          is_default: false
        }
      ],
      system_audio: [
        {
          id: 5,
          name: 'Speakers (Realtek Audio)',
          full_name: 'Speakers (Realtek Audio) [Loopback]',
          max_input_channels: 2,
          max_output_channels: 0,
          default_samplerate: 48000.0,
          is_default: true
        },
        {
          id: 6,
          name: 'VoiceMeeter Aux Input',
          full_name: 'VoiceMeeter Aux Input [Loopback]',
          max_input_channels: 2,
          max_output_channels: 0,
          default_samplerate: 48000.0,
          is_default: false
        }
      ]
    }
  },

  // Recording endpoints
  listRecordings: async (signal?: AbortSignal): Promise<RecordingSession[]> => {
    if (!USE_MOCK) {
      return request<RecordingSession[]>('/recordings', {}, signal)
    }
    return getStore<RecordingSession[]>('recordings', INITIAL_RECORDINGS)
  },

  getRecording: async (id: string, signal?: AbortSignal): Promise<RecordingSession> => {
    if (!USE_MOCK) {
      return request<RecordingSession>(`/recordings/${id}`, {}, signal)
    }
    const list = getStore<RecordingSession[]>('recordings', INITIAL_RECORDINGS)
    const rec = list.find((r) => r.id === id)
    if (!rec) throw new ApiError(404, 'Recording not found')
    return rec
  },

  updateRecording: async (id: string, body: { title: string }): Promise<RecordingSession> => {
    return request<RecordingSession>(`/recordings/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body)
    })
  },

  deleteRecording: async (id: string): Promise<void> => {
    if (!USE_MOCK) {
      return request<void>(`/recordings/${id}`, { method: 'DELETE' })
    }
    const list = getStore<RecordingSession[]>('recordings', INITIAL_RECORDINGS)
    const filtered = list.filter((r) => r.id !== id)
    setStore('recordings', filtered)

    const transcripts = getStore<Record<string, TranscriptData>>('transcripts', INITIAL_TRANSCRIPTS)
    delete transcripts[id]
    setStore('transcripts', transcripts)

    const summaries = getStore<Record<string, SummaryData>>('summaries', INITIAL_SUMMARIES)
    delete summaries[id]
    setStore('summaries', summaries)
  },

  startRecording: async (body: StartRecordingRequest): Promise<RecordingSession> => {
    if (!USE_MOCK) {
      return request<RecordingSession>('/recordings', {
        method: 'POST',
        body: JSON.stringify(body)
      })
    }
    const id = `rec_${Date.now()}`
    const newRec: RecordingSession = {
      id,
      state: 'recording',
      source_type: body.use_mic && body.use_system ? 'mixed' : body.use_mic ? 'mic' : 'system',
      use_mic: body.use_mic,
      use_system: body.use_system,
      created_at: new Date().toISOString(),
      duration: 0,
      title:
        body.use_mic && body.use_system
          ? 'Bản ghi âm Mixed'
          : body.use_mic
            ? 'Bản ghi âm Microphone'
            : 'Bản ghi âm System'
    }

    const list = getStore<RecordingSession[]>('recordings', INITIAL_RECORDINGS)
    list.unshift(newRec)
    setStore('recordings', list)
    return newRec
  },

  pauseRecording: async (id: string): Promise<RecordingSession> => {
    if (!USE_MOCK) {
      return request<RecordingSession>(`/recordings/${id}/pause`, { method: 'POST' })
    }
    const list = getStore<RecordingSession[]>('recordings', INITIAL_RECORDINGS)
    const rec = list.find((r) => r.id === id)
    if (!rec) throw new ApiError(404, 'Recording not found')
    rec.state = 'paused'
    setStore('recordings', list)
    return rec
  },

  resumeRecording: async (id: string): Promise<RecordingSession> => {
    if (!USE_MOCK) {
      return request<RecordingSession>(`/recordings/${id}/resume`, { method: 'POST' })
    }
    const list = getStore<RecordingSession[]>('recordings', INITIAL_RECORDINGS)
    const rec = list.find((r) => r.id === id)
    if (!rec) throw new ApiError(404, 'Recording not found')
    rec.state = 'recording'
    setStore('recordings', list)
    return rec
  },

  stopRecording: async (id: string): Promise<RecordingSession> => {
    if (!USE_MOCK) {
      return request<RecordingSession>(`/recordings/${id}/stop`, { method: 'POST' })
    }
    const list = getStore<RecordingSession[]>('recordings', INITIAL_RECORDINGS)
    const rec = list.find((r) => r.id === id)
    if (!rec) throw new ApiError(404, 'Recording not found')
    rec.state = 'stopped'

    // Calculate realistic duration based on created_at
    const created = new Date(rec.created_at).getTime()
    const elapsed = Math.max(3, Math.floor((Date.now() - created) / 1000))
    rec.duration = elapsed

    setStore('recordings', list)
    return rec
  },

  // Pipeline/AI endpoints
  startTranscribe: async (id: string): Promise<TaskResponse> => {
    if (!USE_MOCK) {
      return request<TaskResponse>(`/recordings/${id}/transcribe`, { method: 'POST' })
    }
    const list = getStore<RecordingSession[]>('recordings', INITIAL_RECORDINGS)
    const rec = list.find((r) => r.id === id)
    if (!rec) throw new ApiError(404, 'Recording not found')

    rec.state = 'transcribing'
    setStore('recordings', list)

    // Simulate 2-second background processing
    setTimeout(() => {
      const records = getStore<RecordingSession[]>('recordings', INITIAL_RECORDINGS)
      const target = records.find((r) => r.id === id)
      if (target) {
        target.state = 'stopped'
        setStore('recordings', records)

        // Save generated transcript segments
        const transcripts = getStore<Record<string, TranscriptData>>(
          'transcripts',
          INITIAL_TRANSCRIPTS
        )
        const duration = target.duration || 10
        transcripts[id] = {
          recording_id: id,
          text: 'Bản ghi âm thử nghiệm của bạn đã được chuyển ngữ thành công. Zipformer AI hoạt động chính xác.',
          segments: [
            {
              id: 1,
              start: 0,
              end: Math.floor(duration * 0.3),
              text: 'Bắt đầu cuộc thu âm thử nghiệm trên máy.',
              speaker: 'User'
            },
            {
              id: 2,
              start: Math.floor(duration * 0.3),
              end: Math.floor(duration * 0.7),
              text: 'Zipformer AI đang dịch giọng nói và phân chia các đoạn âm thanh theo thời gian thực.',
              speaker: 'AI Assistant'
            },
            {
              id: 3,
              start: Math.floor(duration * 0.7),
              end: duration,
              text: 'Ghi âm kết thúc tốt đẹp. Giao diện chạy mượt.',
              speaker: 'User'
            }
          ]
        }
        setStore('transcripts', transcripts)
      }
    }, 2000)

    return {
      task_id: `task_stt_${Math.random().toString(36).substring(2, 9)}`,
      session_id: id,
      task_type: 'transcribe',
      status: 'pending'
    }
  },

  cancelTranscribe: async (id: string): Promise<TaskResponse> => {
    if (!USE_MOCK) {
      return request<TaskResponse>(`/recordings/${id}/transcribe/cancel`, { method: 'POST' })
    }
    throw new ApiError(501, 'Transcription cancellation is unavailable in mock mode')
  },

  getTranscript: async (id: string, signal?: AbortSignal): Promise<TranscriptData> => {
    if (!USE_MOCK) {
      return request<TranscriptData>(`/recordings/${id}/transcript`, {}, signal).catch((err) => {
        console.warn('Transcript get error, using fallback:', err)
        return {
          recording_id: id,
          text: 'Bản dịch đang được xử lý hoặc chưa khả dụng.',
          segments: []
        }
      })
    }
    const transcripts = getStore<Record<string, TranscriptData>>('transcripts', INITIAL_TRANSCRIPTS)
    const data = transcripts[id]
    if (!data) {
      return {
        recording_id: id,
        text: 'Bản dịch đang được xử lý hoặc chưa khả dụng.',
        segments: []
      }
    }
    return data
  },

  startSummarize: async (id: string): Promise<TaskResponse> => {
    if (!USE_MOCK) {
      return request<TaskResponse>(`/recordings/${id}/summarize`, { method: 'POST' })
    }
    const list = getStore<RecordingSession[]>('recordings', INITIAL_RECORDINGS)
    const rec = list.find((r) => r.id === id)
    if (!rec) throw new ApiError(404, 'Recording not found')

    rec.state = 'summarizing'
    setStore('recordings', list)

    // Simulate 2-second background processing
    setTimeout(() => {
      const records = getStore<RecordingSession[]>('recordings', INITIAL_RECORDINGS)
      const target = records.find((r) => r.id === id)
      if (target) {
        target.state = 'completed'
        setStore('recordings', records)

        // Save generated summary
        const summaries = getStore<Record<string, SummaryData>>('summaries', INITIAL_SUMMARIES)
        summaries[id] = {
          recording_id: id,
          summary:
            'Tóm tắt cuộc ghi âm thử nghiệm mới. Nội dung xoay quanh việc thử nghiệm giao diện và kiểm thử tính năng Zipformer và tóm tắt AI.',
          key_points: [
            'Kiểm thử thành công các luồng trạng thái từ ghi âm sang STT và tóm tắt.',
            'Visualizer sóng âm chạy đồng bộ và mượt mà.',
            'Tích hợp click-to-seek trên các đoạn văn bản dịch thuật.'
          ],
          action_items: [
            'Triển khai tích hợp thật với backend Python FastAPI.',
            'Đo lường thời gian đáp ứng thực tế của mô hình Zipformer.'
          ]
        }
        setStore('summaries', summaries)
      }
    }, 2000)

    return {
      task_id: `task_sum_${Math.random().toString(36).substring(2, 9)}`,
      session_id: id,
      task_type: 'summarize',
      status: 'pending'
    }
  },

  getSummary: async (id: string, signal?: AbortSignal): Promise<SummaryData> => {
    if (!USE_MOCK) {
      return request<SummaryData>(`/recordings/${id}/summary`, {}, signal)
    }
    const summaries = getStore<Record<string, SummaryData>>('summaries', INITIAL_SUMMARIES)
    const data = summaries[id]
    if (!data) {
      throw new ApiError(404, 'Summary not yet available')
    }
    return data
  },

  uploadRecording: async (file: Blob, title?: string): Promise<RecordingSession> => {
    const formData = new FormData()
    formData.append('file', file, 'recording.wav')
    if (title) {
      formData.append('title', title)
    }

    if (!USE_MOCK) {
      return request<RecordingSession>('/recordings/upload', {
        method: 'POST',
        body: formData
      })
    }

    const id = `rec_mock_${Date.now()}`
    const newRec: RecordingSession = {
      id,
      state: 'completed',
      source_type: 'mic',
      use_mic: true,
      use_system: false,
      created_at: new Date().toISOString(),
      duration: 30,
      title: title || 'File nhập khẩu mẫu'
    }
    const list = getStore<RecordingSession[]>('recordings', INITIAL_RECORDINGS)
    list.unshift(newRec)
    setStore('recordings', list)
    return newRec
  },

  // Stream URL builder
  streamUrl: (id: string) => {
    if (!USE_MOCK) {
      return `${API_BASE_URL}/recordings/${id}/stream`
    }
    return `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3`
  }
}
