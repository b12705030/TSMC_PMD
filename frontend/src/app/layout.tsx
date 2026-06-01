import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Performance Management System — Unleash Innovation',
  description: 'Enterprise Performance Management System',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW" suppressHydrationWarning>
      <body className="bg-gray-50 text-gray-900 antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  )
}
