import { defineRouting } from 'next-intl/routing'

export const routing = defineRouting({
  locales: ['zh-TW', 'zh-CN', 'en', 'de', 'ja', 'fr', 'es'],
  defaultLocale: 'zh-TW',
})
