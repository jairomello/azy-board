// [CONTRATO-ESTRUTURAL] garante a paridade entre ICON_CATALOG (contrato compartilhado)
// e o mapa de componentes lucide do web, além dos defaults, validadores e categorias.
import { describe, expect, test } from 'bun:test'
import {
  DEFAULT_ITEM_ICON,
  DEFAULT_PROJECT_ICON,
  ICON_CATALOG,
  ICON_CATEGORIES,
  ICON_CATEGORY_IDS,
  ICON_COLORS,
  isIconColor,
  isIconName,
} from '@azy-board/ui-contracts'
import { ICON_COMPONENTS, itemIconComponent, projectIconComponent } from './iconCatalog'

describe('catálogo de ícones', () => {
  test('todo nome do catálogo tem um componente lucide mapeado', () => {
    for (const name of ICON_CATALOG) {
      expect(Boolean(ICON_COMPONENTS[name])).toBe(true)
    }
  })

  test('os defaults pertencem ao catálogo e têm componente', () => {
    expect(ICON_CATALOG).toContain(DEFAULT_PROJECT_ICON)
    expect(ICON_CATALOG).toContain(DEFAULT_ITEM_ICON)
    expect(projectIconComponent(null)).toBe(ICON_COMPONENTS[DEFAULT_PROJECT_ICON])
    expect(itemIconComponent(null)).toBe(ICON_COMPONENTS[DEFAULT_ITEM_ICON])
  })

  test('validadores reconhecem apenas nomes e cores do catálogo', () => {
    expect(isIconName('rocket')).toBe(true)
    expect(isIconName('nao-existe')).toBe(false)
    expect(isIconColor(ICON_COLORS[0])).toBe(true)
    expect(isIconColor('#000000')).toBe(false)
  })

  test('o catálogo plano é a concatenação exata e ordenada das categorias', () => {
    const flattened = ICON_CATEGORIES.flatMap(category => category.icons)
    expect(flattened).toEqual(ICON_CATALOG)
  })

  test('categorias têm ids conhecidos, únicos e na ordem de ICON_CATEGORY_IDS', () => {
    expect(ICON_CATEGORIES.map(category => category.id)).toEqual([...ICON_CATEGORY_IDS])
    expect(new Set(ICON_CATEGORIES.map(category => category.id)).size).toBe(ICON_CATEGORIES.length)
  })

  test('todo ícone pertence a exatamente uma categoria e nenhum se repete', () => {
    const seen = new Set<string>()
    for (const category of ICON_CATEGORIES) {
      expect(category.icons.length).toBeGreaterThan(0)
      for (const name of category.icons) {
        expect(seen.has(name)).toBe(false)
        seen.add(name)
      }
    }
    expect(seen.size).toBe(ICON_CATALOG.length)
  })
})
