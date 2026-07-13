export type RecordingState =
  | 'idle'
  | 'recording'
  | 'paused'
  | 'stopped'
  | 'transcribing'
  | 'transcribed'
  | 'summarizing'
  | 'completed'
  | 'error'

export interface RecordingSession {
  id: string
  state: RecordingState
  source_type: string
  use_mic: boolean
  use_system: boolean
  created_at: string
  duration?: number
  // Local UI helper fields (not returned from server)
  title?: string
  error_source?: string
}

export interface StartRecordingRequest {
  use_mic: boolean
  use_system: boolean
  mic_device_id?: number
  system_device_id?: number
  gains?: number[]
  sample_rate?: number
  title?: string
}
