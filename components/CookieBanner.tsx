'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

const COOKIE_KEY = 'hm_cookie_consent'

export default function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      if (!localStorage.getItem(COOKIE_KEY)) {
        setVisible(true)
      }
    } catch {
      setVisible(true)
    }
  }, [])

  const accept = () => {
    try {
      localStorage.setItem(COOKIE_KEY, '1')
    } catch {}
    setVisible(false)
  }

  const decline = () => {
    try {
      localStorage.setItem(COOKIE_KEY, '0')
    } catch {}
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-label="Уведомление о cookies"
      className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border shadow-lg"
    >
      <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <p className="text-sm text-foreground/80 flex-1 leading-relaxed">
          Мы используем cookie-файлы для корректной работы сайта и сбора обезличенной
          аналитики (Яндекс.Метрика). Нажимая «Принять», вы соглашаетесь с{' '}
          <Link href="/privacy" className="text-gold hover:underline">
            политикой конфиденциальности
          </Link>
          .
        </p>
        <div className="flex gap-3 flex-shrink-0">
          <button
            onClick={accept}
            className="bg-gold text-black text-sm font-semibold px-5 py-2 rounded-lg hover:bg-gold/90 transition-colors"
          >
            Принять
          </button>
          <button
            onClick={decline}
            className="text-sm text-muted-foreground hover:text-foreground px-4 py-2 rounded-lg border border-border hover:border-foreground/30 transition-colors"
          >
            Отказаться
          </button>
        </div>
      </div>
    </div>
  )
}
