import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import ptBRCommon from './locales/pt-BR/common.json'
import ptBRAuth from './locales/pt-BR/auth.json'
import ptBRBoard from './locales/pt-BR/board.json'
import ptBRSettings from './locales/pt-BR/settings.json'

import enCommon from './locales/en/common.json'
import enAuth from './locales/en/auth.json'
import enBoard from './locales/en/board.json'
import enSettings from './locales/en/settings.json'

import esCommon from './locales/es/common.json'
import esAuth from './locales/es/auth.json'
import esBoard from './locales/es/board.json'
import esSettings from './locales/es/settings.json'

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'pt-BR',
    defaultNS: 'common',
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'language',
    },
    resources: {
      'pt-BR': { common: ptBRCommon, auth: ptBRAuth, board: ptBRBoard, settings: ptBRSettings },
      en: { common: enCommon, auth: enAuth, board: enBoard, settings: enSettings },
      es: { common: esCommon, auth: esAuth, board: esBoard, settings: esSettings },
    },
  })

export default i18n
