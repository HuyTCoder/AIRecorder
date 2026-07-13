from pydantic import BaseModel, Field


class SettingsBase(BaseModel):
    ai_provider: str = "gemini"
    model: str = "gemini-3.5-flash"
    theme: str = "dark"
    font_size: str = "small"
    prompt: str = 'Bạn là một trợ lý AI chuyên nghiệp. Dưới đây là nội dung giải băng (transcript) của một buổi ghi âm.\nHãy tóm tắt cuộc thảo luận này và trích xuất các ý chính (key points) cùng các hành động cần thực hiện (action items).\nTất cả kết quả đầu ra phải được viết bằng tiếng Việt. Trả về định dạng JSON bám sát schema sau: {"summary": "...", "key_points": ["..."], "action_items": ["..."]}'
    gemini_api_key: str = ""
    chatgpt_api_key: str = ""
    claude_api_key: str = ""


class SettingsUpdate(BaseModel):
    ai_provider: str | None = Field(
        None, description="Tên nhà cung cấp AI: 'gemini', 'chatgpt', 'claude'"
    )
    gemini_api_key: str | None = Field(None, description="API Key Gemini")
    chatgpt_api_key: str | None = Field(None, description="API Key ChatGPT")
    claude_api_key: str | None = Field(None, description="API Key Claude")
    model: str | None = Field(None, description="Tên mô hình")
    theme: str | None = Field(None, description="'light' hoặc 'dark'")
    font_size: str | None = Field(None, description="'small', 'medium', hoặc 'large'")
    prompt: str | None = Field(None, description="System prompt tuỳ chỉnh cho AI")


class SettingsResponse(SettingsBase):
    pass


class StoredSettings(SettingsBase):
    pass
