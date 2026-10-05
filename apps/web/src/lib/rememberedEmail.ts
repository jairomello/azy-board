// Card T31: e-mail lembrado por dispositivo para pré-preencher o login.
// Nunca guarda a senha nem o token (o cookie de sessão é HttpOnly).

const CHAVE = 'azy-board:remembered-email'

export function lerEmailLembrado(): string {
  try {
    return localStorage.getItem(CHAVE) ?? ''
  } catch {
    return ''
  }
}

export function gravarEmailLembrado(email: string): void {
  try {
    localStorage.setItem(CHAVE, email)
  } catch {
    // Armazenamento indisponível: seguir sem lembrar o e-mail.
  }
}

export function limparEmailLembrado(): void {
  try {
    localStorage.removeItem(CHAVE)
  } catch {
    // Armazenamento indisponível: nada a limpar.
  }
}
