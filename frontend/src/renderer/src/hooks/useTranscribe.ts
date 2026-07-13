import { useMutation, useQueryClient, UseMutationResult } from '@tanstack/react-query'
import { api } from '../api/client'
import { queryKeys } from '../constants'
import { useToast } from '../components/ui/ToastProvider'
import { handleApiError } from '../utils/error'
import { TaskResponse } from '../types/api'

class PromiseQueue {
  private queue: (() => Promise<void>)[] = []
  private isProcessing = false

  add<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const res = await task()
          resolve(res)
        } catch (e) {
          reject(e)
        }
      })
      this.process()
    })
  }

  private async process() {
    if (this.isProcessing) return
    this.isProcessing = true
    while (this.queue.length > 0) {
      const task = this.queue.shift()
      if (task) {
        try {
          await task()
        } catch (e) {
          console.error('Queue task failed', e)
        }
      }
    }
    this.isProcessing = false
  }
}

const transcribeQueue = new PromiseQueue()

export function useTranscribe(recordingId: string): UseMutationResult<TaskResponse, unknown, void> {
  const queryClient = useQueryClient()
  const toast = useToast()

  return useMutation({
    mutationFn: () => transcribeQueue.add(() => api.startTranscribe(recordingId)),
    onSuccess: () => {
      toast('Đang bắt đầu dịch bản ghi sang văn bản (STT)...')
      queryClient.invalidateQueries({ queryKey: queryKeys.recording(recordingId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.transcript(recordingId) })
    },
    onError: (err: unknown) => {
      handleApiError(err, 'Lỗi chuyển ngữ', toast)
    }
  })
}

export function useCancelTranscribe(
  recordingId: string
): UseMutationResult<TaskResponse, unknown, void> {
  const queryClient = useQueryClient()
  const toast = useToast()

  return useMutation({
    mutationFn: () => api.cancelTranscribe(recordingId),
    onSuccess: () => {
      toast('Đã yêu cầu hủy bản dịch.')
      queryClient.invalidateQueries({ queryKey: queryKeys.recording(recordingId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.transcript(recordingId) })
    },
    onError: (err: unknown) => {
      handleApiError(err, 'Không thể hủy bản dịch', toast)
    }
  })
}
