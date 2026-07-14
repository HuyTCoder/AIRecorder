# AI Recorder 🎙️🤖

Ứng dụng ghi âm máy tính chuyên nghiệp dành cho Windows. Hỗ trợ thu âm đồng thời Microphone và Loa hệ thống, tích hợp nhận diện giọng nói tiếng Việt offline bằng **Zipformer (sherpa-onnx)** và tóm tắt cuộc họp linh hoạt bằng **Generative AI** (tương thích với Google Gemini, OpenAI ChatGPT, hoặc Anthropic Claude thông qua API Key cá nhân).

---

## 🎙️ Giới thiệu dự án

AI Recorder giải quyết bài toán ghi lại các cuộc họp trực tuyến, bài giảng hoặc buổi thuyết trình trên Windows. Điểm độc đáo của ứng dụng là khả năng **hoạt động offline** khi dịch giọng nói thành văn bản, bảo vệ tối đa quyền riêng tư của dữ liệu âm thanh, kết hợp cùng sức mạnh AI linh hoạt để tự động lập biên bản tóm tắt cuộc họp thông qua các mô hình hàng đầu như **Google Gemini, OpenAI ChatGPT, hoặc Anthropic Claude** (người dùng chỉ cần cấu hình API Key tương ứng để bắt đầu sử dụng).

### Các Tính năng Cốt lõi:
* **Ghi âm trộn nguồn:** Thu độc lập hoặc đồng thời Microphone và System Audio (WASAPI loopback) cực kỳ mượt mà. Được quản lý bởi [recorder.py](file:///d:/KProject/AIRecorder/backend/app/services/recorder.py) và trộn bằng [audio_mixer.py](file:///d:/KProject/AIRecorder/backend/app/services/audio_mixer.py).
* **Speech-to-Text Local:** Dịch giọng nói tiếng Việt siêu nhẹ dưới CPU bằng mô hình Zipformer thông qua thư viện `sherpa-onnx` tại [zipformer.py](file:///d:/KProject/AIRecorder/backend/app/services/zipformer.py) (Tải từ HuggingFace: [csukuangfj/sherpa-onnx-zipformer-vi-2025-04-20](https://huggingface.co/csukuangfj/sherpa-onnx-zipformer-vi-2025-04-20)). Tích hợp **ASR Chunking (50s)** chống tràn bộ nhớ trên tệp âm thanh dài.
* **Phục hồi dấu câu tự động:** Tự động điền dấu chấm, phẩy và viết hoa tiếng Việt bằng mô hình `ViBERT-capu` (ONNX) thông qua [restorer.py](file:///d:/KProject/AIRecorder/backend/app/services/punctuation/restorer.py) (Tải từ HuggingFace: [welcomyou/vibert-capu-onnx](https://huggingface.co/welcomyou/vibert-capu-onnx)).
* **Phân biệt người nói Local (Speaker Diarization):** Nhận diện và phân tách các giọng nói khác nhau bằng mô hình **CAM++ ONNX** (`3dspeaker_campplus.onnx`) thông qua [diarization.py](file:///d:/KProject/AIRecorder/backend/app/services/diarization.py) và thuật toán gom cụm K-Means++ tự động phát hiện số lượng người nói.
* **Tóm tắt cuộc họp AI đa mô hình:** Tích hợp Google Gemini, OpenAI ChatGPT, hoặc Anthropic Claude để tóm tắt cuộc họp (Tổng quan, Ý chính, Đầu việc cần làm) thông qua [llm.py](file:///d:/KProject/AIRecorder/backend/app/services/llm.py) và xuất file Markdown báo cáo.
* **Khôi phục lỗi:** Tự động khôi phục và đánh dấu lỗi nếu ứng dụng bị crash hoặc tắt đột ngột nhờ [pipeline.py](file:///d:/KProject/AIRecorder/backend/app/services/pipeline.py).

---

## 🛠️ Công nghệ sử dụng

| Tầng hệ thống | Công nghệ tích hợp | File mã nguồn chính |
|---|---|---|
| **Frontend UI** | Electron + Vite + React (TypeScript, Vanilla CSS) | [App.tsx](file:///d:/KProject/AIRecorder/frontend/src/renderer/src/App.tsx) |
| **Backend API** | Python 3.13, FastAPI, Uvicorn, Python-dotenv | [main.py](file:///d:/KProject/AIRecorder/backend/app/main.py) |
| **Audio Capture** | `sounddevice` (Microphone), `pyaudiowpatch` (System Loopback) | [recorder.py](file:///d:/KProject/AIRecorder/backend/app/services/recorder.py) |
| **Audio Mixing** | Phối trộn âm thanh song song, chuẩn hóa WAV | [audio_mixer.py](file:///d:/KProject/AIRecorder/backend/app/services/audio_mixer.py) / [audio_writer.py](file:///d:/KProject/AIRecorder/backend/app/services/audio_writer.py) |
| **ASR Engine** | `sherpa-onnx` (Zipformer ASR), `onnxruntime` | [zipformer.py](file:///d:/KProject/AIRecorder/backend/app/services/zipformer.py) |
| **Diarization Engine**| `sherpa-onnx` (CAM++ Speaker Embedding), K-Means++ | [diarization.py](file:///d:/KProject/AIRecorder/backend/app/services/diarization.py) |
| **Natural Language** | `transformers` & `ViBERT-capu` (Khôi phục dấu câu) | [restorer.py](file:///d:/KProject/AIRecorder/backend/app/services/punctuation/restorer.py) |
| **Generative AI** | Google Gemini (Gemini 3.x), OpenAI ChatGPT, Anthropic Claude | [llm.py](file:///d:/KProject/AIRecorder/backend/app/services/llm.py) |
| **Task Repository** | Lưu trữ tệp tin bản ghi & Metadata | [repository.py](file:///d:/KProject/AIRecorder/backend/app/services/repository.py) |

---

## 📚 Sơ đồ Tài liệu Dự án (Documentation Directory Map)

Để dễ dàng học tập, nghiên cứu và trình bày dự án, hệ thống tài liệu được tổ chức lại gọn gàng tại thư mục `docs/`:

1. 📑 **[Đặc tả Tính năng Toàn diện (features.md)](file:///d:/KProject/AIRecorder/docs/features.md)** — Tìm hiểu sâu về cơ chế ghi âm, trộn âm, STT local, ViBERT-capu, AI Summary, yêu cầu phi chức năng (NFR) và xử lý lỗi.
2. 📐 **[Kiến trúc Hệ thống (architecture.md)](file:///d:/KProject/AIRecorder/docs/architecture.md)** — Sơ đồ runtime thin client, data directory layout, và máy trạng thái (state machine) của bản ghi âm.
3. 🔌 **[Đặc tả REST API (api.md)](file:///d:/KProject/AIRecorder/docs/api.md)** — Tài liệu đầy đủ cấu trúc Request/Response và quy chuẩn lỗi JSON của tất cả endpoint.
4. 🎭 **[Hướng dẫn Chạy Demo & Trình bày (demo_guide.md)](file:///d:/KProject/AIRecorder/docs/demo_guide.md)** — Kịch bản chạy live demo thực tế, **kịch bản chạy demo giả lập (mock cases)** không cần micro, và bộ câu hỏi phản biện Q&A thường gặp.
5. 🧪 **[Hướng dẫn Kiểm thử Hệ thống (testing.md)](file:///d:/KProject/AIRecorder/docs/testing.md)** — Cách chạy automated test (`pytest`, `vitest`) và giải thích chi tiết các script test E2E.
6. 🗺️ **[Lộ trình phát triển (roadmap.md)](file:///d:/KProject/AIRecorder/docs/roadmap.md)** — Trạng thái hoàn thành dự án và kế hoạch nâng cấp tương lai (SQLite, Real-time STT).

---

## 🚀 Hướng dẫn Chạy Ứng dụng (Run Instructions)

Để khởi chạy ứng dụng AI Recorder trên máy local của bạn, hãy thực hiện theo các bước chuẩn bị Backend và Frontend dưới đây:

### 1. Khởi chạy Backend API
Backend được viết bằng FastAPI và quản lý dependencies thông qua `uv`.
```powershell
# Di chuyển tới thư mục backend
cd backend

# Cài đặt các thư viện phụ thuộc
uv sync --group dev

# Tạo file môi trường từ file mẫu và bổ sung API Keys của bạn (nếu có)
cp .env.example .env

# Khởi chạy server FastAPI phát triển
uv run uvicorn app.main:app --reload
```

> [!NOTE]
> * API Backend mặc định chạy tại địa chỉ `http://localhost:8000`.
> * Bạn có thể truy cập tài liệu Swagger UI tương tác để test API tại `http://localhost:8000/docs`.

### 2. Khởi chạy Frontend Desktop App
Frontend sử dụng Electron, React và Vite. Lệnh dev sẽ tự động biên dịch và mở cửa sổ ứng dụng desktop.
```powershell
# Mở một terminal mới và di chuyển tới thư mục frontend
cd frontend

# Cài đặt các packages phụ thuộc
npm install

# Khởi chạy ứng dụng Electron ở chế độ Development
npm run dev
```

### 💡 Lưu ý quan trọng khi chạy lần đầu:
* **Tải tự động mô hình AI (Lazy-loading Models):** Ở lần đầu tiên bạn bấm nút **Transcribe (Dịch văn bản)** trên giao diện ứng dụng, backend sẽ tự động tải các mô hình STT (Zipformer ~270MB), Diarization (CAM++ ~24MB) và Dấu câu (ViBERT-capu) trực tiếp từ HuggingFace/Github về máy. Quá trình này có thể mất từ 1-3 phút tùy thuộc vào tốc độ mạng của bạn. Các lần dịch sau sẽ chạy ngay lập tức mà không cần tải lại.
* **Cấu hình API Key:** Bạn có thể điền sẵn khóa API của Google Gemini, ChatGPT hoặc Claude vào tệp `backend/.env`, hoặc điền trực tiếp trong giao diện ứng dụng bằng cách bấm biểu tượng **Cài đặt (Settings)** ở góc phải màn hình.

---

## 🧪 Kiểm thử & Phát triển
* Thông tin hướng dẫn chi tiết cách chạy Unit Test cho Backend (`pytest`) và Frontend (`vitest`) được lưu trữ tại **[Hướng dẫn Kiểm thử Hệ thống (testing.md)](file:///d:/KProject/AIRecorder/docs/testing.md)**.
* Xem kịch bản chạy demo giả lập (Mock cases) không cần micro tại **[Hướng dẫn Chạy Demo (demo_guide.md)](file:///d:/KProject/AIRecorder/docs/demo_guide.md)**.
