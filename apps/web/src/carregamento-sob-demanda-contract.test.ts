// [CONTRATO-ESTRUTURAL] PB1 — módulos que só aparecem por escolha do usuário
// ficam fora do chunk da página que os usa. É um invariante de bundle, não de
// comportamento: o happy-dom não mostra em qual chunk o código cai. O teto de
// cada chunk é vigiado pelo check:bundle; este contrato reprova o import
// estático que traria o módulo de volta (o que só estouraria o orçamento quando
// outra mudança somasse peso).
import { describe, expect, test } from 'bun:test'
import { readdir, readFile } from 'node:fs/promises'

const SOB_DEMANDA = [
  // Visão Árvore: fora do BoardPage, baixada ao abrir a Árvore.
  { modulo: 'pages/TreeViewPage', quemCarrega: 'features/board/BoardScreen.tsx', importDinamico: "await import('../../pages/TreeViewPage')" },
  // Diálogo de membro: fora do SettingsPage, baixado ao clicar em Adicionar/Editar.
  { modulo: 'features/project-settings/components/MemberDialog', quemCarrega: 'features/project-settings/components/OrganizationSettingsSections.tsx', importDinamico: "await import('./MemberDialog')" },
  // Detalhe da versão: fora do SettingsPage, baixado ao abrir uma versão.
  { modulo: 'components/VersionDetailModal', quemCarrega: 'features/project-settings/components/DeliverySettingsSections.tsx', importDinamico: "await import('../../../components/VersionDetailModal')" },
]

const escapar = (texto: string) => texto.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
const nomeDoArquivo = (modulo: string) => modulo.split('/').pop()!

// Declarações `import … from` e `export … from` inteiras (inclusive em várias
// linhas) que apontam para o módulo e não são só de tipo. Não atravessa outra
// declaração: o código não usa ponto e vírgula.
function trazValor(texto: string, modulo: string): string[] {
  const declaracao = new RegExp(
    `^[ \\t]*(?:import|export)[ \\t]+(?!type\\b)(?:(?!^[ \\t]*(?:import|export)\\b)[\\s\\S])*?from[ \\t]*['"][^'"\\n]*\\/${escapar(nomeDoArquivo(modulo))}['"]`,
    'gm',
  )
  return [...texto.matchAll(declaracao)].map(match => match[0].replace(/\s+/g, ' '))
}

const raiz = new URL('.', import.meta.url).pathname

describe('módulos carregados sob demanda (PB1)', () => {
  for (const { modulo, quemCarrega, importDinamico } of SOB_DEMANDA) {
    test(`${quemCarrega} traz ${nomeDoArquivo(modulo)} só por import() dinâmico`, async () => {
      const texto = await readFile(`${raiz}${quemCarrega}`, 'utf8')
      expect(trazValor(texto, modulo)).toEqual([])
      expect(texto.includes(importDinamico)).toBe(true)
    })
  }

  test('nenhum outro módulo de produção importa esses módulos de forma estática', async () => {
    const arquivos = (await readdir(raiz, { recursive: true })).filter(arquivo => /\.tsx?$/.test(arquivo) && !/\.test\.tsx?$/.test(arquivo))
    const culpados: string[] = []
    for (const arquivo of arquivos) {
      const texto = await readFile(`${raiz}${arquivo}`, 'utf8')
      for (const { modulo } of SOB_DEMANDA) {
        if (arquivo === `${modulo}.tsx`) continue
        for (const declaracao of trazValor(texto, modulo)) culpados.push(`${arquivo}: ${declaracao}`)
      }
    }
    expect(culpados).toEqual([])
  })
})
