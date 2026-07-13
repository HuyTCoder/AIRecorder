export interface TranscriptSegment {
  id: number
  start: number // seconds
  end: number // seconds
  text: string
  speaker?: string
}

export interface TranscriptData {
  recording_id: string
  segments: TranscriptSegment[]
  text: string
}
