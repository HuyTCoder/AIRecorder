# Đặc tả Tính năng Toàn diện — AI Recorder

Tài liệu này tập hợp và giải thích chi tiết các tính năng nghiệp vụ, cơ chế hoạt động, yêu cầu phi chức năng (hiệu năng, tài nguyên) và thiết kế xử lý lỗi của ứng dụng AI Recorder.

---

## 1. Thu âm & Trộn âm thanh (Audio Capture & Mixing)

AI Recorder hỗ trợ ghi âm đồng thời từ hai nguồn độc lập trên hệ điều hành Windows:
* **Microphone (Đầu vào vật lý):** Thu âm trực tiếp giọng nói của người dùng thông qua thư viện `sounddevice`.
* **System Audio (Âm thanh hệ thống):** Thu âm thanh phát ra từ các ứng dụng khác (Youtube, Zoom, Game...) bằng kỹ thuật **WASAPI Loopback** qua thư viện `pyaudiowpatch`.

> [!NOTE]
> Tiến trình thu âm và điều phối thiết bị được triển khai tại [recorder.py](file:///d:/KProject/AIRecorder/backend/app/services/recorder.py).

### Cơ chế hoạt động:
1. **Thiết bị khả dụng:** Backend quét toàn bộ driver âm thanh qua API `GET /devices` tại [devices.py](file:///d:/KProject/AIRecorder/backend/app/api/devices.py) để lọc ra danh sách các Microphone và Loopback Speaker hợp lệ.
2. **Thu âm không chặn (Non-blocking Capture):** Audio callback chỉ đẩy dữ liệu thô (PCM chunk) vào hàng đợi. Một luồng ghi ngầm (background worker thread) sẽ rút dữ liệu này và lưu xuống đĩa. Cơ chế này đảm bảo âm thanh không bị gián đoạn hay mất gói tin ngay cả khi CPU bị quá tải.
3. **Trộn âm (Audio Mixing):**
   * Nếu chọn ghi từ cả hai nguồn (Mixed Mode), các frame âm thanh thu được từ Mic và System Loopback sẽ được đồng bộ hóa thời gian và phối trộn (mix) theo tỷ lệ Gain cấu hình (mặc định là `1.0` cho mỗi nguồn) tại [audio_mixer.py](file:///d:/KProject/AIRecorder/backend/app/services/audio_mixer.py).
   * Công thức trộn cơ bản đảm bảo không bị méo tiếng hoặc quá âm lượng (clipping).
4. **Định dạng đầu ra:** Toàn bộ dữ liệu ghi âm được ghi bằng [audio_writer.py](file:///d:/KProject/AIRecorder/backend/app/services/audio_writer.py) và lưu trữ thành file WAV tiêu chuẩn:
   * **Format:** `WAV (PCM 16-bit, 16kHz, Mono)`
   * **Dung lượng lý thuyết:** ~1.92 MB mỗi phút (~115 MB mỗi giờ).

---

## 2. Nhập & Chuẩn hóa tệp tin âm thanh ngoại vi (Audio Import & Normalization)

Ngoài việc ghi âm trực tiếp, AI Recorder hỗ trợ người dùng nhập (Import) bất kỳ tệp âm thanh nào từ bên ngoài (ví dụ: file ghi âm cuộc gọi `.mp3`, `.m4a`, `.ogg`, `.wav` chất lượng khác) để chạy dịch thuật và tóm tắt cuộc họp.

### Cơ chế chuẩn hóa phía Frontend (Web Audio API):
Để đảm bảo tệp âm thanh đầu vào luôn khớp 100% với yêu cầu kỹ thuật của mô hình STT (16kHz, Mono, 16-bit PCM), hệ thống thực hiện chuẩn hóa trực tiếp trên Frontend Electron thông qua Web Audio API:
1. **Giải mã đa định dạng (Decode Audio):** Sử dụng `AudioContext.decodeAudioData` để giải mã tệp âm thanh người dùng chọn thành một đối tượng `AudioBuffer` chuẩn trong trình duyệt.
2. **Nội suy tần số & Gộp kênh (Resampling & Downmixing):** Sử dụng `OfflineAudioContext` cấu hình tần số đầu ra là **`16,000 Hz`** và số kênh là **`1` (Mono)**. Tiến trình kết nối nguồn âm thanh gốc và chạy render để tạo ra mảng dữ liệu âm thanh số thực `Float32Array`.
3. **Mã hóa WAV 16-bit PCM (WAV Encoding):**
   * Hệ thống tự động chuyển đổi mảng số thực `Float32Array` (khoảng $[-1.0, 1.0]$) sang định dạng số nguyên 16-bit PCM (khoảng $[-32768, 32767]$).
   * Ghi cấu trúc Header WAV 44-byte tiêu chuẩn để đóng gói thành một `WAV Blob` hoàn chỉnh và gửi lên API `/recordings/upload` (định nghĩa tại [recordings.py](file:///d:/KProject/AIRecorder/backend/app/api/recordings.py)).
   * *Ưu điểm:* Việc xử lý bằng Web Audio API diễn ra cực kỳ nhanh (mất dưới 1 giây cho tệp 10 phút) vì chạy trên nhân C++ của Chromium, giảm tải hoàn toàn cho CPU của Backend.

---

## 3. Nhận diện giọng nói Local (Offline Speech-to-Text)

Để đảm bảo tính riêng tư, bảo mật dữ liệu và khả năng hoạt động ngoại tuyến (offline), AI Recorder sử dụng động cơ chuyển giọng nói thành văn bản chạy trực tiếp trên máy người dùng.

### Yêu cầu đặc tả tệp tin âm thanh đầu vào (Input Audio Specifications):
Để động cơ nhận diện giọng nói (ASR) và phân tách người nói (Diarization) hoạt động chính xác và không bị lỗi, tệp âm thanh đầu vào bắt buộc phải tuân thủ nghiêm ngặt các thông số kỹ thuật sau:
* **Định dạng container (Format):** `WAV` (Waveform Audio File Format).
* **Tần số lấy mẫu (Sample Rate):** Đúng **`16,000 Hz` (16kHz)**. Mô hình STT tiếng Việt được huấn luyện chuyên biệt trên tần số này để đạt độ chính xác cao nhất.
* **Số kênh âm thanh (Channels):** Đúng **`1` kênh (Mono)**. Nếu là tệp Stereo (2 kênh), hệ thống sẽ ném lỗi `ValueError` để bảo vệ tài nguyên tính toán.
* **Độ sâu mẫu (Sample Width):** **`16-bit PCM`** (tương đương 2 bytes mỗi sample).
* **Biên độ tín hiệu (Amplitude Range):** Dải số nguyên $[-32768, 32767]$, được hệ thống tự động chuẩn hóa về dạng số thực `float32` trong khoảng `[-1.0, 1.0]` khi nạp vào mô hình AI.

### Động cơ ASR (Automated Speech Recognition):
* **Thư viện:** `sherpa-onnx` (viết trên nền ONNX Runtime, tối ưu hóa cho CPU).
* **Mã nguồn tích hợp:** [zipformer.py](file:///d:/KProject/AIRecorder/backend/app/services/zipformer.py)
* **Mô hình STT:** `Zipformer-transducer` (68M parameters) huấn luyện trên 70.000 giờ tiếng Việt (Tải từ HuggingFace: [csukuangfj/sherpa-onnx-zipformer-vi-2025-04-20](https://huggingface.co/csukuangfj/sherpa-onnx-zipformer-vi-2025-04-20)). Mô hình này cực kỳ gọn nhẹ (~68M tham số) nhưng có độ chính xác rất cao đối với giọng nói tiếng Việt.
* **Cấu hình luồng:** Mặc định sử dụng tối đa 4 luồng CPU (`ZIPFORMER_NUM_THREADS=4`) để chạy inference, tránh hiện tượng đơ cứng máy tính khi người dùng đang thuyết trình hoặc làm việc khác.
* **Cơ chế nạp mô hình:** Lazy-loading. Mô hình chỉ được nạp vào RAM ở lần gọi transcribe đầu tiên nhằm rút ngắn tối đa thời gian khởi động ứng dụng (dưới 3 giây).

### Phục hồi dấu câu tự động (Punctuation Restoration):
Văn bản thô từ mô hình STT thường không có dấu câu và không viết hoa. Hệ thống tích hợp thêm một lớp xử lý ngôn ngữ tự nhiên:
* **Mã nguồn tích hợp:** [restorer.py](file:///d:/KProject/AIRecorder/backend/app/services/punctuation/restorer.py) và [service.py](file:///d:/KProject/AIRecorder/backend/app/services/punctuation/service.py)
* **Mô hình:** `ViBERT-capu` (INT8 ONNX) chạy trực tiếp trên CPU (Tải từ HuggingFace: [welcomyou/vibert-capu-onnx](https://huggingface.co/welcomyou/vibert-capu-onnx)).
* **Cơ chế:** Chia nhỏ văn bản thành các segment khoảng 7 giây, tự động thêm dấu phẩy, dấu chấm, dấu hỏi và viết hoa chữ cái đầu câu để văn bản dễ đọc và tự nhiên nhất.

---

## 4. Phân biệt người nói Local (Offline Speaker Diarization)

Nhằm mục đích lập biên bản cuộc họp chi tiết cho nhiều thành viên phát biểu, AI Recorder tích hợp module nhận dạng và phân biệt người nói local chạy trực tiếp trên CPU.

### Cơ chế hoạt động:
* **Mã nguồn tích hợp:** [diarization.py](file:///d:/KProject/AIRecorder/backend/app/services/diarization.py)
* **Mô hình Trích xuất Đặc trưng (Speaker Embedding):**
  * **Công nghệ:** Mô hình **CAM++ ONNX** (`3D-Speaker`) của Alibaba Cloud thông qua thư viện `sherpa-onnx` (Tải từ HuggingFace: [csukuangfj/speaker-embedding-models](https://huggingface.co/csukuangfj/speaker-embedding-models)).
  * **Đặc tính:** Mô hình siêu nhẹ (~24.6 MB), chạy cực kỳ nhanh trên CPU, trích xuất ra một vector đặc trưng 192 chiều đại diện cho dấu vân tay giọng nói (voiceprint) của người phát biểu.
* **Chuẩn hóa vector đặc trưng:**
  * Toàn bộ vector đặc trưng trích xuất được chuẩn hóa theo chuẩn **L2-Norm** trước khi thực hiện so sánh hoặc gom cụm:
    $$\vec{v}_{normalized} = \frac{\vec{v}}{\|\vec{v}\|_2}$$
* **Thuật toán gom cụm (Clustering):**
  * Hệ thống triển khai thuật toán gom cụm **K-Means++** tùy biến viết bằng `numpy` (không cần scikit-learn hay PyTorch).
  * **Tự động nhận diện số người nói (Auto-detect):** Hệ thống quét số người nói $K$ từ 2 đến 4, tính toán điểm số **Silhouette Score** cho mỗi cách phân chia để chọn ra $K$ tối ưu nhất (Silhouette Score cao nhất).
  * **Cơ chế gộp tâm cụm (Centroid Merging) cho Độc thoại:** Để khắc phục nhược điểm của K-Means (bắt buộc phải chia tối thiểu $K \ge 2$), sau khi gom cụm, hệ thống tính độ tương đồng Cosine giữa các tâm cụm (centroids). Nếu độ tương đồng **$> 0.80$**, các cụm sẽ tự động được gộp lại thành một người nói duy nhất ($K=1$).
* **Luồng chạy hậu xử lý (Post-transcription Workflow):**
  1. Sau khi Zipformer dịch xong văn bản và phân đoạn (Timestamps), Backend đọc lại các phân đoạn WAV tương ứng từ đĩa.
  2. Bỏ qua các phân đoạn ngắn dưới 0.5 giây để tránh nhiễu.
  3. Trích xuất đặc trưng bằng CAM++ cho từng phân đoạn.
  4. Chạy thuật toán gom cụm và gán nhãn người nói ngược lại trường `speaker` (dưới dạng `"Người nói 0"`, `"Người nói 1"`,...) trong metadata.

---

## 5. Tóm tắt nội dung bằng AI (AI Summary)

Sau khi có bản dịch văn bản đầy đủ kèm nhãn người nói, người dùng có thể gửi yêu cầu tóm tắt cuộc họp/bản ghi âm.

* **Mã nguồn tích hợp:** [llm.py](file:///d:/KProject/AIRecorder/backend/app/services/llm.py)
* **Công nghệ:** Google Gemini API (dòng mô hình `gemini-3.5-flash` hoặc các mô hình Gemini 3.x khác).
* **Quy trình:**
  1. Gửi văn bản đã khôi phục dấu câu lên Gemini cùng Prompt được tối ưu hóa.
  2. Kết quả trả về dưới dạng JSON cấu trúc chứa 3 phần:
     * **Tổng quan (Summary):** Đoạn văn ngắn tóm tắt nội dung chính.
     * **Ý chính (Key Points):** Danh sách các luận điểm cốt lõi.
     * **Đầu việc cần làm (Action Items):** Các nhiệm vụ được phân công hoặc rút ra từ cuộc nói chuyện.
  3. Kết quả được lưu vào file `summary.json` và hiển thị trên giao diện `AIPanel` của Frontend.
* **Xuất báo cáo (Export):** Hỗ trợ chuyển đổi kết quả tóm tắt thành file báo cáo Markdown (`.md`) đẹp mắt để lưu trữ hoặc chia sẻ qua email/chat.

---

## 6. Đặc tả Phi chức năng (Non-functional Requirements - NFR)

| Chỉ số | Yêu cầu mục tiêu (Target NFR) | Trạng thái thực tế / Cách đạt được |
|---|---|---|
| **RAM (Backend)** | Idle: < 100MB. Khi STT + Diarization chạy: < 600MB. | **Đạt được:** Zipformer (68M) và CAM++ (24MB) tối ưu hóa rất nhỏ, giải phóng RAM ngay sau khi hoàn thành tác vụ. |
| **CPU Usage** | Khi thu âm: < 5% CPU máy core i5 tầm trung. | **Đạt được:** Nhờ luồng ghi đĩa bất đồng bộ và tối ưu hóa buffer size tại [recorder.py](file:///d:/KProject/AIRecorder/backend/app/services/recorder.py). |
| **Độ trễ dịch (ASR Latency)** | Dịch file 10 phút dưới 1 phút trên CPU thường. | **Đạt được vượt chỉ tiêu:** Thực tế kiểm thử dịch và diarize tệp 10 phút chỉ mất **31 giây** trên CPU (~20x real-time speed). |
| **Giới hạn thời gian** | Hỗ trợ ghi âm liên tục lên đến 4 tiếng (~460 MB WAV). | **Đạt được:** Bằng cách **chia nhỏ file WAV thành các chunk 50 giây (ASR Chunking)** trước khi đưa vào Zipformer để tránh lỗi tràn bộ nhớ (OOM) của ONNX Runtime. |
| **Khởi động App** | Sẵn sàng ghi âm trong vòng dưới 3 giây. | **Đạt được:** Trì hoãn việc tải các mô hình AI cho đến khi thực sự bấm nút dịch (Lazy-loading). |

---

## 7. Cơ chế Xử lý lỗi & Độ ổn định (Error Handling & Resilience)

Hệ thống được thiết kế với cơ chế phòng ngừa lỗi để bảo vệ tối đa dữ liệu ghi âm của người dùng:

1. **Cơ chế chống tràn RAM (ASR Chunking):**
   * Đối với các tệp ghi âm dài (Ví dụ: cuộc họp dài 10-30 phút), thuật toán self-attention của Transformer trong Zipformer có thể yêu cầu dung lượng RAM tính toán lên đến hàng chục GB (gây sập app do tràn bộ nhớ). Hệ thống tự động chia nhỏ file WAV thành các phân đoạn 50 giây để dịch tuần tự và ghép kết quả.
2. **Khôi phục trạng thái khi Backend tắt đột ngột (Crash/Restart Recovery):**
   * Nếu Backend bị tắt đột ngột khi một tác vụ đang chạy dịch (`transcribing`), ở lần khởi động tiếp theo, hệ thống tại [pipeline.py](file:///d:/KProject/AIRecorder/backend/app/services/pipeline.py) sẽ tự động quét thư mục recordings thông qua [repository.py](file:///d:/KProject/AIRecorder/backend/app/services/repository.py), phát hiện các metadata bị kẹt ở trạng thái này và chuyển chúng về trạng thái `error`.
   * Hệ thống lưu trữ mã lỗi chi tiết trong `error_source` (ví dụ: `"transcribe"` hoặc `"summarize"`) để Frontend hiển thị nút **Retry** (Thử lại) thủ công tương ứng.
   * Hệ thống **không tự động chạy lại** tác vụ lỗi để tránh gây quá tải CPU ngoài ý muốn hoặc lặp lại lỗi cũ vô hạn.
3. **Bảo vệ kết quả ASR trước lỗi Diarization:**
   * Quá trình Phân biệt người nói (Diarization) diễn ra độc lập sau khi nhận diện ASR hoàn tất. Nếu việc phân biệt người nói bị lỗi (Ví dụ: tệp âm thanh bị lỗi cắt đoạn, mô hình CAM++ bị hỏng), hệ thống sẽ log cảnh báo và bỏ qua Diarization để giữ lại nguyên vẹn văn bản đã dịch thay vì làm sập toàn bộ tác vụ.
4. **Ghi file an toàn (Atomic Writes):**
   * Các tệp tin `metadata.json` và `transcript.json` được ghi thông qua cơ chế ghi tạm thời (write to temp file rồi rename) tại [repository.py](file:///d:/KProject/AIRecorder/backend/app/services/repository.py). Điều này đảm bảo tệp tin không bao giờ bị hỏng (corrupt) hoặc mất nội dung nếu mất điện giữa chừng.
5. **Xử lý lỗi mạng / API Key:**
   * Khi mạng yếu hoặc API Key Gemini bị lỗi/hết hạn, tác vụ tóm tắt sẽ trả về lỗi, chuyển trạng thái ghi âm sang `error` kèm nguồn lỗi `"summarize"`. Toàn bộ nội dung văn bản (transcript) đã dịch trước đó vẫn được bảo toàn nguyên vẹn trên đĩa, người dùng chỉ cần cấu hình lại mạng/key rồi bấm Retry Summarize.
