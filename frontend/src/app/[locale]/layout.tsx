import { NextIntlClientProvider } from 'next-intl'
import { getMessages, setRequestLocale } from 'next-intl/server'
import { AuthProvider } from '@/modules/auth/context/AuthContext'
import { LocaleHtml } from '@/components/LocaleHtml'

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode
  params: Promise<{ locale: string }>
}>) {
  const { locale } = await params
  setRequestLocale(locale)
  const messages = await getMessages()

  return (
    <NextIntlClientProvider messages={messages}>
      <LocaleHtml />
      <AuthProvider>{children}</AuthProvider>
    </NextIntlClientProvider>
  )
}
