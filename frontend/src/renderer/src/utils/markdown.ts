import { RecordingSession } from '../types/recording'
import { TranscriptData } from '../types/transcript'
import { SummaryData } from '../types/summary'
import { formatDate, getRecordingTitle } from './format'

export function buildMarkdown(
  session: RecordingSession,
  transcript?: TranscriptData,
  summary?: SummaryData
): string {
  let md = `# ${getRecordingTitle(session)}\n\n`
  md += `- **Ngày tạo:** ${formatDate(session.created_at)}\n`
  md += `- **Thời lượng:** ${Math.floor(session.duration || 0)} giây\n`
  md += `- **Trạng thái:** ${session.state}\n\n`

  if (summary && (summary.summary || summary.key_points?.length || summary.action_items?.length)) {
    md += `## 📝 Tóm tắt AI\n\n`
    if (summary.summary) {
      md += `${summary.summary}\n\n`
    }
    if (summary.key_points?.length) {
      md += `### Ý chính\n`
      summary.key_points.forEach((kp) => {
        md += `- ${kp}\n`
      })
      md += `\n`
    }
    if (summary.action_items?.length) {
      md += `### Hành động cần làm\n`
      summary.action_items.forEach((ai) => {
        md += `- [ ] ${ai}\n`
      })
      md += `\n`
    }
  }

  if (transcript && transcript.text) {
    md += `## 🎙️ Văn bản dịch (Transcript)\n\n`
    if (transcript.segments && transcript.segments.length > 0) {
      transcript.segments.forEach((seg) => {
        const timeStr = `[${Math.floor(seg.start)}s - ${Math.floor(seg.end)}s]`
        const speakerStr = seg.speaker ? `**${seg.speaker}**: ` : ''
        md += `${timeStr} ${speakerStr}${seg.text}\n\n`
      })
    } else {
      md += `${transcript.text}\n\n`
    }
  }

  return md
}
