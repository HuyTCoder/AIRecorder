import { useMutation, useQueryClient, UseMutationResult } from '@tanstack/react-query'
import { api } from '../api/client'
import { queryKeys } from '../constants'
import { useApp } from '../store/AppContext'
import { useToast } from '../components/ui/ToastProvider'
import { saveRecordingTitle } from '../utils/format'
import { StartRecordingRequest } from '../types/recording'
import { handleApiError } from '../utils/error'

interface StartRecordingArgs {
  request: StartRecordingRequest
  title: string
  deviceName: string
}

export function useStartRecording(): UseMutationResult<
  { id: string; title: string; deviceName: string },
  unknown,
  StartRecordingArgs
> {
  const { dispatch } = useApp()
  const queryClient = useQueryClient()
  const toast = useToast()

  return useMutation({
    mutationFn: async ({ request, title, deviceName }: StartRecordingArgs) => {
      const session = await api.startRecording({
        ...request,
        title
      })
      return { id: session.id, title, deviceName }
    },
    onSuccess: ({ id, title, deviceName }) => {
      saveRecordingTitle(id, title)
      dispatch({
        type: 'START_LIVE_RECORDING',
        payload: {
          id,
          title,
          deviceName
        }
      })
      dispatch({ type: 'SET_ACTIVE_RECORDING_ID', payload: id })
      dispatch({ type: 'SET_CREATE_MODAL_OPEN', payload: false })
      toast('Đang bắt đầu ghi âm...')
      queryClient.invalidateQueries({ queryKey: queryKeys.recordings() })
    },
    onError: (err: unknown) => {
      handleApiError(err, 'Lỗi bắt đầu ghi âm', toast)
    }
  })
}
