import { ReactNode, createContext, useContext, useEffect, useRef, useState } from 'react'
import { Bath, Baby, Milk, Moon, Pill, Sun, X } from 'lucide-react'
import { EventType } from '../domain/types'
import { MIN, fromLocalInput, hhmm, toLocalInput } from '../domain/time'

/** Relógio que atualiza a tela a cada `ms`. */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(id)
  }, [ms])
  return now
}

const Diaper = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18v3a9 9 0 0 1-18 0V6z" />
    <path d="M8 6v2a4 4 0 0 0 8 0V6" />
  </svg>
)

export function TypeIcon({ type, size = 22 }: { type: EventType | 'wake'; size?: number }) {
  switch (type) {
    case 'sleep': return <Moon size={size} />
    case 'wake': return <Sun size={size} />
    case 'feeding': return <Milk size={size} />
    case 'diaper': return <Diaper size={size} />
    case 'tummy': return <Baby size={size} />
    case 'bath': return <Bath size={size} />
    case 'medication': return <Pill size={size} />
  }
}

export function Sheet({ title, onClose, children, icon }: { title: string; onClose: () => void; children: ReactNode; icon?: ReactNode }) {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])
  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-label={title}>
        <div className="grab" />
        <div className="top">
          {icon}
          <h3>{title}</h3>
          <button className="x" onClick={onClose} aria-label="Fechar"><X size={20} /></button>
        </div>
        {children}
      </div>
    </>
  )
}

/** Seletor de horário: Agora · −5 · −15 · −30 · Outro. `null` = agora (resolvido ao salvar). */
export function TimeChips({ value, onChange, label = 'Quando' }: { value: number | null; onChange: (ts: number | null) => void; label?: string }) {
  const [sel, setSel] = useState<number | 'custom'>(value == null ? 0 : 'custom')
  return (
    <div>
      <div className="label">{label}</div>
      <div className="chips">
        {[0, 5, 15, 30].map((m) => (
          <button key={m} className={`chip ${sel === m ? 'on' : ''}`} onClick={() => { setSel(m); onChange(m === 0 ? null : Date.now() - m * MIN) }}>
            {m === 0 ? 'Agora' : `−${m} min`}
          </button>
        ))}
        <button className={`chip ${sel === 'custom' ? 'on' : ''}`} onClick={() => { setSel('custom'); onChange(value ?? Date.now()) }}>
          {sel === 'custom' && value ? hhmm(value) : 'Outro…'}
        </button>
      </div>
      {sel === 'custom' && (
        <input style={{ marginTop: 10 }} type="datetime-local" value={toLocalInput(value ?? Date.now())}
          onChange={(e) => e.target.value && onChange(fromLocalInput(e.target.value))} />
      )}
    </div>
  )
}

// ── Toast com "Desfazer" ──────────────────────────────────────
interface ToastMsg { text: string; undo?: () => void; id: number }
const ToastCtx = createContext<(text: string, undo?: () => void) => void>(() => {})
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<ToastMsg | null>(null)
  const timer = useRef<number>()
  const show = (text: string, undo?: () => void) => {
    window.clearTimeout(timer.current)
    setMsg({ text, undo, id: Date.now() })
    timer.current = window.setTimeout(() => setMsg(null), 5000)
    try { navigator.vibrate?.(15) } catch { /* sem vibração */ }
  }
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {msg && (
        <div className="toast" key={msg.id}>
          <span className="grow">{msg.text}</span>
          {msg.undo && <button onClick={() => { msg.undo!(); setMsg(null) }}>Desfazer</button>}
        </div>
      )}
    </ToastCtx.Provider>
  )
}

/** Reduz a foto para caber no repositório (~40 KB). */
export function resizePhoto(file: File, max = 360): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * s)
      c.height = Math.round(img.height * s)
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(img.src)
      resolve(c.toDataURL('image/jpeg', 0.8))
    }
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}
