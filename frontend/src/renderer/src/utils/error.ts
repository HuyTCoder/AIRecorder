import { ApiError } from '../api/client'

export function handleApiError(
  err: unknown,
  customMessage: string,
  toastFn: (msg: string) => void
): void {
  console.error(`Error context: ${customMessage}`, err)

  let message = customMessage
  if (err instanceof ApiError) {
    message = `${customMessage}: ${err.message} (Status: ${err.status})`
  } else if (err instanceof Error) {
    message = `${customMessage}: ${err.message}`
  } else if (typeof err === 'string') {
    message = `${customMessage}: ${err}`
  }

  toastFn(message)
}
