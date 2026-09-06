import { describe, expect, test } from 'bun:test'

// O workspace não possui DOM, jsdom ou React Testing Library. Estes testes de
// contrato exercitam a presença dos caminhos de UI no código compilável sem
// adicionar uma infraestrutura de browser fora do escopo da mudança.
async function source(path: string) {
  return fetch(new URL(path, import.meta.url)).then(response => response.text())
}

function contains(text: string, expected: string) {
  expect(text.includes(expected)).toBe(true)
}

describe('contrato de UI das sinalizações de visibilidade', () => {
  test('badge restrito usa cadeado e tom âmbar nos dois temas', async () => {
    const text = await source('./components/ProjectVisibilityBadges.tsx')
    contains(text, 'icon={Lock}')
    contains(text, "label={t('projectVisibility.restricted')}")
    contains(text, 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800')
  })

  test('badge oculto usa olho cortado e tom neutro nos dois temas', async () => {
    const text = await source('./components/ProjectVisibilityBadges.tsx')
    contains(text, 'icon={EyeOff}')
    contains(text, "label={t('projectVisibility.hidden')}")
    contains(text, 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700')
  })

  test('badges são acessíveis: ícone decorativo, texto visível e tooltip', async () => {
    const text = await source('./components/ProjectVisibilityBadges.tsx')
    contains(text, 'aria-hidden="true"')
    contains(text, '<Tooltip label={tooltip} position="top">')
    contains(text, "tooltip={t('projectVisibility.restrictedTooltip')}")
    contains(text, "tooltip={t('projectVisibility.hiddenTooltip')}")
  })

  test('card de projeto oculto recebe borda tracejada e opacidade reduzida', async () => {
    const text = await source('./pages/ProjectsPage.tsx')
    contains(text, "p.isHidden ? 'border-dashed opacity-70 hover:opacity-100 focus-visible:opacity-100' : ''")
  })

  test('card usa grupo nomeado para o tooltip não vazar entre cards', async () => {
    const text = await source('./pages/ProjectsPage.tsx')
    contains(text, 'group/card')
    contains(text, 'group-hover/card:bg-primary/20')
    contains(text, 'group-hover/card:text-primary')
  })

  test('badges ficam no rodapé do card, ao lado de Abrir board', async () => {
    const text = await source('./pages/ProjectsPage.tsx')
    contains(text, '<div className="mt-4 flex items-center gap-2 flex-wrap min-h-6">')
    contains(text, '<ProjectVisibilityBadges isRestricted={p.isRestricted} isHidden={p.isHidden} />')
  })
})
