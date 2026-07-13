import { useMutation, useQueryClient, UseMutationResult } from '@tanstack/react-query'
import { api } from '../api/client'
import { queryKeys } from '../constants'
import { useToast } from '../components/ui/ToastProvider'
import { handleApiError } from '../utils/error'
import { TaskResponse } from '../types/api'

export function useSummarize(
  activeId: string | null
): UseMutationResult<TaskResponse, unknown, void> {
  const queryClient = useQueryClient()
  const toast = useToast()

  return useMutation({
    mutationFn: () => api.startSummarize(activeId || ''),
    onSuccess: () => {
      toast('Đang bắt đầu tóm tắt bằng AI...')
      queryClient.invalidateQueries({ queryKey: queryKeys.recording(activeId || '') })
    },
    onError: (err: unknown) => {
      handleApiError(err, 'Không thể tóm tắt', toast)
    }
  })
}
