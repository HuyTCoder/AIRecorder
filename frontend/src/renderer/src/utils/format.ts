export function formatTime(seconds: number | undefined | null): string {
  if (seconds === undefined || seconds === null || isNaN(seconds) || !isFinite(seconds)) {
    return '00:00'
  }
  const s = Math.max(0, Math.floor(seconds))
  const mins = Math.floor(s / 60)
  const secs = s % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

export function formatDate(isoString: string | undefined | null): string {
  if (!isoString) return ''
  try {
    const date = new Date(isoString)
    if (isNaN(date.getTime())) return ''

    // Format: HH:MM - DD/MM/YYYY
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const year = date.getFullYear()

    return `${hours}:${minutes} - ${day}/${month}/${year}`
  } catch (e) {
    console.error('Failed to format date:', e)
    return isoString
  }
}

export function getRecordingTitle(recording: {
  id: string
  created_at: string
  title?: string
}): string {
  if (recording.title) return recording.title
  const savedTitle = localStorage.getItem(`recording_title_${recording.id}`)
  if (savedTitle) return savedTitle

  try {
    const date = new Date(recording.created_at)
    if (isNaN(date.getTime())) return `Bản ghi ${recording.id.slice(0, 6)}`
    const day = date.getDate().toString().padStart(2, '0')
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const year = date.getFullYear()
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    return `Bản ghi ${hours}:${minutes} ${day}/${month}/${year}`
  } catch {
    return `Bản ghi ${recording.id.slice(0, 6)}`
  }
}

export function saveRecordingTitle(id: string, title: string): void {
  localStorage.setItem(`recording_title_${id}`, title)
}
