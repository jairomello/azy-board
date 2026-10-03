// [GUARDA ANTI-REGRESSÃO] nenhuma tela de dados volta a buscar estado remoto
// fora da camada de cache única.
// [CONTRATO-ESTRUTURAL] O invariante é não comportamental: "esta tela não contém
// o padrão antigo de fetch/estado". Um teste de comportamento não enxerga
// ausência de código — só a varredura da fonte garante que o padrão removido não
// reapareça. A varredura é regex simples sobre o texto (sem executar a tela) e
// monitora exatamente as telas migradas para a camada de cache.
import { describe, expect, test } from 'bun:test'

const MIGRATED_SCREENS = [
  './hooks/useApiKeys.ts',
  './features/project-settings/hooks/useProjectSettingsData.ts',
  './pages/ProjectsPage.tsx',
  './pages/AdminUsersPage.tsx',
  './pages/TreeViewPage.tsx',
]

// Padrões do modelo antigo de busca de dados (fora da camada de cache).
const FORBIDDEN_PATTERNS = [
  'refreshToken',
  'setTreeRefreshToken',
  'loadProjects',
  'await load()',
  'void load()',
  'function load()',
  '.then(setKeys',
  '.then(setUsers',
  '.then(setProjects',
  '.then(setTree',
]

async function source(path: string) {
  return fetch(new URL(path, import.meta.url)).then(response => response.text())
}

describe('guarda: telas de dados usam apenas a camada de cache', () => {
  for (const path of MIGRATED_SCREENS) {
    test(`${path} não regride para fetch manual`, async () => {
      const text = await source(path)
      // Toda tela migrada consome dados por consulta cacheada com AbortSignal.
      expect(text.includes('useQuery(')).toBe(true)
      expect(text.includes('{ signal }')).toBe(true)
      for (const pattern of FORBIDDEN_PATTERNS) {
        expect(text.includes(pattern)).toBe(false)
      }
    })
  }

  test('nenhuma tela migrada guarda dados remotos em useState', async () => {
    // Estado de UI (formulários, expansão, modais) continua em useState;
    // listas e dados de servidor vêm do cache.
    const forbiddenState = ['useState<ApiKey[]>(', 'useState<ManagedUser[]>(', 'useState<Project[]>(', 'useState<TreeNode[]>(']
    for (const path of MIGRATED_SCREENS) {
      const text = await source(path)
      for (const pattern of forbiddenState) {
        expect(text.includes(pattern)).toBe(false)
      }
    }
  })
})
