export interface TaskResponse {
  task_id: string
  session_id: string
  task_type: 'transcribe' | 'summarize'
  status: 'pending' | 'running' | 'completed' | 'failed'
}

export interface ApiErrorResponse {
  success: false
  error: {
    code: number
    message: string
    details?: unknown
  }
}
