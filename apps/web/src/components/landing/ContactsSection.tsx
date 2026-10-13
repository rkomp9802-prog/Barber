import Image from 'next/image'
import Link from 'next/link'

import { shop } from '@/data/shop'

import styles from './Contacts.module.css'

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
    <section id="contacts" className={styles.section} aria-labelledby="contacts-title">
      <Image
        src="/stock/contacts-bg.webp"
        alt=""
        fill
        sizes="100vw"
        className={styles.bg}
      />
      <div className={styles.shade} aria-hidden="true" />
      <div className="container">
        <div className={styles.grid}>
          <div className={`${styles.info} reveal`}>
            <div>
              <p className="l-kicker">Контакты</p>
              <h2 id="contacts-title" className="l-title">
                Ждём в центре Ташкента
              </h2>
            </div>
            <address className={styles.address}>
              <span className={styles.addressMain}>{shop.address}</span>
              <span className={styles.meta}>{shop.landmark}</span>
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
          </div>
          <div className={`${styles.side} reveal`}>
            <div className={`l-frame ${styles.mapFrame}`}>
              <iframe
                className={styles.map}
                src={mapEmbedUrl()}
                title={`Карта: ${shop.fullName}, ${shop.address}`}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
            <div className={`l-frame l-frame-accent ${styles.cta}`}>
              <p className={styles.ctaText}>Свободные окна есть уже сегодня.</p>
              <Link href="/book" className={`btn btn-primary btn-lg ${styles.ctaButton}`}>
                Записаться онлайн
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
