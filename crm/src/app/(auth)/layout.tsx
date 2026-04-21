export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full bg-gray-950 flex items-center justify-center">
      {children}
    </div>
  )
}
