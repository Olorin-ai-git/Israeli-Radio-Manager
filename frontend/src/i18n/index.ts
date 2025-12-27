import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import en from './en.json'
import he from './he.json'

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      he: { translation: he },
    },
    // Hebrew is the default for Israeli users
    lng: localStorage.getItem('language') || 'he',
    fallbackLng: 'he',
    interpolation: {
      escapeValue: false,
    },
  })

// Save language preference
i18n.on('languageChanged', (lng) => {
  localStorage.setItem('language', lng)
})

export default i18n
