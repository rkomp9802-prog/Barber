import { useEffect } from 'react'

import { DevBanner } from '../components/DevBanner'
import { HeroVideo } from '../components/HeroVideo'
import { Icon } from '../components/Icon'
import { getTelegramFirstName, setChromeColor } from '../telegram'

/** Шапка Telegram над видео — чёрная, в тон затемнению. */
const VIDEO_CHROME = '#000000'

type Props = {
  onBook: () => void
  onMyBookings: () => void
}

/**
 * Главная: видео барбершопа на весь экран, затемнение снизу, белый текст.
 * Главное действие — белая «пилюля» «Записаться»; «Мои записи» — стеклянная панель поверх видео.
 */
export function HomeScreen({ onBook, onMyBookings }: Props) {
  const name = getTelegramFirstName()
  useEffect(() => {
    setChromeColor(VIDEO_CHROME)
    return () => setChromeColor(null)
  }, [])
  return (
    <div className="home-full">
      <HeroVideo className="home-full-video" />
      <div className="home-full-shade" aria-hidden="true" />
      <DevBanner />
      <main className="home-full-content">
        <p className="eyebrow">{name ? 'Барбершоп · Ташкент' : 'Ташкент'}</p>
        <h1 className="large-title">{name ? `Здравствуйте, ${name}` : 'Барбершоп'}</h1>
        <p className="lead">Стрижки и бритьё. Запись — за минуту.</p>
        <button type="button" className="hero-cta" onClick={onBook}>
          <Icon name="scissors" size={20} />
          Записаться
        </button>
        <button type="button" className="glass-row" onClick={onMyBookings}>
          <Icon name="calendar" />
          <span className="nav-row-text">
            <span className="nav-row-title">Мои записи</span>
            <span className="glass-row-subtitle">Посмотреть, перенести или отменить</span>
          </span>
          <Icon name="chevronRight" size={18} className="glass-row-chevron" />
        </button>
      </main>
    </div>
  )
}
