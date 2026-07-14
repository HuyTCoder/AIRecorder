# Frontend — AI Recorder 💻🎨

Giao diện người dùng Desktop App được xây dựng bằng công nghệ **Electron + Vite + React (TypeScript)** cho ứng dụng AI Recorder. 

Ứng dụng kết nối trực tiếp đến FastAPI Backend chạy cục bộ để thực hiện việc thu âm, chuẩn hóa âm thanh, hiển thị văn bản nhận diện và hỗ trợ gửi yêu cầu tóm tắt cuộc họp qua các dịch vụ AI.

---

## ⚙️ Cấu hình API Endpoint

Địa chỉ kết nối đến Backend được khai báo trong các file cấu hình môi trường:
* **Môi trường Development:** [.env.development](file:///d:/KProject/AIRecorder/frontend/.env.development) (`VITE_API_BASE_URL=http://localhost:8000/api/v1`)
* **Môi trường Production:** `.env.production`

---

## 🚀 Hướng dẫn Chạy Local

### 1. Cài đặt các thư viện phụ thuộc
Đảm bảo bạn đã cài đặt Node.js trên máy (khuyến nghị bản LTS mới nhất).
```powershell
# Di chuyển vào thư mục frontend và cài đặt thư viện
cd frontend
npm install
```

### 2. Khởi chạy ở chế độ Phát triển (Development)
Lệnh khởi chạy sẽ biên dịch mã nguồn và tự động mở cửa sổ ứng dụng desktop Electron:
```powershell
npm run dev
```
*Lưu ý: Bạn nên khởi chạy dịch vụ FastAPI Backend trước tại địa chỉ `http://localhost:8000` để ứng dụng có thể kết xuất danh sách thiết bị và bản ghi thành công.*

---

## 🧪 Kiểm tra Chất lượng & Chạy Test

Để chạy linter, kiểm tra kiểu tĩnh (TypeScript) và chạy bộ unit tests giao diện:
```powershell
# Kiểm tra code style (ESLint)
npm run lint

# Kiểm tra kiểu TypeScript
npm run typecheck

# Chạy unit tests bằng Vitest
npm run test

# Đóng gói bản phân phối (Build Electron App)
npm run build
```

---

## 📁 Cấu trúc Thư mục

```text
frontend/src/
├── main/                 # Electron main process (quản lý cửa sổ, IPC logs)
├── preload/              # File preload.js cầu nối contextBridge APIs bảo mật
└── renderer/src/
    ├── api/              # Trình gọi fetch client và định nghĩa endpoint wrapper
    ├── components/       # Các UI Component React (Player, Sidebar, Transcript, Modals)
    ├── hooks/            # Các custom hooks (điều khiển ghi âm, phát audio, panel resize)
    ├── store/            # Quản lý trạng thái UI qua React Context & Reducer
    ├── types/            # Khai báo TypeScript types tương thích API Backend
    └── utils/            # Hỗ trợ định dạng thời gian, xuất Markdown báo cáo
```

---

## 📚 Tài liệu Liên quan

Các đặc tả thiết kế và hướng dẫn kiểm thử được lưu trữ tập trung tại thư mục `docs/`:
* **[Kiến trúc Hệ thống](file:///d:/KProject/AIRecorder/docs/architecture.md)** — Sơ đồ runtime, layout file và máy trạng thái.
* **[Đặc tả Tính năng Toàn diện](file:///d:/KProject/AIRecorder/docs/features.md)** — Chi tiết cơ chế trộn nguồn âm, STT local, NFR và xử lý lỗi.
* **[REST API Specification](file:///d:/KProject/AIRecorder/docs/api.md)** — Mô tả các endpoint, request/response payload.
* **[Hướng dẫn Chạy Demo](file:///d:/KProject/AIRecorder/docs/demo_guide.md)** — Kịch bản live demo và chạy mockup phục vụ trình bày.
* **[Hướng dẫn Kiểm thử](file:///d:/KProject/AIRecorder/docs/testing.md)** — Unit tests và các script test E2E.
