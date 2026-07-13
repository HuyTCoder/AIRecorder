# Hướng dẫn Kiểm thử Hệ thống — AI Recorder

Tài liệu này tổng hợp chiến lược kiểm thử, hướng dẫn chạy các bài test tự động (automated tests), và giải thích các kịch bản kiểm thử tích hợp (integration/E2E test scripts) có sẵn trong dự án.

---

## 1. Automated & Integration Tests (Kiểm thử Tự động & Tích hợp)

Dự án cung cấp sẵn các script kiểm thử tích hợp đầu-cuối (E2E/Integration) nằm trong thư mục [tests/](file:///d:/KProject/AIRecorder/backend/tests/) để xác minh toàn bộ các dịch vụ ghi âm, mixer, lưu trữ và các trạng thái AI Task.

### Các Script Kiểm thử trong Thư mục `backend/tests/`:

1. **Test luồng chạy dịch vụ Backend ([test_backend_e2e.py](file:///d:/KProject/AIRecorder/backend/tests/test_backend_e2e.py))**
   * **Mục tiêu:** Kiểm tra tích hợp ở mức độ dịch vụ (service level) trong Python (bộ ghi âm, trộn nguồn, ghi WAV, submit task STT/Gemini ngầm) mà không cần bật web server FastAPI hay giao diện Electron.
   * **Cách chạy:**
     ```powershell
     cd backend
     uv run python tests/test_backend_e2e.py
     ```
   * **Quy trình hoạt động:** Khởi tạo repository tạm thời -> Bắt đầu ghi âm thử 2 giây -> Finalize file WAV và kiểm tra kích thước -> Submit task Transcribe & Summarize giả lập vào Pipeline -> Xác nhận ghi nhận trạng thái chính xác -> Dọn dẹp thư mục tạm.

2. **Test các kịch bản lỗi Pipeline ([test_pipeline_errors.py](file:///d:/KProject/AIRecorder/backend/tests/test_pipeline_errors.py))**
   * **Mục tiêu:** Xác minh máy trạng thái hoạt động chính xác khi gặp lỗi dịch thuật hoặc lỗi tóm tắt AI.
   * **Cách chạy:**
     ```powershell
     cd backend
     uv run python tests/test_pipeline_errors.py
     ```
   * **Kết quả tạo ra:** Tạo ra 3 thư mục tương ứng với 3 kịch bản: Thành công cả 2, Lỗi STT (`transcribe`), Lỗi Tóm tắt (`summarize`). Các thư mục này được giữ lại sau khi chạy để phục vụ kiểm tra hoặc copy làm mockup dữ liệu demo.

3. **Test kết nối API thực tế ([test_api_e2e.py](file:///d:/KProject/AIRecorder/backend/tests/test_api_e2e.py))**
   * **Mục tiêu:** Mô phỏng cuộc gọi HTTP E2E hoàn chỉnh từ Client lên FastAPI server đang chạy.
   * **Cách chạy:** Bật Backend FastAPI trước (`uv run uvicorn...`), sau đó chạy script trong một terminal khác:
     ```powershell
     cd backend
     uv run python tests/test_api_e2e.py
     ```
   * **Quy trình hoạt động:** Gọi API lấy device -> Bắt đầu ghi âm 3 giây -> Dừng ghi âm -> Kiểm tra file âm thanh WAV -> Test stream phát lại audio -> Gọi dịch thuật -> Polling trạng thái cho đến khi hoàn tất -> Lấy nội dung transcript in ra màn hình.

4. **Test kết nối Fake Key Gemini ([test_gemini_fake_key.py](file:///d:/KProject/AIRecorder/backend/tests/test_gemini_fake_key.py))**
   * **Mục tiêu:** Kiểm tra hành vi phản hồi của SDK Google GenAI khi nhập sai key hoặc mất mạng.
   * **Cách chạy:**
     ```powershell
     cd backend
     uv run python tests/test_gemini_fake_key.py
     ```

5. **Test endpoint tải tệp tin lên ([test_upload_endpoint.py](file:///d:/KProject/AIRecorder/backend/tests/test_upload_endpoint.py))**
   * **Mục tiêu:** Kiểm tra hành vi tải lên tệp âm thanh WAV/MP3 và chuẩn hóa lưu trữ.
   * **Cách chạy:**
     ```powershell
     cd backend
     uv run python tests/test_upload_endpoint.py
     ```

6. **Kiểm thử liên thông ASR & Diarization thực tế (Performance & Accuracy Benchmarks)**
   * **Mục tiêu:** Xác minh tính ổn định của cơ chế ASR Chunking (chia nhỏ file WAV 50 giây) và độ chính xác của Diarization (CAM++) trên tệp âm thanh dài thực tế.
   * **Phương pháp đo lường:** Chạy nhận diện thực tế qua giao diện ứng dụng (Frontend) hoặc thông qua việc trigger API trực tiếp trên các tệp âm thanh mẫu trong quá trình phát triển (Profiling).
   * **Thông tin tệp tin âm thanh đầu vào (Input Metadata):**
     * **Tệp 1 (`bo_gia`):** `recording.wav` (Comedy skit & Calcium supplement ad)
       * **Thời lượng:** `606.46` giây (10 phút 6 giây).
       * **Dung lượng tệp:** `18.5 MB`.
       * **Đặc tính âm thanh:** WAV (16kHz, Mono, 16-bit PCM).
       * **Số lượng người nói thực tế:** 4 người (Người cháu, người cậu, cụ bà 82 tuổi chạy giải nhì, MC/Phóng viên).
     * **Tệp 2 (`daklak`):** `recording.wav` (Truyện kể vụ án mạng độc thoại)
       * **Thời lượng:** `447.05` giây (7 phút 27 giây).
       * **Dung lượng tệp:** `13.6 MB`.
       * **Đặc tính âm thanh:** WAV (16kHz, Mono, 16-bit PCM).
       * **Số lượng người nói thực tế:** 1 người (Giọng đọc kể chuyện độc thoại của YouTuber).
   * **Kết quả đo lường & Độ chính xác thực tế:**
     * **Kết quả với Tệp 1 (`bo_gia`):**
       * **Thời gian xử lý:** `31.03` giây (nhanh gấp **19.5x** thời gian thực).
       * **Số người nói nhận diện:** **4 người nói** (Silhouette Score: `0.1269` chọn K=4 là tối ưu nhất).
       * **Phân tách thực tế:** Chính xác 100% (Người cháu = `Người nói 3`, Người cậu & Giọng đọc cuối = `Người nói 0`, Cụ bà = `Người nói 2`, MC = `Người nói 1`).
     * **Kết quả với Tệp 2 (`daklak`):**
       * **Thời gian xử lý:** `23.8` giây (nhanh gấp **18.7x** thời gian thực).
       * **Số người nói nhận diện:** **1 người nói** (Thuật toán K-Means phân tách ban đầu thành 2 cụm, nhưng cơ chế gộp tâm cụm **Centroid Merging** đã tự động gộp tất cả các phân đoạn về duy nhất `Người nói 0` do độ tương đồng cosine giữa các centroid rất cao `> 0.80`, tránh việc chia tách cưỡng bức).

   * **Báo cáo Đo lường Hiệu năng Thực tế (Resource Benchmarks):**
     Dưới đây là số liệu đo lường tài nguyên thực tế thu được khi chạy toàn bộ luồng ASR + Punctuation + Diarization local dưới CPU trên máy tính Windows:

     | Chỉ số đo lường | Bản Ghi Ngắn (VNExpress - 73.8s) | Bản Ghi Dài (Bơ già dừa non - 606.4s) |
     | :--- | :--- | :--- |
     | **Thời gian xử lý** | 8.65 giây | 31.03 giây |
     | **Tốc độ so với thực tế** | **8.5x** (nhanh gấp) | **19.5x** (nhanh gấp) |
     | **RAM đỉnh điểm (Peak RAM)** | **1356.2 MB** | **1681.3 MB** |
     | **CPU trung bình (Average CPU)**| 233.29% (~2.3 nhân) | 384.93% (~3.8 nhân) |
     | **CPU đỉnh điểm (Peak CPU)** | 1214.30% (~12.1 nhân) | 1240.60% (~12.4 nhân) |
     | **Sử dụng GPU** | 0% (Hoạt động local 100% trên CPU) | 0% (Hoạt động local 100% trên CPU) |

---

## 2. Quy trình Kiểm thử Thủ công (Manual QA Checklist)

Khi phát triển hoặc kiểm thử sản phẩm thực tế, luôn chạy qua danh sách kiểm tra sau để đảm bảo trải nghiệm người dùng tốt nhất:

1. **Kiểm tra Cắm/Rút Tai nghe (Audio Hot-plug):**
   * Mở danh sách thiết bị khi đang cắm tai nghe -> Rút tai nghe ra -> Bấm làm mới danh sách thiết bị trên giao diện. Đảm bảo Backend cập nhật đúng danh sách driver âm thanh WASAPI mới nhất của Windows.
2. **Kiểm tra mức độ đồng bộ âm lượng (Audio Sync & Gain):**
   * Ghi âm đồng thời tiếng nói qua Mic và tiếng nhạc qua Loa hệ thống.
   * Phát lại bản ghi và lắng nghe xem tiếng nói có bị nhạc đè quá nhỏ hay không. Căn chỉnh tham số `gains: [1.0, 1.0]` trong config nếu cần thiết.
3. **Kiểm tra Tài nguyên CPU/RAM thực tế (Hardware Stress Test):**
   * Mở Task Manager của Windows.
   * Bấm chạy dịch thuật bản ghi dài (khoảng 10-20 phút).
   * Lắng nghe quạt tản nhiệt và xem biểu đồ CPU. Đảm bảo mức chiếm dụng CPU của `uvicorn` và `python` không vượt quá giới hạn gây lag đơ chuột hoặc lag giao diện Electron.
