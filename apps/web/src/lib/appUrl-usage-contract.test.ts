// [CONTRATO-ESTRUTURAL] invariante de uso do resolvedor de base path.
// A cobertura comportamental equivalente deve migrar para testes de componente/E2E.
import { describe, expect, test } from 'bun:test'

async function source(path: string) {
  return fetch(new URL(path, import.meta.url)).then(response => response.text())
}

// Componentes que renderizam <img> de avatar diretamente (fora do UserAvatar).
const AVATAR_IMG_FILES = [
  '../components/ItemModal.tsx',
  '../components/CardChildrenSection.tsx',
  '../components/VersionDetailModal.tsx',
] as const

describe('uso do resolvedor de base path em avatares', () => {
  test('imagens de avatar usam resolveAppUrl e nunca a URL crua', async () => {
    for (const path of AVATAR_IMG_FILES) {
      const text = await source(path)
      const avatarImgLines = text
        .split('\n')
        .filter(line => line.includes('<img') && line.includes('avatarUrl'))
      expect(avatarImgLines.length > 0).toBe(true)
      const raw = avatarImgLines.filter(line => !line.includes('resolveAppUrl'))
      expect(`${path}: ${raw.length}`).toBe(`${path}: 0`)
    }
  })
})
