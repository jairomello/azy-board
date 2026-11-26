// Retorno pós-login: aceita só caminhos internos da aplicação. Recusa barra
// invertida e caracteres de controle (o navegador descarta tab/quebra de linha,
// e "/\t/host" viraria "//host") e confirma que o caminho resolve na própria
// origem, para o parâmetro `redirect` nunca levar o usuário para fora.
const PROBE_ORIGIN = 'http://azyboard.invalid'

export function internalRedirect(value: string | null | undefined): string | null {
  if (!value || !value.startsWith('/')) return null
  // biome-ignore lint/suspicious/noControlCharactersInRegex: caracteres de controle são exatamente o que se recusa
  if (/[\x00-\x1f\x7f\\]/.test(value)) return null
  try {
    if (new URL(value, PROBE_ORIGIN).origin !== PROBE_ORIGIN) return null
  } catch {
    return null
  }
  return value
}
