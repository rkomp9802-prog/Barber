import Link from 'next/link'

import { formatDuration, formatPrice, type ServiceDto } from '@barber/shared'

import styles from './landing.module.css'

type RowProps = {
  service: ServiceDto
  index: number
}

function ServiceRow({ service, index }: RowProps) {
  const number = String(index + 1).padStart(2, '0')

  return (
    <li>
      <Link href={`/book?service=${encodeURIComponent(service.id)}`} className={styles.menuRow}>
        <span className={styles.menuNumber} aria-hidden="true">
          {number}
        </span>
        <span className={styles.menuLine}>
          <span className={styles.menuName}>{service.name}</span>
          <span className={styles.menuLeader} aria-hidden="true" />
          <span className={styles.menuPrice}>{formatPrice(service.price)}</span>
        </span>
        <span className={styles.menuMeta}>
          <span className={styles.menuDesc}>{service.description}</span>
          <span className={styles.menuDuration}>{formatDuration(service.durationMin)}</span>
        </span>
        <span className={styles.menuCta} aria-hidden="true">
          Выбрать →
        </span>
      </Link>
    </li>
  )
}

type Props = {
  services: readonly ServiceDto[]
}

export function ServicesSection({ services }: Props) {
  return (
    <section id="services" className="section" aria-labelledby="services-title">
      <div className="container">
        <div className={styles.sectionHeadSplit}>
          <div className="section-head">
            <p className="eyebrow">Прайс-лист</p>
            <h2 id="services-title" className="section-title">
              Услуги и цены
            </h2>
          </div>
          <p className={`muted ${styles.headNote}`}>
            Цены окончательные — без доплат за «сложность». Нажмите на услугу, чтобы сразу перейти к записи.
          </p>
        </div>
        <ol className={styles.menu}>
          {services.map((service, index) => (
            <ServiceRow key={service.id} service={service} index={index} />
          ))}
        </ol>
      </div>
    </section>
  )
}
