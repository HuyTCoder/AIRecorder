# Hướng dẫn Chạy Demo & Trình bày Dự án — AI Recorder

Tài liệu này cung cấp kịch bản từng bước và chuẩn bị tài nguyên để bạn có thể tự tin thuyết trình, demo trực quan ứng dụng AI Recorder trước đối tác hoặc hội đồng đánh giá.

---

## 1. Chuẩn bị Môi trường (Setup Prerequisites)

Trước khi bắt đầu demo, đảm bảo các tài nguyên sau đã sẵn sàng:

### A. Mô hình AI (Offline Models)
Mô hình STT, Phân biệt người nói và Dấu câu được tải tự động ở lần chạy đầu tiên. Hãy chạy trước một bản ghi thử để đảm bảo máy tính đã tải sẵn:
* **Mô hình Zipformer:** Lưu tại `backend/models/sherpa-onnx-zipformer-vi-2025-04-20/` (Tải từ HuggingFace: [csukuangfj/sherpa-onnx-zipformer-vi-2025-04-20](https://huggingface.co/csukuangfj/sherpa-onnx-zipformer-vi-2025-04-20)).
* **Mô hình CAM++ (Diarization):** Lưu tại `backend/models/3dspeaker_campplus.onnx` (Tải từ HuggingFace: [csukuangfj/speaker-embedding-models](https://huggingface.co/csukuangfj/speaker-embedding-models)).
* **Mô hình ViBERT-capu:** Được cache trong thư mục HuggingFace của hệ điều hành: `~/.cache/huggingface/` (Tải từ HuggingFace: [welcomyou/vibert-capu-onnx](https://huggingface.co/welcomyou/vibert-capu-onnx)).

### B. File cấu hình `.env` của Backend
Đảm bảo file `backend/.env` đã cấu hình cơ bản cho STT Engine:
```env
ASR_ENGINE=zipformer
ZIPFORMER_MODEL_DIR=models
ZIPFORMER_NUM_THREADS=4
```

### C. Cấu hình API Key tóm tắt (Settings)
Thiết lập API Key của các nhà cung cấp Generative AI (Gemini, ChatGPT, Claude) trực tiếp thông qua biểu tượng **Cài đặt (Settings)** trên giao diện ứng dụng. Cấu hình này được lưu trữ độc lập dưới tệp `settings.json`.

---

## 2. Kịch bản 1: Live Demo (Ghi âm & Xử lý thực tế)

Kịch bản này mất khoảng 2-3 phút, trình diễn trọn vẹn luồng hoạt động từ đầu đến cuối của ứng dụng.

### Bước 1: Khởi động hệ thống
1. Chạy Backend:
   ```powershell
   cd backend
   uv run uvicorn app.main:app --reload
   ```
2. Chạy Frontend:
   ```powershell
   cd frontend
   npm run dev
   ```

### Bước 2: Tạo phiên ghi âm mới
1. Trên giao diện App, bấm nút **New Recording** (hoặc nút Microphone đỏ).
2. Trình diễn việc chọn thiết bị:
   * **Microphone:** Chọn mic của bạn.
   * **System Audio:** Chọn loa loopback (WASAPI).
   * **Chế độ:** Tích chọn cả hai để thể hiện khả năng **Trộn nguồn (Mixed Audio)**.
3. Nhập tên bản ghi (ví dụ: `Demo Cuộc họp AI Recorder`) và bấm **Start**.

### Bước 3: Ghi âm và Tương tác (Ghi hình/Nói trực tiếp)
1. Hãy nói vào mic một vài câu, đồng thời bật một đoạn nhạc Youtube hoặc video âm thanh nhỏ trên máy tính.
2. Giải thích: *“Hệ thống đang thu đồng thời giọng nói của tôi từ Mic và âm thanh của video từ hệ thống, tự động trộn thành một luồng âm duy nhất bất đồng bộ.”*
3. Bấm **Pause** (Tạm dừng): Giải thích rằng luồng ghi đĩa sẽ dừng ghi chunk mới để tiết kiệm dung lượng.
4. Bấm **Resume** (Tiếp tục) để thu tiếp. Bấm **Stop** để hoàn tất bản ghi.

### Bước 4: Chạy Speech-to-Text (ASR) Local & Phân biệt người nói
1. Bản ghi mới xuất hiện ở Sidebar bên trái. Click chọn bản ghi.
2. Bấm nút **Transcribe** (Dịch văn bản).
3. **Giải thích trong lúc chờ dịch (mất khoảng vài giây):**
   * *“Tác vụ được chạy ngầm hoàn toàn offline dưới CPU bằng mô hình Zipformer tiếng Việt tại [zipformer.py](file:///d:/KProject/AIRecorder/backend/app/services/zipformer.py).”*
   * *“Để chống tràn RAM trên các tệp âm thanh dài, hệ thống tự động chia nhỏ file WAV thành các chunk 50 giây để chạy ASR tuần tự.”*
   * *“Sau khi có kết quả chữ, hệ thống tự động thêm dấu câu bằng [restorer.py](file:///d:/KProject/AIRecorder/backend/app/services/punctuation/restorer.py), rồi đưa các phân đoạn âm thanh qua mô hình CAM++ tại [diarization.py](file:///d:/KProject/AIRecorder/backend/app/services/diarization.py) để trích xuất vân tay giọng nói (voiceprint) và thuật toán K-Means++ tự động gom cụm phân biệt người nói.”*
4. Giao diện hiển thị văn bản chia theo câu có nhãn người nói rõ ràng (ví dụ: `[Người nói 0]`, `[Người nói 1]`) kèm mốc thời gian (Timestamp). Bấm vào một câu bất kỳ để tua phát nhạc (seek) đến đúng thời điểm đó.

### Bước 5: Chạy Tóm tắt AI & Xuất báo cáo
1. Bấm nút **Summarize** (Tóm tắt AI).
2. Sau khi có kết quả từ mô hình AI đã chọn (Gemini, ChatGPT, Claude được gọi từ [llm.py](file:///d:/KProject/AIRecorder/backend/app/services/llm.py)), giao diện hiển thị 3 Tab: Tổng quan, Ý chính, Đầu việc cần làm.
3. Bấm nút **Export Report** để tải file Markdown báo cáo về máy tính.

---

## 3. Kịch bản 2: Demo Mô phỏng (Simulation / Mock Test cases)

> [!TIP]
> **Đây là phương án dự phòng hoàn hảo:** Hữu ích khi bạn không tiện nói trực tiếp khi thuyết trình, không có micro tốt, hoặc muốn demo nhanh chóng các trường hợp lỗi/thành công mà không mất thời gian chờ đợi ghi âm.

Backend của dự án đã chuẩn bị sẵn 3 kịch bản mockup tương ứng với các hiển thị của giao diện giao tiếp:
1. **Test 1 (Thành công cả hai):** Bản ghi có đầy đủ audio phát lại, văn bản dịch và tóm tắt AI.
2. **Test 2 (Lỗi Dịch thuật - Transcription Error):** Bản ghi bị lỗi lúc chạy STT.
3. **Test 3 (Lỗi Tóm tắt - Summary Error):** Bản ghi dịch thành công nhưng lỗi lúc gọi AI Summarize.

### Các bước thực hiện sao chép nhanh mockup bằng PowerShell:
Chạy các dòng lệnh sau từ thư mục gốc của dự án để tự động sinh và nạp dữ liệu demo lập tức:
```powershell
# 1. Tạo thư mục recordings ở thư mục gốc (nếu chưa có)
New-Item -ItemType Directory -Force -Path recordings

# 2. Sinh dữ liệu mockup bằng cách chạy script test pipeline
cd backend
uv run python tests/test_pipeline_errors.py
cd ..

# 3. Sao chép các bản ghi test mockup vào thư mục recordings sử dụng wildcard (tự động khớp UUID ngẫu nhiên)
Copy-Item -Recurse -Path "backend\tests\fixtures\recordings_test_1_Success_both\*" -Destination "recordings\"
Copy-Item -Recurse -Path "backend\tests\fixtures\recordings_test_2_Transcription_Error\*" -Destination "recordings\"
Copy-Item -Recurse -Path "backend\tests\fixtures\recordings_test_3_Transcribe_Success_but_Summary_Error\*" -Destination "recordings\"
```

Bật Backend và Frontend lên. Trình diễn 3 trạng thái trên giao diện:
* **Click bản ghi Success (Test 1):** Cho hội đồng xem giao diện hoàn chỉnh nhất: có player nhạc, transcript segment có timestamp, AI Panel hiển thị tóm tắt cuộc họp đầy đủ, và tính năng tải file Markdown.
* **Click bản ghi Lỗi dịch (Test 2):** Giải thích cách hệ thống hiển thị thông báo lỗi trực quan và cung cấp nút **Retry Transcribe** để người dùng dịch lại thủ công mà không phải thu âm lại từ đầu.
* **Click bản ghi Lỗi tóm tắt (Test 3):** Chỉ ra rằng transcript đã được lưu trữ an toàn trên đĩa (người dùng vẫn đọc được văn bản), nhưng phần summary báo đỏ lỗi kèm nút **Retry Summarize** để thử lại khi có mạng hoặc key mới.

---

## 4. Bộ câu hỏi Phản biện & Trả lời (Q&A Defense)

Dưới đây là các câu hỏi mà hội đồng thẩm định hoặc khách hàng thường hỏi, kèm theo câu trả lời được tối ưu hóa theo thiết kế dự án:

### Q1: Tại sao lại chọn mô hình STT chạy Local (Zipformer) thay vì gọi API Cloud (như OpenAI Whisper, Google Speech API)?
* **Trả lời:**
  1. **Tính bảo mật & Riêng tư:** Các nội dung cuộc họp hoặc ghi âm cá nhân chứa nhiều dữ liệu nhạy cảm. Chạy local đảm bảo dữ liệu không bao giờ bị gửi ra ngoài internet.
  2. **Chi phí:** Zero cloud cost. Không mất phí dịch vụ hàng tháng cho bên thứ ba kể cả khi dịch hàng nghìn giờ âm thanh.
  3. **Khả năng Offline:** Ứng dụng hoạt động tốt ngay cả trong môi trường không có internet (ví dụ trên máy bay, phòng họp kín không wifi).

### Q2: Chạy STT local có làm đơ hay chậm máy tính của người dùng không?
* **Trả lời:** Không. Chúng tôi sử dụng phiên bản rút gọn `Zipformer-30M-int8` (INT8 quantization) cực kỳ nhẹ. Đồng thời, cấu hình Backend giới hạn tối đa 4 luồng CPU và chạy xử lý ngầm tuần tự (single-task queue) giúp bảo toàn tài nguyên CPU cho các ứng dụng khác của người dùng.

### Q3: Tại sao lại chọn lưu dữ liệu dạng file phẳng (flat-file) trong thư mục `recordings/{id}/` thay vì dùng Cơ sở dữ liệu (SQLite, PostgreSQL)?
* **Trả lời:** 
  1. **Tự đóng gói (Self-contained):** Mỗi bản ghi là một thư mục chứa đầy đủ `recording.wav`, `metadata.json`, `transcript.json` và `summary.json`. Người dùng có thể dễ dàng sao chép, di chuyển hoặc backup một bản ghi đơn lẻ bằng cách copy thư mục đó sang máy khác mà không cần export DB.
  2. **Đơn giản & Bền bỉ:** Giảm thiểu rủi ro lỗi corrupt cơ sở dữ liệu khi máy tính bị mất nguồn đột ngột trong lúc ghi âm. Cơ chế ghi file atomically đảm bảo file JSON ghi thành công 100% hoặc giữ nguyên bản cũ.
  3. *(Lưu ý: SQLite đã được đưa vào lộ trình phát triển tương lai khi số lượng bản ghi tăng lên hàng nghìn).*

### Q4: Cơ chế trộn Microphone và Loa hệ thống hoạt động như thế nào để đảm bảo không bị lệch pha?
* **Trả lời:** Hệ thống sử dụng thư viện `pyaudiowpatch` để lắng nghe thiết bị Loopback của Windows ở mức driver phần cứng (WASAPI). Khi bắt đầu ghi, backend khởi chạy hai luồng thu độc lập cùng tần số lấy mẫu (sample rate), sau đó sử dụng dịch vụ `AudioMixer` để căn chỉnh mốc thời gian (timestamp) của hai stream và trộn tuyến tính hai kênh thành file WAV Mono duy nhất.

### Q5: Tại sao mô hình phân biệt người nói (CAM++) có thể chạy local rất nhanh mà vẫn chính xác?
* **Trả lời:** Mô hình CAM++ (Alibaba 3D-Speaker) được tối ưu hóa dưới dạng ONNX để chạy trực tiếp trên CPU. Mô hình này rất nhỏ (~24MB) nhưng trích xuất đặc trưng giọng nói 192 chiều rất nhạy. Kết hợp với thuật toán K-Means++ và điểm số Silhouette tối ưu hóa bằng NumPy, hệ thống có thể tự động nhận dạng số lượng người nói từ 2 đến 4 mà không cần người dùng nhập tham số trước.

### Q6: Làm thế nào ứng dụng xử lý được các file ghi âm cuộc họp dài (như 30 phút hoặc 1 tiếng) mà không bị lỗi tràn bộ nhớ (Out of Memory)?
* **Trả lời:** Khi tính toán self-attention của Transformer trên file âm thanh quá dài, kích thước ma trận attention sẽ tăng theo hàm mũ lũy thừa bậc hai (bình phương chiều dài), dễ gây crash RAM trên Windows. Để khắc phục lỗi này, hệ thống áp dụng cơ chế **ASR Chunking**: tự động chia nhỏ file WAV dài thành các đoạn 50 giây để chạy nhận diện tuần tự trên Zipformer và CAM++, sau đó ghép nối mốc thời gian và văn bản lại một cách liền mạch. Mức tiêu thụ RAM tối đa luôn được kiểm soát dưới 600MB.
