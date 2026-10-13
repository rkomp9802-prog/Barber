import { DevBanner } from '../components/DevBanner'
import { getTelegramFirstName } from '../telegram'

type Props = {
  onBook: () => void
  onMyBookings: () => void
}

export function HomeScreen({ onBook, onMyBookings }: Props) {
  const name = getTelegramFirstName()
  const greeting = name ? `Здравствуйте, ${name}!` : 'Барбершоп'
  return (
    <div className="screen">
      <DevBanner />
      <header className="home-header">
        <div className="home-logo" aria-hidden="true">
          ✂
        </div>
        <h1 className="screen-title">{greeting}</h1>
        <p className="muted">Стрижки и бритьё в Ташкенте. Запись за минуту.</p>
      </header>
      <main className="home-actions">
        <button type="button" className="home-action home-action-primary" onClick={onBook}>
          <span className="home-action-title">Записаться</span>
          <span className="home-action-text">Услуга, барбер и удобное время</span>
        </button>
        <button type="button" className="home-action" onClick={onMyBookings}>
          <span className="home-action-title">Мои записи</span>
          <span className="home-action-text">Посмотреть, перенести или отменить</span>
        </button>
      </main>
    </div>
  )
}
