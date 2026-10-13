import type { Metadata, Viewport } from 'next'
import { Manrope, Playfair_Display } from 'next/font/google'
import type { ReactNode } from 'react'

import { shop } from '@/data/shop'
import { THEME_INIT_SCRIPT } from '@/lib/theme'

import './globals.css'

const manrope = Manrope({ subsets: ['latin', 'cyrillic'], variable: '--font-manrope', display: 'swap' })
const playfair = Playfair_Display({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-playfair',
  weight: ['600', '700'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: `${shop.fullName} — ${shop.tagline}`,
  description: 'Стрижки, борода и королевское бритьё. Онлайн-запись к барберу за минуту.',
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f2ec' },
    { media: '(prefers-color-scheme: dark)', color: '#121212' },
  ],
}

interface RootLayoutProps {
  children: ReactNode
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="ru" className={`${manrope.variable} ${playfair.variable}`} suppressHydrationWarning>
      <head>
        {/* Ставит выбранную тему до первой отрисовки, чтобы страница не мигала. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
