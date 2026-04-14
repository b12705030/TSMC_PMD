import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '@/modules/auth/context/AuthContext'

export const metadata: Metadata = {
  title: 'Performance Management System — Unleash Innovation',
  description: 'Enterprise Performance Management System',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
