import { useMutation, useQueryClient, UseMutationResult } from '@tanstack/react-query'
import { api } from '../api/client'
import { queryKeys } from '../constants'
import { useApp } from '../store/AppContext'
import { useToast } from '../components/ui/ToastProvider'
import { handleApiError } from '../utils/error'
import { RecordingSession } from '../types/recording'

export function useStopRecording(
  activeId: string | null
): UseMutationResult<RecordingSession, unknown, void> {
  const { dispatch } = useApp()
  const queryClient = useQueryClient()
  const toast = useToast()

  return useMutation({
    mutationFn: () => api.stopRecording(activeId || ''),
    onSuccess: () => {
      dispatch({ type: 'STOP_LIVE_RECORDING' })
      toast('Đã lưu bản ghi âm!')
      queryClient.invalidateQueries({ queryKey: queryKeys.recordings() })
      queryClient.invalidateQueries({ queryKey: queryKeys.recording(activeId || '') })
    },
    onError: (err: unknown) => {
      dispatch({ type: 'STOP_LIVE_RECORDING' })
      handleApiError(err, 'Lỗi dừng ghi âm', toast)
    }
  })
}
