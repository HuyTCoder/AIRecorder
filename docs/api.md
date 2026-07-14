# REST API Specification — AI Recorder

Tài liệu này đặc tả toàn bộ các REST API được cung cấp bởi Backend FastAPI tại địa chỉ mặc định `http://localhost:8000/api/v1`.

---

## 🛑 Chuẩn phản hồi Lỗi (Error Envelope)

Tất cả các API khi gặp lỗi (4xx hoặc 5xx) sẽ phản hồi theo cấu trúc JSON chuẩn sau:
```json
{
  "success": false,
  "error": {
    "code": 404,
    "message": "Chi tiết thông báo lỗi..."
  }
}
```

---

## 🎙️ 1. Audio Devices (Thiết bị Âm thanh)

> [!NOTE]
> Các endpoint quản lý thiết bị âm thanh được triển khai tại [devices.py](file:///d:/KProject/AIRecorder/backend/app/api/devices.py).

### Lấy danh sách thiết bị âm thanh
* **Method:** `GET`
* **Path:** `/devices`
* **Mô tả:** Quét hệ thống và trả về danh sách các Microphone (thiết bị đầu vào vật lý) và System Audio Loopback (thiết bị thu âm hệ thống) khả dụng.
* **Phản hồi thành công (200 OK):**
  ```json
  {
    "microphones": [
      {
        "id": 0,
        "name": "Microphone (Realtek Audio)",
        "max_input_channels": 2,
        "max_output_channels": 0,
        "default_samplerate": 44100.0,
        "is_default": true
      }
    ],
    "system_audio": [
      {
        "id": 5,
        "name": "Speakers (Realtek Audio) [Loopback]",
        "max_input_channels": 2,
        "max_output_channels": 0,
        "default_samplerate": 48000.0,
        "is_default": true
      }
    ]
  }
  ```

---

## 📂 2. Recordings (Quản lý Bản ghi)

> [!NOTE]
> Các endpoint CRUD và điều khiển ghi âm được triển khai tại [recordings.py](file:///d:/KProject/AIRecorder/backend/app/api/recordings.py).

### Khởi tạo & Bắt đầu ghi âm mới
* **Method:** `POST`
* **Path:** `/recordings`
* **Mô tả:** Khởi tạo thư mục bản ghi mới và kích hoạt driver bắt đầu thu âm từ Mic, Loa hoặc cả hai.
* **Yêu cầu (Request Body):**
  ```json
  {
    "use_mic": true,
    "use_system": false,
    "mic_device_id": 0,
    "system_device_id": null,
    "sample_rate": 16000,
    "title": "Demo họp tổng kết"
  }
  ```
* **Phản hồi thành công (201 Created):**
  ```json
  {
    "id": "rec_20260708_103000_abcd",
    "title": "Demo họp tổng kết",
    "state": "recording",
    "source_type": "mic_only",
    "use_mic": true,
    "use_system": false,
    "created_at": "2026-07-08T10:30:00Z",
    "duration": null,
    "transcript": [],
    "summary": null,
    "key_points": [],
    "action_items": [],
    "error_source": null
  }
  ```

### Lấy danh sách toàn bộ bản ghi
* **Method:** `GET`
* **Path:** `/recordings`
* **Mô tả:** Lấy danh sách tất cả các bản ghi có trên đĩa, sắp xếp theo thứ tự mới nhất (không đính kèm mảng transcript chi tiết để tối ưu tốc độ tải).
* **Phản hồi thành công (200 OK):** Mảng các đối tượng Metadata bản ghi.

### Lấy thông tin chi tiết một bản ghi
* **Method:** `GET`
* **Path:** `/recordings/{session_id}`
* **Mô tả:** Lấy đầy đủ thông tin Metadata của một bản ghi cụ thể bao gồm cả transcript thô nếu có.
* **Phản hồi thành công (200 OK):** Đối tượng Metadata bản ghi chi tiết.

### Cập nhật tiêu đề bản ghi
* **Method:** `PATCH`
* **Path:** `/recordings/{session_id}`
* **Mô tả:** Đổi tên (tiêu đề) hiển thị của bản ghi và lưu lại vào metadata.
* **Yêu cầu (Request Body):**
  ```json
  {
    "title": "Tên mới của bản ghi"
  }
  ```
* **Phản hồi thành công (200 OK):** Metadata cập nhật.

### Xóa bản ghi
* **Method:** `DELETE`
* **Path:** `/recordings/{session_id}`
* **Mô tả:** Dừng ghi âm nếu đang live và xóa sạch thư mục bản ghi âm trên ổ đĩa (bao gồm file âm thanh WAV và các file JSON metadata/transcript/summary).
* **Phản hồi thành công:** `204 No Content`

### Tạm dừng ghi âm
* **Method:** `POST`
* **Path:** `/recordings/{session_id}/pause`
* **Mô tả:** Tạm dừng luồng ghi âm.
* **Phản hồi thành công (200 OK):** Metadata với trạng thái `paused`.

### Tiếp tục ghi âm
* **Method:** `POST`
* **Path:** `/recordings/{session_id}/resume`
* **Mô tả:** Tiếp tục luồng ghi âm đang tạm dừng.
* **Phản hồi thành công (200 OK):** Metadata với trạng thái `recording`.

### Dừng ghi âm
* **Method:** `POST`
* **Path:** `/recordings/{session_id}/stop`
* **Mô tả:** Đóng file WAV, tính toán thời lượng thực tế và kết thúc phiên ghi âm live.
* **Phản hồi thành công (200 OK):** Metadata với trạng thái `stopped` và giá trị `duration` thực tế.

### Stream tệp âm thanh (WAV Playback)
* **Method:** `GET`
* **Path:** `/recordings/{session_id}/stream`
* **Mô tả:** Trả về file âm thanh nhị phân `audio/wav` để trình phát Frontend phát lại hoặc tua thời gian.

---

## 🤖 3. AI Pipelines (Xếp hàng xử lý AI ngầm)

> [!NOTE]
> Các endpoint trigger tác vụ nền AI được triển khai tại [recordings.py](file:///d:/KProject/AIRecorder/backend/app/api/recordings.py) và điều phối qua [pipeline.py](file:///d:/KProject/AIRecorder/backend/app/services/pipeline.py).

### Khởi chạy dịch thuật giọng nói (Speech-to-Text)
* **Method:** `POST`
* **Path:** `/recordings/{session_id}/transcribe`
* **Mô tả:** Đưa tác vụ chạy STT vào hàng đợi xử lý ngầm (Background Task). Trả về mã 202 ngay lập tức mà không chặn giao diện Client.
* **Quy tắc:** Chỉ chạy khi bản ghi ở trạng thái `stopped`, `completed` hoặc `error` và có file WAV. Trả về lỗi `409 Conflict` nếu hàng đợi pipeline đang bận xử lý một tác vụ STT khác.
* **Phản hồi thành công (202 Accepted):**
  ```json
  {
    "task_id": "task_transcribe_12345",
    "session_id": "rec_20260708_103000_abcd",
    "task_type": "transcribe",
    "status": "pending"
  }
  ```

### Hủy tác vụ dịch thuật đang chạy
* **Method:** `POST`
* **Path:** `/recordings/{session_id}/transcribe/cancel`
* **Mô tả:** Hủy ngang tiến trình dịch thuật đang xử lý ngầm và đưa trạng thái về `stopped`.
* **Phản hồi thành công (200 OK):** Thông tin tác vụ đã bị hủy.

### Khởi chạy tóm tắt nội dung AI (Generative AI Summary)
* **Method:** `POST`
* **Path:** `/recordings/{session_id}/summarize`
* **Mô tả:** Đưa tác vụ gửi văn bản lên API Generative AI đã chọn (Gemini, ChatGPT, Claude) để tóm tắt cuộc họp/bản ghi âm vào hàng xử lý ngầm.
* **Phản hồi thành công (202 Accepted):**
  ```json
  {
    "task_id": "task_summarize_54321",
    "session_id": "rec_20260708_103000_abcd",
    "task_type": "summarize",
    "status": "pending"
  }
  ```

### Lấy nội dung văn bản dịch chi tiết (Transcript segments)
* **Method:** `GET`
* **Path:** `/recordings/{session_id}/transcript`
* **Mô tả:** Lấy văn bản đầy đủ kèm danh sách các segment có mốc thời gian bắt đầu/kết thúc cụ thể (dành cho tính năng click-to-seek phát nhạc). Trả về cấu trúc rỗng nếu chưa chạy dịch.
* **Phản hồi thành công (200 OK):**
  ```json
  {
    "recording_id": "rec_20260708_103000_abcd",
    "text": "Nội dung cuộc họp đầy đủ...",
    "segments": [
      {
        "id": 0,
        "start": 0.0,
        "end": 2.5,
        "text": "Chào mừng mọi người đến với buổi họp."
      }
    ]
  }
  ```

### Lấy nội dung tóm tắt AI
* **Method:** `GET`
* **Path:** `/recordings/{session_id}/summary`
* **Mô tả:** Lấy dữ liệu tóm tắt cuộc họp chi tiết gồm 3 thành phần. Trả về `404` nếu chưa hoàn thành tóm tắt.
* **Phản hồi thành công (200 OK):**
  ```json
  {
    "recording_id": "rec_20260708_103000_abcd",
    "summary": "Tổng quan nội dung tóm tắt...",
    "key_points": [
      "Điểm cốt lõi 1",
      "Điểm cốt lõi 2"
    ],
    "action_items": [
      "Nhiệm vụ cần thực hiện 1"
    ]
  }
  ```

---

## ⚙️ 4. Settings (Cài đặt Ứng dụng)

> [!NOTE]
> Các endpoint quản lý cấu hình và cài đặt được triển khai tại [settings.py](file:///d:/KProject/AIRecorder/backend/app/api/settings.py).

### Lấy thông tin cài đặt hiện tại
* **Method:** `GET`
* **Path:** `/settings`
* **Mô tả:** Trả về toàn bộ cấu hình hiện tại của ứng dụng (lưu trong `settings.json` ở Backend), bao gồm nhà cung cấp AI đang chọn, API Keys, theme, font size, và custom prompt.
* **Phản hồi thành công (200 OK):**
  ```json
  {
    "ai_provider": "gemini",
    "model": "gemini-3.5-flash",
    "theme": "dark",
    "font_size": "small",
    "prompt": "Bạn là một trợ lý AI chuyên nghiệp...",
    "gemini_api_key": "AIzaSy...",
    "chatgpt_api_key": "sk-proj-...",
    "claude_api_key": "sk-ant-..."
  }
  ```

### Cập nhật cài đặt
* **Method:** `POST`
* **Path:** `/settings`
* **Mô tả:** Cập nhật một hoặc nhiều cấu hình ứng dụng. Các trường không được truyền lên sẽ giữ nguyên giá trị cũ. Kết quả mới sẽ tự động được ghi đè atomically xuống tệp tin `settings.json`.
* **Yêu cầu (Request Body - SettingsUpdate):**
  ```json
  {
    "ai_provider": "chatgpt",
    "model": "gpt-4o",
    "chatgpt_api_key": "sk-proj-newkey123"
  }
  ```
* **Phản hồi thành công (200 OK):** Trả về toàn bộ cài đặt sau khi cập nhật.
  ```json
  {
    "ai_provider": "chatgpt",
    "model": "gpt-4o",
    "theme": "dark",
    "font_size": "small",
    "prompt": "Bạn là một trợ lý AI chuyên nghiệp...",
    "gemini_api_key": "AIzaSy...",
    "chatgpt_api_key": "sk-proj-newkey123",
    "claude_api_key": "sk-ant-..."
  }
  ```
