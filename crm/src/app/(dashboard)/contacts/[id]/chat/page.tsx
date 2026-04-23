import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ChatClient from './ChatClient'

export default async function ContactChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: contact } = await supabase
    .from('contacts')
    .select('id, full_name, company_name, email, phone, telegram, telegram_chat_id')
    .eq('id', id)
    .single()

  if (!contact) notFound()

  return (
    <div className="h-screen flex flex-col">
      <ChatClient contact={contact} />
    </div>
  )
}
