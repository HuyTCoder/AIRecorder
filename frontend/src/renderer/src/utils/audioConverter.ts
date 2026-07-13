/**
 * Chuyển đổi và chuẩn hóa file âm thanh sang chuẩn WAV (16kHz, Mono, 16-bit PCM)
 * sử dụng Web Audio API của trình duyệt.
 */
export async function convertToStandardWav(file: File): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer()

  // 1. Giải mã dữ liệu âm thanh sử dụng AudioContext của browser
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
  let decodedBuffer: AudioBuffer
  try {
    decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer)
  } catch {
    throw new Error(
      'Không thể giải mã file âm thanh. File có thể bị lỗi hoặc định dạng không hỗ trợ.'
    )
  } finally {
    audioCtx.close()
  }

  const targetSampleRate = 16000
  const targetChannels = 1

  // 2. Sử dụng OfflineAudioContext để resample và downmix xuống Mono tự động
  const offlineCtx = new OfflineAudioContext(
    targetChannels,
    Math.round(decodedBuffer.duration * targetSampleRate),
    targetSampleRate
  )

  const source = offlineCtx.createBufferSource()
  source.buffer = decodedBuffer
  source.connect(offlineCtx.destination)
  source.start()

  const renderedBuffer = await offlineCtx.startRendering()
  const channelData = renderedBuffer.getChannelData(0) // Float32Array

  // 3. Encode Float32Array sang ArrayBuffer WAV 16-bit PCM
  const wavBuffer = encodeWAV(channelData, targetSampleRate)
  return new Blob([wavBuffer], { type: 'audio/wav' })
}

function encodeWAV(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)

  /* RIFF identifier */
  writeString(view, 0, 'RIFF')
  /* file length */
  view.setUint32(4, 36 + samples.length * 2, true)
  /* RIFF type */
  writeString(view, 8, 'WAVE')
  /* format chunk identifier */
  writeString(view, 12, 'fmt ')
  /* format chunk length */
  view.setUint32(16, 16, true)
  /* sample format (raw) (1 = uncompressed PCM) */
  view.setUint16(20, 1, true)
  /* channel count */
  view.setUint16(22, 1, true)
  /* sample rate */
  view.setUint32(24, sampleRate, true)
  /* byte rate (sample rate * block align) */
  view.setUint32(28, sampleRate * 2, true)
  /* block align (channel count * bytes per sample) */
  view.setUint16(32, 2, true)
  /* bits per sample */
  view.setUint16(34, 16, true)
  /* data chunk identifier */
  writeString(view, 36, 'data')
  /* data chunk length */
  view.setUint32(40, samples.length * 2, true)

  // Ghi dữ liệu PCM 16-bit
  floatTo16BitPCM(view, 44, samples)

  return buffer
}

function floatTo16BitPCM(output: DataView, offset: number, input: Float32Array) {
  for (let i = 0; i < input.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, input[i]))
    output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i))
  }
}
