import { useMutation, useQueryClient, UseMutationResult } from '@tanstack/react-query'
import { api } from '../api/client'
import { queryKeys } from '../constants'
import { useApp } from '../store/AppContext'
import { useToast } from '../components/ui/ToastProvider'
import { handleApiError } from '../utils/error'

export function useDeleteRecording(): UseMutationResult<void, unknown, string> {
  const { state, dispatch } = useApp()
  const queryClient = useQueryClient()
  const toast = useToast()

  return useMutation({
    mutationFn: (id: string) => api.deleteRecording(id),
    onSuccess: (_, deletedId) => {
      if (state.liveRecording.id === deletedId) {
        dispatch({ type: 'RESET_LIVE_RECORDING' })
      }

      if (state.activeRecordingId === deletedId) {
        dispatch({ type: 'SET_ACTIVE_RECORDING_ID', payload: null })
      }

      toast('Đã hủy bản ghi')
      queryClient.invalidateQueries({ queryKey: queryKeys.recordings() })
    },
    onError: (err: unknown) => {
      handleApiError(err, 'Lỗi hủy bản ghi', toast)
    }
  })
}
