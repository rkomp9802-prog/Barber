import type { ReactNode } from 'react'

import { Icon } from './Icon'

type Props = {
  selected: boolean
  onSelect: () => void
  title: ReactNode
  subtitle?: ReactNode
  meta?: ReactNode
  leading?: ReactNode
  /** checkbox — множественный выбор, radio — один вариант. */
  kind: 'checkbox' | 'radio'
}

/** Строка единой панели (iOS): checkbox — кружок с галочкой, radio — галочка справа у выбранного. */
export function ChoiceRow({ selected, onSelect, title, subtitle, meta, leading, kind }: Props) {
  return (
    <button
      type="button"
      role={kind}
      aria-checked={selected}
      className={`choice-row${selected ? ' is-selected' : ''}`}
      onClick={onSelect}
    >
      {leading}
      <span className="choice-text">
        <span className="choice-title">{title}</span>
        {subtitle && <span className="choice-subtitle">{subtitle}</span>}
      </span>
      {meta && <span className="choice-meta">{meta}</span>}
      <span className={`choice-mark choice-mark-${kind}`} aria-hidden="true">
        <Icon name="check" size={kind === 'checkbox' ? 14 : 20} strokeWidth={kind === 'checkbox' ? 3 : 2.25} />
      </span>
    </button>
  )
}
