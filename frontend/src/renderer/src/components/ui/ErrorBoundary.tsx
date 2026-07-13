import { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    error: null
  }

  public static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in ErrorBoundary:', error, errorInfo)
  }

  private handleReset = () => {
    this.setState({ error: null })
  }

  private handleReload = () => {
    if (window.electronAPI && typeof window.electronAPI.reloadApp === 'function') {
      window.electronAPI.reloadApp()
    } else {
      window.location.reload()
    }
  }

  private handleCopy = () => {
    if (!this.state.error) return
    const errorText = `${this.state.error.name}: ${this.state.error.message}\n\nStack Trace:\n${this.state.error.stack}`
    navigator.clipboard.writeText(errorText)
    alert('Đã sao chép chi tiết lỗi vào clipboard!')
  }

  public render() {
    if (this.state.error) {
      return (
        <div className="error-boundary-container">
          <div className="error-card animate-slide-up">
            <div className="error-icon">⚠️</div>
            <h1 className="error-title">Đã xảy ra lỗi hệ thống</h1>
            <p className="error-message">
              Ứng dụng gặp sự cố bất ngờ. Bạn có thể thử khôi phục lại trạng thái hoặc tải lại ứng
              dụng.
            </p>

            <div className="error-details-box">
              <pre className="error-stack">
                {this.state.error.stack || this.state.error.message}
              </pre>
            </div>

            <div className="error-actions">
              <button className="btn btn-reset" onClick={this.handleReset}>
                ↺ Thử lại
              </button>
              <button className="btn btn-reload" onClick={this.handleReload}>
                🔄 Tải lại ứng dụng (Reload)
              </button>
              <button className="btn btn-copy" onClick={this.handleCopy}>
                📋 Sao chép mã lỗi
              </button>
            </div>
          </div>

          <style>{`
            .error-boundary-container {
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              background-color: #0b0f19;
              padding: 24px;
              color: #f8fafc;
            }

            .error-card {
              max-width: 600px;
              width: 100%;
              background: rgba(15, 23, 42, 0.6);
              backdrop-filter: blur(20px);
              border: 1px solid rgba(239, 68, 68, 0.2);
              border-radius: 16px;
              padding: 32px;
              text-align: center;
              box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4);
            }

            .error-icon {
              font-size: 48px;
              margin-bottom: 16px;
            }

            .error-title {
              font-size: 20px;
              font-weight: 700;
              margin-bottom: 8px;
            }

            .error-message {
              font-size: 14px;
              color: #94a3b8;
              margin-bottom: 24px;
            }

            .error-details-box {
              background: rgba(0, 0, 0, 0.3);
              border: 1px solid rgba(255, 255, 255, 0.05);
              border-radius: 8px;
              padding: 16px;
              text-align: left;
              max-height: 200px;
              overflow-y: auto;
              margin-bottom: 24px;
            }

            .error-stack {
              font-family: monospace;
              font-size: 12px;
              color: #ef4444;
              white-space: pre-wrap;
            }

            .error-actions {
              display: flex;
              gap: 12px;
              justify-content: center;
              flex-wrap: wrap;
            }

            .btn {
              padding: 10px 18px;
              border-radius: 8px;
              font-size: 13px;
              font-weight: 600;
              cursor: pointer;
              border: none;
              transition: all 0.2s;
            }

            .btn-reset {
              background: #8b5cf6;
              color: white;
            }

            .btn-reset:hover {
              background: #7c3aed;
            }

            .btn-reload {
              background: rgba(255, 255, 255, 0.05);
              color: #f8fafc;
              border: 1px solid rgba(255, 255, 255, 0.1);
            }

            .btn-reload:hover {
              background: rgba(255, 255, 255, 0.1);
            }

            .btn-copy {
              background: transparent;
              color: #94a3b8;
            }

            .btn-copy:hover {
              color: white;
            }
          `}</style>
        </div>
      )
    }

    return this.props.children
  }
}
