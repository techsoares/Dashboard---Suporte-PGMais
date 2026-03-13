import { useState, useRef, useEffect } from 'react'
import './FilterDropdown.css'

export default function FilterDropdown({ label, options, selected, onToggle, onClear }) {
  const [open, setOpen] = useState(false)
  const ref = useRef()

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
      if (e.key === 'Escape' && open) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', handler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', handler)
    }
  }, [open])

  const hasSelection = selected.length > 0

  return (
    <div className="fd-wrapper" ref={ref}>
      <button
        className={`fd-trigger ${hasSelection ? 'fd-trigger--active' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-label={`Filtrar por ${label}${hasSelection ? ` (${selected.length} selecionado${selected.length !== 1 ? 's' : ''})` : ''}`}
        aria-expanded={open}
      >
        <span className="fd-label">{label}</span>
        {hasSelection && <span className="fd-count">{selected.length}</span>}
        <span className="fd-arrow">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="fd-dropdown">
          {hasSelection && (
            <button className="fd-clear-btn" onClick={() => { onClear(); }}>
              ✕ Limpar {label}
            </button>
          )}
          <div className="fd-options">
            {options.map(opt => (
              <label key={opt} className={`fd-option ${selected.includes(opt) ? 'fd-option--checked' : ''}`}>
                <input
                  type="checkbox"
                  checked={selected.includes(opt)}
                  onChange={() => onToggle(opt)}
                />
                <span className="fd-option-label">{opt}</span>
                {selected.includes(opt) && <span className="fd-check">✓</span>}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
