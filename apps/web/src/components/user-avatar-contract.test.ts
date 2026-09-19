import { describe, expect, test } from 'bun:test'

async function source(path: string) {
  return fetch(new URL(path, import.meta.url)).then(response => response.text())
}

describe('contrato do UserAvatar', () => {
  test('resolve o base path das URLs de avatar', async () => {
    const component = await source('../components/UserAvatar.tsx')
    expect(component.includes("import { resolveAppUrl } from '../lib/appUrl'")).toBe(true)
    expect(component.includes('src={resolveAppUrl(user.avatarUrl)}')).toBe(true)
  })

  test('cai para as iniciais quando não há foto', async () => {
    const component = await source('../components/UserAvatar.tsx')
    expect(component.includes('if (!user.avatarUrl)')).toBe(false)
    // Renderização condicional: img quando há URL, iniciais no caso contrário.
    expect(component.includes('user.avatarUrl ? (')).toBe(true)
    expect(component.includes('getInitials(user.name)')).toBe(true)
  })

  test('suporta tamanho grande usado na página de conta', async () => {
    const component = await source('../components/UserAvatar.tsx')
    expect(component.includes("lg: 'w-12 h-12 text-lg'")).toBe(true)
  })
})
