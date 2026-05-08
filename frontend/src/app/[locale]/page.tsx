import { redirect, notFound } from 'next/navigation'
import { routing } from '@/i18n/routing'

export default async function LocaleRootPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound()
  }
  redirect(`/${locale}/dashboard`)
}
