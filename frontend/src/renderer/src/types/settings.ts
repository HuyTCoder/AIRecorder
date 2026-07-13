export interface Settings {
  ai_provider: string
  model: string
  theme: string
  font_size: string
  prompt: string
  gemini_api_key: string
  chatgpt_api_key: string
  claude_api_key: string
}

export interface SettingsUpdate {
  ai_provider?: string
  model?: string
  theme?: string
  font_size?: string
  prompt?: string
  gemini_api_key?: string
  chatgpt_api_key?: string
  claude_api_key?: string
}
