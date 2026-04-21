import { cookies } from 'next/headers'
import SettingsClient from './SettingsClient'

function getSession() {
  try {
    const cookieStore = cookies()
    const raw = (cookieStore as unknown as { get: (name: string) => { value: string } | undefined }).get('crm_session')?.value
    if (!raw) return null
    return JSON.parse(Buffer.from(decodeURIComponent(raw), 'base64').toString('utf-8'))
  } catch { return null }
}

export default function SettingsPage() {
  const session = getSession()
  return <SettingsClient session={session} />
}
