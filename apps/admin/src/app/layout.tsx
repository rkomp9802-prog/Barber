import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Barbershop Admin',
  description: 'Admin panel for barbershop management',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru">
      <body className="bg-surface text-text-body">{children}</body>
    </html>
  )
}
