import type { StatusTone } from '@/lib/admin/labels'

import styles from './bookings.module.css'

// CSS-модули типизируются с undefined для неизвестных ключей, поэтому фолбэк пустой строкой.
const TONE_CLASS: Readonly<Record<StatusTone, string>> = {
  accent: styles.toneAccent ?? '',
  success: styles.toneSuccess ?? '',
  danger: styles.toneDanger ?? '',
  muted: styles.toneMuted ?? '',
}

type Props = {
  label: string
  tone: StatusTone
}

export function BookingStatusBadge({ label, tone }: Props) {
  return <span className={`${styles.badge} ${TONE_CLASS[tone]}`}>{label}</span>
}
