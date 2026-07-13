export interface LiveRecordingState {
  id?: string
  state: 'idle' | 'recording' | 'paused'
  duration: number
  title: string
  deviceName?: string
}

export interface UIState {
  activeRecordingId: string | null
  isCreateModalOpen: boolean
  isCreatingRecording: boolean
  isSettingsModalOpen: boolean
  liveRecording: LiveRecordingState
}

export const initialState: UIState = {
  activeRecordingId: null,
  isCreateModalOpen: false,
  isCreatingRecording: false,
  isSettingsModalOpen: false,
  liveRecording: {
    state: 'idle',
    duration: 0,
    title: ''
  }
}

export type UIAction =
  | { type: 'SET_ACTIVE_RECORDING_ID'; payload: string | null }
  | { type: 'SET_CREATE_MODAL_OPEN'; payload: boolean }
  | { type: 'SET_CREATING_RECORDING'; payload: boolean }
  | { type: 'SET_SETTINGS_MODAL_OPEN'; payload: boolean }
  | { type: 'START_LIVE_RECORDING'; payload: { id: string; title: string; deviceName?: string } }
  | { type: 'PAUSE_LIVE_RECORDING' }
  | { type: 'RESUME_LIVE_RECORDING' }
  | { type: 'STOP_LIVE_RECORDING' }
  | { type: 'TICK_DURATION' }
  | { type: 'RESET_LIVE_RECORDING' }

export function uiReducer(state: UIState, action: UIAction): UIState {
  switch (action.type) {
    case 'SET_ACTIVE_RECORDING_ID':
      // Khi chọn file cũ thì tắt giao diện tạo mới
      return { ...state, activeRecordingId: action.payload, isCreatingRecording: false }
    case 'SET_CREATE_MODAL_OPEN':
      return { ...state, isCreateModalOpen: action.payload }
    case 'SET_CREATING_RECORDING':
      // Khi bật giao diện tạo mới thì bỏ chọn file hiện tại
      return { ...state, isCreatingRecording: action.payload, activeRecordingId: null }
    case 'SET_SETTINGS_MODAL_OPEN':
      return { ...state, isSettingsModalOpen: action.payload }
    case 'START_LIVE_RECORDING':
      return {
        ...state,
        liveRecording: {
          id: action.payload.id,
          state: 'recording',
          duration: 0,
          title: action.payload.title,
          deviceName: action.payload.deviceName
        }
      }
    case 'PAUSE_LIVE_RECORDING':
      return {
        ...state,
        liveRecording: {
          ...state.liveRecording,
          state: 'paused'
        }
      }
    case 'RESUME_LIVE_RECORDING':
      return {
        ...state,
        liveRecording: {
          ...state.liveRecording,
          state: 'recording'
        }
      }
    case 'STOP_LIVE_RECORDING':
      return {
        ...state,
        liveRecording: {
          ...state.liveRecording,
          state: 'idle'
        }
      }
    case 'TICK_DURATION':
      return {
        ...state,
        liveRecording: {
          ...state.liveRecording,
          duration: state.liveRecording.duration + 1
        }
      }
    case 'RESET_LIVE_RECORDING':
      return {
        ...state,
        liveRecording: initialState.liveRecording
      }
    default:
      return state
  }
}
