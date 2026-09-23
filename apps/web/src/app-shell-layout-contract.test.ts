// [CONTRATO-ESTRUTURAL] layout CSS do shell; o happy-dom não calcula layout.
// A cobertura comportamental equivalente deve migrar para testes de componente/E2E.
import { describe, expect, test } from 'bun:test'

async function source(path: string) {
  return fetch(new URL(path, import.meta.url)).then(response => response.text())
}

function contains(text: string, expected: string) {
  expect(text.includes(expected)).toBe(true)
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

    contains(shell, 'relative z-20 hidden lg:block')
    contains(shell, 'lg:-ml-3')
    contains(shell, 'lg:border-r-0')
    contains(shell, 'shadow-[12px_0_24px_-10px_rgba(3,15,23,0.72)')
    expect(shell.includes('rounded-tr-none')).toBe(false)
    expect(shell.includes('data-shell-sidebar-brand className="h-16 flex-shrink-0 border-b')).toBe(false)
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
})
