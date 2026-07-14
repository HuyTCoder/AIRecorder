import logo from '../../assets/logo.png'
import './TitleBar.css'

export function TitleBar() {
  const handleMinimize = () => window.electronAPI.minimize()
  const handleMaximize = () => window.electronAPI.maximize()
  const handleClose = () => window.electronAPI.close()

  return (
    <div className="titlebar">
      <div className="titlebar-drag">
        <img src={logo} className="titlebar-logo-img" alt="Logo" />
        <span className="titlebar-title">Voice Note AI Recorder</span>
      </div>
      <div className="titlebar-controls">
        <button className="control-btn minimize" onClick={handleMinimize} title="Thu nhỏ">
          ─
        </button>
        <button className="control-btn maximize" onClick={handleMaximize} title="Phóng to">
          ⬜
        </button>
        <button className="control-btn close" onClick={handleClose} title="Đóng">
          ✕
        </button>
      </div>
    </div>
  )
}
