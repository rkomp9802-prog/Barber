import { DevBanner } from '../components/DevBanner'
import { Icon } from '../components/Icon'
import { getTelegramFirstName } from '../telegram'

type Props = {
  onBook: () => void
  onMyBookings: () => void
}

/** Главная: одно цветное место — карточка «Записаться», остальное — серая шкала на белой панели. */
export function HomeScreen({ onBook, onMyBookings }: Props) {
  const name = getTelegramFirstName()
  return (
    <div className="screen">
      <DevBanner />
      <header className="home-header">
        <p className="eyebrow">{name ? 'Барбершоп · Ташкент' : 'Ташкент'}</p>
        <h1 className="large-title">{name ? `Здравствуйте, ${name}` : 'Барбершоп'}</h1>
        <p className="lead">Стрижки и бритьё. Запись — за минуту.</p>
      </header>
      <main className="home-body">
        <button type="button" className="hero-card" onClick={onBook}>
          <span className="hero-icon">
            <Icon name="scissors" size={26} />
          </span>
          <span className="hero-text">
            <span className="hero-title">Записаться</span>
            <span className="hero-subtitle">Услуга, барбер и удобное время</span>
          </span>
          <Icon name="chevronRight" className="hero-chevron" />
        </button>
        <div className="panel">
          <button type="button" className="nav-row" onClick={onMyBookings}>
            <Icon name="calendar" className="nav-row-icon" />
            <span className="nav-row-text">
              <span className="nav-row-title">Мои записи</span>
              <span className="nav-row-subtitle">Посмотреть, перенести или отменить</span>
            </span>
            <Icon name="chevronRight" size={18} className="nav-row-chevron" />
          </button>
        </div>
      </main>
    </div>
  )
}
