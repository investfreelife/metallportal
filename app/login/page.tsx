import { redirect } from 'next/navigation'

export default function LoginPage({ searchParams }: { searchParams: { ref?: string } }) {
  const ref = searchParams.ref ? `?ref=${searchParams.ref}` : ''
  redirect(`/account/login${ref}`)
}
