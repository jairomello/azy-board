import { describe, expect, test } from 'bun:test'
import { scanText, type ScanContext } from './check-i18n'

const keys = new Set(['board:add', 'board:close', 'common:status.DONE'])
const context = (declared: Array<[string, string]> = []): ScanContext => ({
  keyExists: key => keys.has(key),
  isDeclaredDynamic: (file, expression) => declared.some(([f, e]) => f === file && e === expression),
})

const scan = (content: string, declared: Array<[string, string]> = []) => scanText(content, 'Componente.tsx', context(declared))

describe('check-i18n (AST): texto fixo sem acento', () => {
  test('JSXText em português sem acento é reportado', () => {
    const findings = scan('export const A = () => <button>Adicionar card</button>')
    expect(findings.map(finding => finding.type)).toEqual(['jsx-text'])
    expect(findings[0]!.text).toBe('Adicionar card')
  })

  test('JSXText com acento também é reportado', () => {
    const findings = scan('export const A = () => <span>Configurações</span>')
    expect(findings[0]!.type).toBe('jsx-text')
  })

  test('JSXText técnico isento não é reportado', () => {
    expect(scan('export const A = () => <span>AzyBoard</span>')).toEqual([])
  })

  test('linha com i18n-exempt é ignorada', () => {
    const findings = scan('export const A = () => <span>Texto legado</span> // i18n-exempt: conteúdo do usuário')
    expect(findings).toEqual([])
  })

  test('atributo acessível fixo é reportado; traduzido não', () => {
    expect(scan('export const A = () => <button aria-label="Fechar" />').map(f => f.type)).toEqual(['attribute:aria-label'])
    expect(scan("export const A = () => <button aria-label={t('board:close')} />")).toEqual([])
  })

  test('toast com texto fixo é reportado', () => {
    expect(scan("toast('Erro ao salvar', 'error')").map(f => f.type)).toEqual(['toast'])
  })
})

describe('check-i18n (AST): chaves de tradução', () => {
  test('chave estática ausente é reportada', () => {
    expect(scan("t('board:inexistente')").map(f => f.type)).toEqual(['missing-key'])
  })

  test('chave estática existente passa', () => {
    expect(scan("t('board:add')")).toEqual([])
  })

  test('template com conjunto finito não exige manifesto', () => {
    expect(scan('t(`common:status.${status}`)')).toEqual([])
  })

  test('expressão dinâmica opaca exige manifesto', () => {
    const findings = scan('t(labelKey)')
    expect(findings.map(f => f.type)).toEqual(['dynamic-key'])
    expect(scan('t(labelKey)', [['Componente.tsx', 'labelKey']])).toEqual([])
  })

  test('Trans com i18nKey ausente é reportado', () => {
    expect(scan("const A = () => <Trans i18nKey=\"board:inexistente\" />").map(f => f.type)).toEqual(['missing-key'])
  })
})
