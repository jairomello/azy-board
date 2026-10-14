// [CONTRATO-ESTRUTURAL] layout CSS do shell; o happy-dom não calcula layout.
// A cobertura comportamental equivalente deve migrar para testes de componente/E2E.
import { describe, expect, test } from 'bun:test'

async function source(path: string) {
  return fetch(new URL(path, import.meta.url)).then(response => response.text())
}

function contains(text: string, expected: string) {
  expect(text.includes(expected)).toBe(true)
}

// Trecho do JSX que renderiza o slot `commandBar`, recortado até o fechamento
// do seu wrapper.
function commandBarBlock(shell: string) {
  const start = shell.indexOf('{commandBar && (')
  if (start < 0) throw new Error('slot commandBar ausente no AppShell')
  const marker = shell.indexOf('{/* statusRail */}')
  const block = shell.slice(start, marker === -1 ? shell.length : marker)
  return block.slice(0, block.indexOf('</div>'))
}

// Lê o z-index que segue imediatamente a âncora (ex.: 'shell-surface relative z-').
function zIndexAfter(text: string, anchor: string): number {
  const index = text.indexOf(anchor)
  if (index < 0) throw new Error(`âncora ausente: ${anchor}`)
  const match = /^(\d+)/.exec(text.slice(index + anchor.length))
  if (!match) throw new Error(`z-index ausente após a âncora: ${anchor}`)
  return Number(match[1])
}

describe('contrato do shell integrado', () => {
  test('organiza sidebar, header e workspace em uma grade desktop', async () => {
    const shell = await source('./components/AppShell.tsx')

    for (const region of ['data-shell-layout', 'data-shell-sidebar', 'data-shell-header', 'data-shell-workspace']) {
      contains(shell, region)
    }
    contains(shell, 'lg:grid')
    contains(shell, 'lg:grid-rows-[64px_minmax(0,1fr)]')
    contains(shell, 'lg:row-span-2')
    contains(shell, 'lg:col-start-2')
    contains(shell, 'lg:row-start-2')
  })

  test('mantem uma marca contextual por breakpoint', async () => {
    const shell = await source('./components/AppShell.tsx')

    contains(shell, 'data-shell-sidebar-brand')
    contains(shell, 'data-shell-mobile-brand')
    contains(shell, 'text-base lg:hidden min-[1280px]:block')
    contains(shell, 'lg:hidden')
    expect(shell.match(/<BrandLogo/g)?.length).toBe(2)
  })

  test('preserva larguras compacta e expandida da sidebar', async () => {
    const shell = await source('./components/AppShell.tsx')

    contains(shell, 'lg:grid-cols-[68px_minmax(0,1fr)]')
    contains(shell, 'min-[1280px]:grid-cols-[220px_minmax(0,1fr)]')
    contains(shell, 'lg:justify-center min-[1280px]:justify-start')
  })

  test('sobrepoe a sidebar arredondada ao header sem linhas de divisao', async () => {
    const shell = await source('./components/AppShell.tsx')

    contains(shell, 'relative z-40 hidden lg:block')
    contains(shell, 'lg:-ml-3')
    contains(shell, 'lg:border-r-0')
    contains(shell, 'shadow-[12px_0_24px_-10px_rgba(3,15,23,0.72)')
    expect(shell.includes('rounded-tr-none')).toBe(false)
    expect(shell.includes('data-shell-sidebar-brand className="h-16 flex-shrink-0 border-b')).toBe(false)
  })

  test('mantem o header acima da workspace para o menu de perfil nao ficar atras', async () => {
    const shell = await source('./components/AppShell.tsx')

    contains(shell, 'shell-surface relative z-30')
    expect(shell.includes('relative z-0')).toBe(false)
    // A sidebar segue acima do header para preservar a emenda visual em `lg`.
    contains(shell, 'relative z-40 hidden lg:block')

    // O valor isolado de cada camada nao garantia a ordem, e foi essa inversao
    // (command bar acima do header) que colocou o menu do perfil atras da barra.
    const headerZ = zIndexAfter(shell, 'shell-surface relative z-')
    const commandBarZ = zIndexAfter(commandBarBlock(shell), 'relative z-')
    expect(headerZ).toBeGreaterThan(commandBarZ)
    expect(commandBarZ).toBeGreaterThan(0)
    // Overlays globais (modais e drawer) usam z-50 e seguem por cima do header.
    expect(headerZ).toBeLessThan(50)
  })

  test('mantem a barra de comando acima do conteudo do board para os menus nao ficarem atras', async () => {
    const shell = await source('./components/AppShell.tsx')
    // O backdrop-blur cria stacking context; sem z positivo a barra (e seus
    // popovers) pinta abaixo do <main> do board, que e irmao posterior.
    const commandBarSegment = commandBarBlock(shell)
    contains(commandBarSegment, 'backdrop-blur-xl')
    contains(commandBarSegment, 'relative z-20')
    expect(zIndexAfter(commandBarSegment, 'relative z-')).toBeGreaterThan(0)
    // E continua abaixo do header, para os popovers do header nao ficarem atras.
    expect(zIndexAfter(commandBarSegment, 'relative z-')).toBeLessThan(zIndexAfter(shell, 'shell-surface relative z-'))
  })

  test('preserva slots, drawer e tokens de tema existentes', async () => {
    const shell = await source('./components/AppShell.tsx')

    for (const contract of ['commandBar', 'statusRail', 'contentClassName', 'top-[76px]', 'bg-shell-sidebar', 'bg-shell-header', 'border-shell-border']) {
      contains(shell, contract)
    }
    contains(shell, "tCommon('openMenu')")
    contains(shell, "tCommon('closeMenu')")
    contains(shell, "tCommon('closeNavigation')")
  })

  test('posiciona Conta antes de Admin, com Admin ao final da navegacao', async () => {
    const shell = await source('./components/AppShell.tsx')
    const nav = shell.slice(shell.indexOf('const navItems'), shell.indexOf('return items'))

    const accountIndex = nav.indexOf("label: tCommon('account')")
    const adminIndex = nav.indexOf("label: tCommon('admin')")
    const guardIndex = nav.indexOf('if (user && canAccessAdmin(user.globalGroup))')

    expect(accountIndex).toBeGreaterThan(-1)
    expect(adminIndex).toBeGreaterThan(-1)
    expect(accountIndex).toBeLessThan(adminIndex)
    expect(guardIndex).toBeGreaterThan(-1)
    expect(guardIndex).toBeLessThan(adminIndex)
    expect(nav.lastIndexOf('items.push(')).toBeLessThan(adminIndex)
  })

  test('o nome do projeto abre a modal de planejamento quando onProjectNameActivate e fornecido', async () => {
    const shell = await source('./components/AppShell.tsx')
    contains(shell, 'onProjectNameActivate?: () => void')
    contains(shell, 'data-project-name-activate')
    contains(shell, 'onClick={onProjectNameActivate}')
    // Fallback preservado: sem a prop, o titulo continua um <h1> estatico.
    contains(shell, '<h1 className="text-sm sm:text-base font-semibold truncate"')
  })

  test('exibe a versao do build na sidebar (T60)', async () => {
    const shell = await source('./components/AppShell.tsx')
    contains(shell, 'data-build-version')
    contains(shell, "tCommon('buildVersion'")
    contains(shell, "tCommon('buildVersionWithDate'")
  })
})
