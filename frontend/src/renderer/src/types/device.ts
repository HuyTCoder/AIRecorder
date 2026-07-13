export interface AudioDevice {
  id: number
  name: string // Rút gọn, hiển thị trên UI
  full_name: string // Tên đầy đủ, dùng cho tooltip
  max_input_channels: number
  max_output_channels: number
  default_samplerate: number
  is_default: boolean
}

export interface DeviceListResponse {
  microphones: AudioDevice[]
  system_audio: AudioDevice[]
}
