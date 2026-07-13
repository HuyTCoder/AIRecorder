export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1'

export const POLL_INTERVAL = 2000 // 2 seconds for status polling

export const TOAST_DURATION_MS = 3000 // 3 seconds to auto dismiss

export const queryKeys = {
  devices: () => ['devices'] as const,
  recordings: () => ['recordings'] as const,
  recording: (id: string) => ['recording', id] as const,
  transcript: (id: string) => ['recording', id, 'transcript'] as const,
  summary: (id: string) => ['recording', id, 'summary'] as const
}
