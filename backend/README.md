# Backend — AI Recorder

Dịch vụ FastAPI Backend xử lý các tác vụ thu âm (recording), lưu trữ đĩa (persistence), và lập lịch chạy ngầm (background task pipeline) cho ứng dụng AI Recorder.

---

## 🚀 Hướng dẫn Chạy Local

### 1. Khởi động môi trường & cài đặt thư viện
Backend sử dụng Python 3.13 để đảm bảo tính tương thích với các driver âm thanh và thư viện ONNX Runtime. Khuyến nghị cài đặt bằng công cụ quản lý package `uv`:
```powershell
cd backend
uv sync --group dev
```

### 2. Khởi chạy Server
```powershell
uv run uvicorn app.main:app --reload
```
* API mặc định chạy tại: `http://localhost:8000`
* Tài liệu Swagger API tương tác: `http://localhost:8000/docs`

---

## 🧪 Kiểm tra Chất lượng (Linter & Tests)

Để chạy kiểm tra cú pháp và chạy bộ unit tests tự động:
```powershell
# Kiểm tra code style (linter)
uv run ruff check

# Chạy toàn bộ unit tests bất đồng bộ và kiểm tra API
uv run pytest -q
```

---

## ⚙️ Cấu hình Môi trường

Sao chép `.env.example` thành `.env` và bổ sung các API key của bạn (nếu có):
* `GEMINI_API_KEY`: API Key kết nối dịch vụ tóm tắt Google Gemini (hoặc cấu hình qua UI).
* `CHATGPT_API_KEY` (hoặc `OPENAI_API_KEY`): API Key kết nối dịch vụ OpenAI ChatGPT.
* `CLAUDE_API_KEY`: API Key kết nối dịch vụ Anthropic Claude.
* `ZIPFORMER_NUM_THREADS`: Giới hạn luồng xử lý CPU (mặc định: `4`).
* `ZIPFORMER_MODEL_DIR`: Đường dẫn chứa mô hình STT (mặc định: `models`).

---

## 📁 Cấu trúc Thư mục

```text
backend/
├── app/
│   ├── api/          # Các endpoint REST (devices, recordings, router)
│   ├── core/         # Cấu hình cài đặt settings.json và config.py
│   ├── models/       # Model thực thể dữ liệu (RecordingSession, RecordingState)
│   ├── schemas/      # Lớp dữ liệu DTO validate đầu vào/đầu ra cho API
│   ├── services/     # Các dịch vụ cốt lõi (recorder, mixing, zipformer STT, Gemini LLM)
│   └── utils/        # Tiện ích bổ trợ định dạng âm thanh
├── models/           # Thư mục lưu trữ mô hình AI offline (Zipformer)
├── logs/             # Nhật ký ghi nhận lỗi ứng dụng (app.log)
├── .env.example      # Bản mẫu file cấu hình môi trường
└── pyproject.toml    # Quản lý dependencies (FastAPI, PyAudioWPatch, Sherpa-ONNX)
```

---

## 📚 Tài liệu Liên quan

Hệ thống tài liệu hướng dẫn và đặc tả kiến trúc được lưu trữ tập trung tại thư mục `docs/`:
* **[Kiến trúc Hệ thống](file:///d:/KProject/AIRecorder/docs/architecture.md)** — Sơ đồ runtime, layout file và máy trạng thái.
* **[Đặc tả Tính năng Toàn diện](file:///d:/KProject/AIRecorder/docs/features.md)** — Chi tiết cơ chế trộn nguồn âm, STT local, NFR và xử lý lỗi.
* **[REST API Specification](file:///d:/KProject/AIRecorder/docs/api.md)** — Mô tả các endpoint, request/response payload.
* **[Hướng dẫn Chạy Demo](file:///d:/KProject/AIRecorder/docs/demo_guide.md)** — Kịch bản live demo và chạy mockup phục vụ trình bày.
* **[Hướng dẫn Kiểm thử](file:///d:/KProject/AIRecorder/docs/testing.md)** — Unit tests và các script test E2E.
