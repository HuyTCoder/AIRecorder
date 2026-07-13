import { useEffect, useRef, useState } from 'react'
import './CustomSelect.css'

interface Option {
  value: string
  label: string
}

export interface CustomSelectChangeEvent {
  target: { name: string; value: string }
}

interface CustomSelectProps {
  id?: string
  name?: string
  value: string
  options: Option[]
  onChange: (event: CustomSelectChangeEvent) => void
}

export function CustomSelect({ id, name, value, options, onChange }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedOption = options.find((option) => option.value === value) || options[0]

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  const handleOptionClick = (optionValue: string) => {
    onChange({ target: { name: name || '', value: optionValue } })
    setIsOpen(false)
  }

  return (
    <div className="custom-select-container" ref={containerRef}>
      <div
        className={`custom-select-trigger ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        id={id}
      >
        <span>{selectedOption?.label}</span>
        <svg
          className="custom-select-icon"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M6 9L12 15L18 9"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      {isOpen && (
        <ul className="custom-select-dropdown">
          {options.map((option) => (
            <li
              key={option.value}
              className={`custom-select-option ${option.value === value ? 'selected' : ''}`}
              onClick={() => handleOptionClick(option.value)}
            >
              {option.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
