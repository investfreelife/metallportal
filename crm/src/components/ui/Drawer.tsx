'use client'
import { useEffect } from 'react'

interface DrawerProps {
  isOpen: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: React.ReactNode
  width?: number
}

export function Drawer({ isOpen, onClose, title, subtitle, children, width = 480 }: DrawerProps) {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [onClose])

  return (
    <>
      <div
        className={`fixed inset-0 z-40 transition-all duration-200 ${isOpen ? 'bg-black/25 backdrop-blur-[2px]' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      <div
        className="fixed right-0 top-0 h-full bg-white z-50 flex flex-col shadow-2xl border-l border-gray-200 transition-transform duration-250"
        style={{ width, transform: isOpen ? 'translateX(0)' : 'translateX(100%)' }}
      >
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-200 flex-shrink-0">
          <div>
            <h2 className="text-[14px] font-medium text-gray-900">{title}</h2>
            {subtitle && <p className="text-[11px] text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl ml-4">×</button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">{children}</div>
      </div>
    </>
  )
}
