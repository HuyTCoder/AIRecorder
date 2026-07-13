# Frontend — AI Recorder

Giao diện người dùng Electron + Vite + React của ứng dụng AI Recorder. Giao tiếp với FastAPI backend thông qua HTTP Localhost để điều khiển luồng ghi âm và trigger các tác vụ AI ngầm.

---

## 🚀 Hướng dẫn Chạy Local

### 1. Khởi động môi trường & cài đặt thư viện
Đảm bảo bạn đã cài đặt Node.js (khuyến nghị bản LTS mới nhất).
```powershell
cd frontend
npm install
```

### 2. Chạy ứng dụng chế độ Development
```powershell
npm run dev
```
*Lưu ý: Backend FastAPI cần được khởi chạy trước tại địa chỉ `http://localhost:8000`.*

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
