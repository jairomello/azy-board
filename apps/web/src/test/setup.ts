// Setup dos testes de componente do web.
//
// Convenção: importe este módulo no topo de cada teste que renderiza
// componentes (`import '../test/setup'`). Não usamos preload global via
// `bunfig.toml` para não injetar `window`/`document` nos testes de API, MCP e
// de lógica pura, que não precisam de DOM.
//
// Responsabilidades:
// - registrar o DOM do happy-dom (window, document, etc.) antes do Testing
//   Library ser carregado;
// - estender o `expect` do bun:test com os matchers de acessibilidade;
// - limpar a árvore renderizada entre os testes.
//
// O `screen` exportado aqui é preguiçoso: o `screen` do Testing Library captura
// `document.body` no carregamento do módulo e, como o DOM é registrado por
// arquivo, ele nasceria inválido. O proxy resolve as consultas em `document.body`
// no momento do uso.
import './register-dom'
import { afterEach, beforeEach, expect } from 'bun:test'
import * as matchers from '@testing-library/jest-dom/matchers'
import { cleanup, within } from '@testing-library/react'

expect.extend(matchers)

// Limpa a árvore antes e depois de cada teste. Além do `cleanup` do Testing
// Library (que só conhece os containers que ele mesmo montou), zeramos o
// `document.body`: com o runner isolando os arquivos, os containers de um teste
// anterior podem não estar mais rastreados e sobreviveriam no DOM compartilhado.
function limparDom() {
  cleanup()
  document.body.innerHTML = ''
}

beforeEach(() => {
  limparDom()
})

afterEach(() => {
  limparDom()
})

export const screen = new Proxy({} as ReturnType<typeof within>, {
  get(_target, property, receiver) {
    const queries = within(document.body)
    const value = Reflect.get(queries, property, receiver)
    return typeof value === 'function' ? value.bind(queries) : value
  },
})
