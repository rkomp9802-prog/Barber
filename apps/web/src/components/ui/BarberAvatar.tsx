import Image from 'next/image'

import { isOptimizableImage } from '@/lib/images'

import { Avatar } from './Avatar'
import styles from './Avatar.module.css'

const SIZES = { md: 56, lg: 88 } as const

type Props = {
  name: string
  photoUrl: string | null
  /** Порядковый номер барбера: цвет монограммы, если фото нет. */
  index: number
  size?: keyof typeof SIZES
}

/** Фото барбера из Supabase Storage, а если его нет (или хост не разрешён) — монограмма. */
export function BarberAvatar({ name, photoUrl, index, size = 'md' }: Props) {
  if (!isOptimizableImage(photoUrl)) return <Avatar name={name} index={index} size={size} />
  const px = SIZES[size]
  return (
    <Image
      src={photoUrl}
      alt=""
      width={px}
      height={px}
      sizes={`${px}px`}
      className={`${styles.photo} ${size === 'lg' ? styles.lg : ''}`}
    />
  )
}
