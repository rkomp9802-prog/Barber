import type { ReactNode } from 'react'
import Link from 'next/link'

import { formatDuration, formatPrice, type ServiceDto } from '@barber/shared'

import styles from './Services.module.css'

type IconKind = 'scissors' | 'razor' | 'beard' | 'clipper' | 'drop'

/* Иконка подбирается по названию услуги: первое совпадение по ключевым словам.
   «Стрижка» проверяется первой, поэтому «Стрижка + борода» получает ножницы.
   Если ничего не подошло, остаются ножницы. */
const ICON_RULES: ReadonlyArray<readonly [RegExp, IconKind]> = [
  [/стриж/, 'scissors'],
  [/брит/, 'razor'],
  [/бород|усы|усик/, 'beard'],
  [/машин|фейд|fade|под ноль|налысо/, 'clipper'],
  [/уход|масл|маск|массаж/, 'drop'],
]

function pickIcon(name: string): IconKind {
  const lower = name.toLowerCase()
  const rule = ICON_RULES.find(([pattern]) => pattern.test(lower))
  return rule ? rule[1] : 'scissors'
}

const ICON_SHAPES: Record<IconKind, ReactNode> = {
  scissors: (
    <>
      <circle cx="14" cy="34" r="6" />
      <circle cx="34" cy="34" r="6" />
      <path d="M18.5 29.5 38 6" />
      <path d="M29.5 29.5 10 6" />
    </>
  ),
  razor: (
    <>
      <path d="M6 20h36" />
      <path d="M12 20l4 22h16l4-22" />
      <path d="M24 42v4" />
    </>
  ),
  beard: (
    <>
      <path d="M11 12c0 18 5.5 28 13 28s13-10 13-28" />
      <path d="M18 27c2.5 3.5 9.5 3.5 12 0" />
    </>
  ),
  clipper: (
    <>
      <path d="M15 6h18v22H15z" />
      <path d="M19 28v9M24 28v9M29 28v9" />
    </>
  ),
  drop: (
    <>
      <path d="M24 5C24 5 12 19 12 30a12 12 0 0 0 24 0C36 19 24 5 24 5z" />
      <path d="M18 31a6 6 0 0 0 5 5" />
    </>
  ),
}

function ServiceIcon({ kind }: { kind: IconKind }) {
  return (
    <svg
      className={styles.icon}
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {ICON_SHAPES[kind]}
    </svg>
  )
}

type DecorProps = {
  className: string
}

/* Декор: силуэты инструментов. Заливка и обводка — var(--accent) через .decor в CSS. */
function DecorBrush({ className }: DecorProps) {
  return (
    <svg className={`${styles.decor} ${className}`} viewBox="0 0 200 200" aria-hidden="true" focusable="false">
      <rect x="88" y="90" width="24" height="100" rx="12" />
      <rect x="92" y="78" width="16" height="16" />
      <ellipse cx="100" cy="56" rx="36" ry="32" />
    </svg>
  )
}

function DecorRazor({ className }: DecorProps) {
  return (
    <svg className={`${styles.decor} ${className}`} viewBox="0 0 200 200" aria-hidden="true" focusable="false">
      <path d="M14 100 L112 86 L112 114 Z" />
      <rect x="110" y="88" width="78" height="24" rx="12" />
      <circle cx="112" cy="100" r="7" />
    </svg>
  )
}

function DecorScissors({ className }: DecorProps) {
  return (
    <svg className={`${styles.decor} ${className}`} viewBox="0 0 200 200" aria-hidden="true" focusable="false">
      <path d="M84 132 L164 22 L174 30 L96 140 Z" />
      <path d="M116 132 L36 22 L26 30 L104 140 Z" />
      <circle cx="72" cy="158" r="20" fill="none" />
      <circle cx="128" cy="158" r="20" fill="none" />
    </svg>
  )
}

type CardProps = {
  service: ServiceDto
  featured: boolean
}

function ServiceCard({ service, featured }: CardProps) {
  const className = featured
    ? `${styles.card} ${styles.featured} l-frame l-frame-accent l-tilt`
    : styles.card

  return (
    <li className="reveal">
      <Link href={`/book?service=${encodeURIComponent(service.id)}`} className={className}>
        {featured ? <span className={styles.badge}>Хит</span> : null}
        <span className={styles.iconBox}>
          <ServiceIcon kind={pickIcon(service.name)} />
        </span>
        <h3 className={styles.name}>{service.name}</h3>
        <p className={styles.desc}>{service.description}</p>
        <div className={styles.meta}>
          <span className={styles.duration}>{formatDuration(service.durationMin)}</span>
          <span className={styles.priceLabel}>Цена</span>
          <span className={styles.price}>{formatPrice(service.price)}</span>
        </div>
      </Link>
    </li>
  )
}

type Props = {
  services: readonly ServiceDto[]
}

export function ServicesSection({ services }: Props) {
  return (
    <section id="services" className={`section ${styles.section}`} aria-labelledby="services-title">
      <DecorBrush className={`${styles.decorBrush} ${styles.float}`} />
      <DecorRazor className={`${styles.decorRazor} ${styles.float}`} />
      <DecorScissors className={`${styles.decorScissors} ${styles.decorExtra} ${styles.float}`} />
      <div className={`container ${styles.inner}`}>
        <div className={`l-head ${styles.head}`}>
          <p className={`l-kicker ${styles.kicker}`}>Прайс-лист</p>
          <h2 id="services-title" className="l-title reveal">
            Услуги и цены
          </h2>
          <p className={`muted ${styles.note}`}>
            Цены окончательные — без доплат за «сложность». Нажмите на услугу, чтобы сразу перейти к записи.
          </p>
        </div>
        <ol className={`${styles.grid} reveal-group`}>
          {services.map((service, index) => (
            <ServiceCard key={service.id} service={service} featured={index === 0} />
          ))}
        </ol>
        <div className={styles.footer}>
          <Link href="/book" className="btn btn-primary">
            Записаться
          </Link>
        </div>
      </div>
    </section>
  )
}
