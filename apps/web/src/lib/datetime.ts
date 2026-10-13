import { TIMEZONE, type SlotTime } from '@barber/shared'

/** Узбекистан живёт в UTC+5 без перехода на летнее время. */
const TASHKENT_OFFSET = '+05:00'

const timeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/** Время «HH:MM» по Ташкенту. */
export function tashkentTime(date: Date): SlotTime {
  return timeFormatter.format(date)
}

/** «2026-10-12» + «11:00» по Ташкенту → ISO в UTC: «2026-10-12T06:00:00.000Z». */
export function tashkentToIso(dateKey: string, time: SlotTime): string {
  return new Date(`${dateKey}T${time}:00${TASHKENT_OFFSET}`).toISOString()
}
