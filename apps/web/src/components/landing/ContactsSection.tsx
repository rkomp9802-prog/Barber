import Link from 'next/link'

import { shop } from '@/data/shop'

import styles from './landing.module.css'

/** Половина стороны области карты в градусах (~1 км вокруг барбершопа). */
const MAP_SPAN = 0.008

function mapEmbedUrl(): string {
  const { lat, lon } = shop.map
  const bbox = [lon - MAP_SPAN, lat - MAP_SPAN / 2, lon + MAP_SPAN, lat + MAP_SPAN / 2]
    .map(value => value.toFixed(4))
    .join(',')
  const params = new URLSearchParams({ bbox, layer: 'mapnik', marker: `${lat},${lon}` })
  return `https://www.openstreetmap.org/export/embed.html?${params.toString()}`
}

function ContactLinks() {
  const external = { target: '_blank', rel: 'noopener noreferrer' } as const

  return (
    <ul className={styles.contactLinks}>
      <li>
        <span className={styles.contactLabel}>Телефон</span>
        <a href={shop.phoneHref}>{shop.phone}</a>
      </li>
      <li>
        <span className={styles.contactLabel}>Telegram</span>
        <a href={shop.telegramHref} {...external}>
          {shop.telegram}
        </a>
      </li>
      <li>
        <span className={styles.contactLabel}>Instagram</span>
        <a href={shop.instagramHref} {...external}>
          {shop.instagram}
        </a>
      </li>
    </ul>
  )
}

export function ContactsSection() {
  return (
    <section id="contacts" className="section" aria-labelledby="contacts-title">
      <div className={`container ${styles.contactsGrid}`}>
        <div className={styles.contactsInfo}>
          <div className="section-head">
            <p className="eyebrow">Контакты</p>
            <h2 id="contacts-title" className="section-title">
              Ждём в центре Ташкента
            </h2>
          </div>
          <address className={styles.address}>
            <span className={styles.addressMain}>{shop.address}</span>
            <span className="muted">{shop.landmark}</span>
          </address>
          <dl className={styles.hours}>
            {shop.hours.map(item => (
              <div key={item.days} className={styles.hoursRow}>
                <dt>{item.days}</dt>
                <dd>{item.time}</dd>
              </div>
            ))}
          </dl>
          <ContactLinks />
          <div className={styles.finalCta}>
            <p className={styles.finalCtaText}>Свободные окна есть уже сегодня.</p>
            <Link href="/book" className="btn btn-primary btn-lg">
              Записаться онлайн
            </Link>
          </div>
        </div>
        <div className={styles.mapFrame}>
          <iframe
            className={styles.map}
            src={mapEmbedUrl()}
            title={`Карта: ${shop.fullName}, ${shop.address}`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </div>
    </section>
  )
}
