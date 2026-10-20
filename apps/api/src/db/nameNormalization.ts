// change member-batch-add-grid — normalização de nome para busca e ordenação de pessoas.
//
// A grade de candidatos a membro pagina no banco, então a ordem precisa ser estável entre
// páginas. SQLite não expõe collation pt-BR (o `lower()` embutido só dobra ASCII) e o
// PostgreSQL varia com a collation do servidor, então a ordem é construída por um dobrador
// de acentos explícito: `replace()` aninhado sobre o nome, seguido de `lower()`. Assim
// "Álvaro" fica perto de "Alvaro" em vez de ir para o fim da lista, com o mesmo resultado
// nos dois drivers.
//
// A mesma dobra é usada na busca: sem ela, procurar "alvaro" não encontraria "Álvaro" no
// SQLite (o `lower()` de lá não dobra acentos) — regressão em relação ao filtro anterior,
// que normalizava o nome com `toLocaleLowerCase('pt-BR')` no cliente.
//
// Módulo puro e compartilhado entre os adapters SQLite e PostgreSQL.

/** Pares (base, acentuadas) usados tanto no SQL quanto no termo de busca. */
const ACCENT_FOLD: ReadonlyArray<readonly [string, string]> = [
  ['a', 'áàâãäå'],
  ['e', 'éèêë'],
  ['i', 'íìîï'],
  ['u', 'úùûü'],
  ['o', 'óòôõö'],
  ['c', 'ç'],
  ['n', 'ñ'],
  ['y', 'ýÿ'],
]

// Identificador de coluna aceito no fragmento SQL: só referência simples/qualificada.
const COLUMN_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)?$/

const sortKeyCache = new Map<string, string>()

/**
 * Expressão SQL que normaliza a coluna de nome para ordenação/busca: dobra os acentos
 * listados (maiúsculas e minúsculas) e aplica `lower()`. O mesmo texto roda em SQLite e
 * PostgreSQL; a coluna é validada antes de entrar no fragmento.
 */
export function nameSortKeySql(column: string): string {
  if (!COLUMN_PATTERN.test(column)) throw new Error(`Coluna inválida para ordenação de nome: ${column}`)
  const cached = sortKeyCache.get(column)
  if (cached) return cached
  let expression = column
  for (const [base, accented] of ACCENT_FOLD) {
    for (const character of accented) {
      expression = `replace(${expression}, '${character}', '${base}')`
      expression = `replace(${expression}, '${character.toUpperCase()}', '${base}')`
    }
  }
  const key = `lower(${expression})`
  sortKeyCache.set(column, key)
  return key
}

/** Mesma dobra de acentos do SQL, aplicada em JS ao termo digitado pelo usuário. */
export function foldNameForSearch(value: string): string {
  let folded = value
  for (const [base, accented] of ACCENT_FOLD) {
    for (const character of accented) {
      folded = folded.split(character).join(base)
      folded = folded.split(character.toUpperCase()).join(base)
    }
  }
  return folded.toLowerCase()
}

/**
 * Padrão `LIKE` de "contém", escapando os curingas do termo. Usar junto de
 * `LIKE ? ESCAPE '\'`.
 */
export function likeContainsPattern(term: string): string {
  const escaped = term.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
  return `%${escaped}%`
}
