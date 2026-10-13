import styles from './Avatar.module.css'

const PALETTES = [
  ['#a87a3d', '#3b2a1a'],
  ['#5a6f8f', '#1f2a3a'],
  ['#7c5a8f', '#2b1f36'],
  ['#4f7f68', '#1d2e26'],
] as const

type Props = {
  name: string
  /** Индекс барбера: задаёт цвет, чтобы у каждого был свой. */
  index: number
  size?: 'md' | 'lg'
}

/** Пока фото нет (появятся в админке на этапе 9), показываем монограмму. */
export function Avatar({ name, index, size = 'md' }: Props) {
  const [from, to] = PALETTES[index % PALETTES.length] ?? PALETTES[0]
  const initial = name.trim().charAt(0).toUpperCase()

  return (
    <span
      className={`${styles.avatar} ${size === 'lg' ? styles.lg : ''}`}
      style={{ backgroundImage: `linear-gradient(140deg, ${from}, ${to})` }}
      aria-hidden="true"
    >
      {initial}
    </span>
  )
}
