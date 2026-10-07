import { describe, expect, test } from 'bun:test'
import ptBR from '../../i18n/locales/pt-BR/board.json'
import en from '../../i18n/locales/en/board.json'
import es from '../../i18n/locales/es/board.json'

// Chaves de rótulo/feedback que precisam existir e ser não vazias nos três
// locales (feedback de conflito, arquivamento/exclusão, fechamento e estados
// vazios usados pelas jornadas de interação).
const keys = [
  'saveConflict', 'errorSave', 'archiveItem', 'deleteItem', 'close',
  'statusLabel', 'back', 'noStory', 'noModule', 'clear',
]

for (const [locale, resource] of [['pt-BR', ptBR], ['en', en], ['es', es]] as const) {
  test(`${locale}: feedback e rótulos presentes`, () => {
    const json = resource as unknown as Record<string, string>
    for (const key of keys) {
      expect(`${locale}:${key}:${typeof json[key] === 'string' && json[key].length > 0}`).toBe(`${locale}:${key}:true`)
    }
  })
}
