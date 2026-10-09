import { useId, useState } from 'react'
import { fmtNum } from '../lib/format'

interface Props {
  label?: string
  value: number
  onCommit: (v: number) => void
  min?: number
  max?: number
  digits?: number
  suffix?: string
  className?: string
  ariaLabel?: string
}

const parse = (s: string): number => (s.trim() === '' ? NaN : Number(s.trim().replace(',', '.').replace('−', '-')))
const show = (v: number, digits: number) => fmtNum(v, digits).replace('−', '-')

/** Text-backed number input: keeps what you type, commits valid in-range values, follows outside changes. */
export default function NumberField({ label, value, onCommit, min = -Infinity, max = Infinity, digits = 5, suffix, className, ariaLabel }: Props) {
  const id = useId()
  const [text, setText] = useState(() => show(value, digits))
  const [prev, setPrev] = useState(value)
  if (value !== prev) {
    setPrev(value)
    if (parse(text) !== value) setText(show(value, digits))
  }
  const n = parse(text)
  const bad = Number.isNaN(n) || n < min || n > max
  return (
    <div className={`field ${className ?? ''}`}>
      {label && <label htmlFor={id}>{label}</label>}
      <div className="with-suffix">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          aria-label={label ? undefined : ariaLabel}
          aria-invalid={bad}
          className={bad ? 'bad' : ''}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            const v = parse(e.target.value)
            if (!Number.isNaN(v) && v >= min && v <= max) onCommit(v)
          }}
          onBlur={() => setText(show(value, digits))}
        />
        {suffix && <span className="suffix">{suffix}</span>}
      </div>
    </div>
  )
}
