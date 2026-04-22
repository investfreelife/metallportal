'use client'

import { useEffect } from 'react'

const KEY = 'mp_contact'

export interface SavedContact {
  name?: string
  phone?: string
  email?: string
}

export function loadSavedContact(): SavedContact {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}')
  } catch {
    return {}
  }
}

export function saveContact(data: SavedContact) {
  if (typeof window === 'undefined') return
  const existing = loadSavedContact()
  localStorage.setItem(KEY, JSON.stringify({ ...existing, ...data }))
}

/** Call after successful form submit to persist contact data */
export function useSaveContact(data: SavedContact, submitted: boolean) {
  useEffect(() => {
    if (submitted && (data.name || data.phone || data.email)) {
      saveContact(data)
    }
  }, [submitted])
}
