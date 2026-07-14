import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'
import { useApp } from '../../store/AppContext'
import { useToast } from '../ui/ToastProvider'
import { CustomSelect, CustomSelectChangeEvent } from '../ui/CustomSelect'
import { SettingsUpdate } from '../../types/settings'
import './SettingsModal.css'

export function SettingsModal() {
  const { state: uiState, dispatch } = useApp()
  const queryClient = useQueryClient()
  const toast = useToast()

  const [formData, setFormData] = useState<SettingsUpdate>({
    ai_provider: 'gemini',
    gemini_api_key: '',
    chatgpt_api_key: '',
    claude_api_key: '',
    model: '',
    theme: 'dark',
    font_size: 'small',
    prompt: ''
  })

  const [showApiKey, setShowApiKey] = useState(false)

  // Lấy cài đặt hiện tại
  const { data: currentSettings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.getSettings()
  })

  // Cập nhật state khi có data
  useEffect(() => {
    if (currentSettings) {
      setFormData({ ...currentSettings })
    }
  }, [currentSettings])

  // Mutation cập nhật cài đặt
  const updateMutation = useMutation({
    mutationFn: (updates: SettingsUpdate) => api.updateSettings(updates),
    onSuccess: (updatedSettings) => {
      toast('Đã lưu cài đặt thành công!')
      queryClient.setQueryData(['settings'], updatedSettings)
      setFormData({ ...updatedSettings })
      handleClose(false) // Don't revert because we just saved
    },
    onError: () => {
      toast('Lỗi khi lưu cài đặt!')
    }
  })

  const updateFormValue = (name: string, value: string) => {
    setFormData((previous) => ({ ...previous, [name]: value }))

    if (name === 'theme' || name === 'font_size') {
      const newTheme = name === 'theme' ? value : formData.theme
      const newFontSize = name === 'font_size' ? value : formData.font_size
      document.body.className = `${newTheme}-theme text-${newFontSize}`
    }
  }

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    updateFormValue(event.target.name, event.target.value)

  const handleSelectChange = (event: CustomSelectChangeEvent) =>
    updateFormValue(event.target.name, event.target.value)
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateMutation.mutate(formData)
  }

  const handleClose = (revert = true) => {
    // Revert to current saved settings if not saved
    if (revert && currentSettings) {
      document.body.className = `${currentSettings.theme}-theme text-${currentSettings.font_size}`
      setFormData({ ...currentSettings })
    }
    setShowApiKey(false) // Reset hide state
    dispatch({ type: 'SET_SETTINGS_MODAL_OPEN', payload: false })
  }

  if (!uiState.isSettingsModalOpen) return null

  const currentApiKeyField = `${formData.ai_provider}_api_key` as keyof SettingsUpdate

  return (
    <div className="settings-modal-overlay" onClick={() => handleClose(true)}>
      <div className="settings-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="settings-modal-header">
          <h2>Cài đặt ứng dụng</h2>
          <button type="button" className="close-btn" onClick={() => handleClose(true)}>
            &times;
          </button>
        </div>

        {isLoading ? (
          <div style={{ padding: '20px', textAlign: 'center' }}>Đang tải cài đặt...</div>
        ) : (
          <form className="settings-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="ai_provider">Nhà cung cấp AI</label>
              <CustomSelect
                id="ai_provider"
                name="ai_provider"
                value={formData.ai_provider ?? 'gemini'}
                onChange={handleSelectChange}
                options={[
                  { value: 'gemini', label: 'Google Gemini' },
                  { value: 'chatgpt', label: 'OpenAI ChatGPT' },
                  { value: 'claude', label: 'Anthropic Claude' }
                ]}
              />
            </div>

            <div className="form-group">
              <label htmlFor={currentApiKeyField}>API Key</label>
              <div className="api-key-input-wrapper">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  id={currentApiKeyField}
                  name={currentApiKeyField}
                  placeholder="Nhập API Key của bạn..."
                  value={(formData[currentApiKeyField] as string) || ''}
                  onChange={handleChange}
                />
                <button
                  type="button"
                  className="btn-toggle-visibility"
                  onClick={() => setShowApiKey(!showApiKey)}
                  title={showApiKey ? 'Ẩn Key' : 'Hiện Key'}
                >
                  {showApiKey ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="model">Tên Mô Hình (Model)</label>
              <input
                type="text"
                id="model"
                name="model"
                placeholder="VD: gemini-2.5-flash, gpt-4o, claude-3-5-sonnet... hoặc mô hình khác"
                value={formData.model || ''}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label htmlFor="theme">Giao diện (Sáng/Tối)</label>
              <CustomSelect
                id="theme"
                name="theme"
                value={formData.theme ?? 'dark'}
                onChange={handleSelectChange}
                options={[
                  { value: 'dark', label: 'Tối (Dark)' },
                  { value: 'light', label: 'Sáng (Light)' }
                ]}
              />
            </div>

            <div className="form-group">
              <label htmlFor="font_size">Cỡ chữ hiển thị</label>
              <CustomSelect
                id="font_size"
                name="font_size"
                value={formData.font_size ?? 'small'}
                onChange={handleSelectChange}
                options={[
                  { value: 'small', label: 'Nhỏ' },
                  { value: 'medium', label: 'Trung bình' },
                  { value: 'large', label: 'Lớn' }
                ]}
              />
            </div>

            <div className="form-group">
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <label htmlFor="prompt">Chỉ dẫn hệ thống (System Prompt)</label>
              </div>
              <textarea
                id="prompt"
                name="prompt"
                rows={5}
                placeholder="Ví dụ: Bạn là chuyên gia phân tích dữ liệu, hãy tóm tắt nội dung bản ghi âm và liệt kê các quyết định quan trọng theo định dạng JSON."
                value={formData.prompt || ''}
                onChange={handleChange}
                style={{ resize: 'vertical' }}
              />
            </div>

            <div className="settings-modal-footer">
              <button type="submit" className="btn-save" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Đang lưu...' : 'Lưu cài đặt'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
