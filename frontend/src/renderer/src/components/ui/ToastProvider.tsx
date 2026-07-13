import { createContext, useContext, useState, ReactNode } from 'react'
import { TOAST_DURATION_MS } from '../../constants'

const ToastContext = createContext<(message: string) => void>(() => {})

interface ToastItem {
  id: string
  message: string
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const toast = (message: string) => {
    const id = Math.random().toString(36).substring(2, 9)
    setToasts((prev) => [...prev, { id, message }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, TOAST_DURATION_MS)
  }

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className="toast animate-slide-up">
            <span className="toast-icon">✨</span>
            <span className="toast-message">{t.message}</span>
          </div>
        ))}
      </div>

      <style>{`
        .toast-container {
          position: fixed;
          bottom: 24px;
          right: 24px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          z-index: 9999;
          pointer-events: none;
        }

        .toast {
          background: rgba(15, 23, 42, 0.85);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(139, 92, 246, 0.3);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25), 0 0 15px rgba(139, 92, 246, 0.1);
          color: #f8fafc;
          padding: 12px 20px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 13px;
          font-weight: 500;
          pointer-events: auto;
        }

        .toast-icon {
          font-size: 14px;
        }
      `}</style>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
