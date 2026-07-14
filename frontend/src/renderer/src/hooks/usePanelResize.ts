import { useState, useCallback, useEffect } from 'react'

export function usePanelResize(
  panelId: 'sidebar' | 'aipanel',
  defaultWidth: number,
  minWidth: number,
  maxWidth: number
) {
  const [width, setWidth] = useState(() => {
    const saved = localStorage.getItem(`panel_width_${panelId}`)
    return saved ? parseInt(saved, 10) : defaultWidth
  })

  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => {
    localStorage.setItem(`panel_width_${panelId}`, width.toString())
  }, [width, panelId])

  const startDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      let newWidth = defaultWidth
      let maxAllowed = maxWidth
      if (panelId === 'aipanel') {
        const sidebar = document.querySelector('.sidebar') as HTMLElement
        const sidebarW = sidebar ? sidebar.offsetWidth : 200
        newWidth = document.body.clientWidth - e.clientX
        maxAllowed = Math.min(maxWidth, document.body.clientWidth - sidebarW - 300)
      } else {
        newWidth = e.clientX
        // For sidebar, we limit its width based on whether the AI panel is open
        const aipanel = document.querySelector('.ai-panel') as HTMLElement
        const aiW = aipanel ? aipanel.offsetWidth : 0
        maxAllowed = Math.min(maxWidth, document.body.clientWidth - aiW - 300)
      }

      if (newWidth < minWidth) newWidth = minWidth
      if (newWidth > maxAllowed) newWidth = Math.max(minWidth, maxAllowed)

      setWidth(newWidth)
    }

    const handleMouseUp = () => setIsDragging(false)

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    // Add overlay class to prevent text selection and cursor flickering
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isDragging, panelId, minWidth, maxWidth, defaultWidth])

  return { width, startDrag, isDragging }
}
