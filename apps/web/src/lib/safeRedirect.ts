// Retorno pós-login: aceita só caminhos internos da aplicação. Começar com "/"
// e não com "//" (nem "/\\", que o navegador também trata como outro host)
// impede que o parâmetro `redirect` leve o usuário para fora da instalação.
export function internalRedirect(value: string | null | undefined): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return null
  return value
}
