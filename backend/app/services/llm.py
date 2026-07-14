import logging
from pydantic import BaseModel
from app.core.settings_manager import SettingsManager

logger = logging.getLogger(__name__)


class SummaryResult(BaseModel):
    summary: str
    key_points: list[str]
    action_items: list[str]


class SummaryService:
    """Service to handle transcription summarization using various LLM Providers."""

    def __init__(self) -> None:
        pass

    def summarize(self, transcript_text: str) -> SummaryResult:
        """Summarizes a transcript text and returns a structured SummaryResult."""
        if not transcript_text.strip():
            return SummaryResult(
                summary="Không có nội dung ghi âm để tóm tắt.",
                key_points=[],
                action_items=[],
            )

        settings = SettingsManager.get_runtime_settings()
        model_name = settings.model
        provider = settings.ai_provider

        import os
        api_key = ""
        if provider == "gemini":
            api_key = settings.gemini_api_key or os.getenv("GEMINI_API_KEY", "")
        elif provider == "chatgpt":
            api_key = settings.chatgpt_api_key or os.getenv("CHATGPT_API_KEY", os.getenv("OPENAI_API_KEY", ""))
        elif provider == "claude":
            api_key = settings.claude_api_key or os.getenv("CLAUDE_API_KEY", "")

        if not api_key:
            raise ValueError(f"API Key for {provider} is not configured in settings or environment variables.")

        base_prompt = settings.prompt or "Tóm tắt cuộc họp sau bằng tiếng Việt:"

        prompt = f"{base_prompt}\n\nTranscript:\n{transcript_text}"

        try:
            logger.info(f"Requesting summary from {provider} model: {model_name}")

            if provider == "gemini":
                from google import genai
                from google.genai import types

                client = genai.Client(api_key=api_key)
                response = client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        response_schema=SummaryResult,
                        temperature=0.2,
                    ),
                )
                return SummaryResult.model_validate_json(response.text)

            elif provider == "chatgpt":
                import openai

                client = openai.OpenAI(api_key=api_key)
                response = client.chat.completions.create(
                    model=model_name,
                    messages=[{"role": "user", "content": prompt}],
                    response_format={"type": "json_object"},
                    temperature=0.2,
                )
                # ChatGTP returns JSON but might need to be parsed
                content = response.choices[0].message.content
                if content:
                    return SummaryResult.model_validate_json(content)
                raise ValueError("Empty response from OpenAI")

            elif provider == "claude":
                import anthropic

                client = anthropic.Anthropic(api_key=api_key)
                # Claude doesn't support json schema directly yet in the same way, we ask it to output json
                response = client.messages.create(
                    model=model_name,
                    max_tokens=2048,
                    temperature=0.2,
                    messages=[{"role": "user", "content": prompt}],
                )
                content = response.content[0].text
                # Find json block
                start = content.find("{")
                end = content.rfind("}")
                if start != -1 and end != -1:
                    json_str = content[start : end + 1]
                    return SummaryResult.model_validate_json(json_str)
                else:
                    raise ValueError(
                        f"Could not parse JSON from Claude response: {content}"
                    )

            else:
                raise ValueError(f"Unknown AI Provider: {provider}")

        except Exception as error:
            logger.error("LLM summarization failed: %s", error)
            raise RuntimeError(f"LLM summarization failed: {error}") from error
