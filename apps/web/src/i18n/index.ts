import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import ptBRCommon from './locales/pt-BR/common.json'
import ptBRAuth from './locales/pt-BR/auth.json'
import ptBRBoard from './locales/pt-BR/board.json'
import ptBRSettings from './locales/pt-BR/settings.json'
import ptBRDashboard from './locales/pt-BR/dashboard.json'
import ptBRDashboardDescriptions from './locales/pt-BR/dashboardDescriptions.json'
import ptBRAssistant from './locales/pt-BR/assistant.json'

import enCommon from './locales/en/common.json'
import enAuth from './locales/en/auth.json'
import enBoard from './locales/en/board.json'
import enSettings from './locales/en/settings.json'
import enDashboard from './locales/en/dashboard.json'
import enDashboardDescriptions from './locales/en/dashboardDescriptions.json'
import enAssistant from './locales/en/assistant.json'

import esCommon from './locales/es/common.json'
import esAuth from './locales/es/auth.json'
import esBoard from './locales/es/board.json'
import esSettings from './locales/es/settings.json'
import esDashboard from './locales/es/dashboard.json'
import esDashboardDescriptions from './locales/es/dashboardDescriptions.json'
import esAssistant from './locales/es/assistant.json'

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'pt-BR',
    defaultNS: 'common',
    returnNull: false,
    missingKeyHandler: (_lngs, namespace, key) => {
      console.warn(`[i18n] Missing translation: ${namespace}:${key}`)
    },
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'language',
    },
    resources: {
      'pt-BR': { common: ptBRCommon, auth: ptBRAuth, board: ptBRBoard, settings: ptBRSettings, assistant: ptBRAssistant, dashboard: { ...ptBRDashboard, ...ptBRDashboardDescriptions } },
      en: { common: enCommon, auth: enAuth, board: enBoard, settings: enSettings, assistant: enAssistant, dashboard: { ...enDashboard, ...enDashboardDescriptions } },
      es: { common: esCommon, auth: esAuth, board: esBoard, settings: esSettings, assistant: esAssistant, dashboard: { ...esDashboard, ...esDashboardDescriptions } },
    },
  })

export default i18n
