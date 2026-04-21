import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AI CRM — МеталлПортал',
  description: 'AI-powered CRM для МеталлПортал',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru" className="h-full">
      <body className="h-full antialiased">{children}</body>
    </html>
  )
}
