// Política mínima de senha de conta, compartilhada pela API (createUserSchema)
// e pelos scripts de setup/seed. Não revalida senhas existentes no login.

const MIN_LENGTH = 8

// Lista curta de senhas comuns/triviais. Não substitui um verificador de vazamentos.
const COMMON_PASSWORDS = new Set([
  'password',
  'password1',
  'passw0rd',
  '12345678',
  '123456789',
  '1234567890',
  'qwerty123',
  'qwertyuiop',
  'admin123',
  'administrador',
  'changeme',
  'letmein1',
  'iloveyou',
  'senha123',
  'azyboard',
  'azyboard123',
])

export const PASSWORD_MIN_LENGTH = MIN_LENGTH

/** Retorna a lista de violações da política (vazia quando a senha é aceitável). */
export function passwordPolicyIssues(password: string, email?: string | null): string[] {
  const issues: string[] = []
  if (password.length < MIN_LENGTH) issues.push(`Mínimo de ${MIN_LENGTH} caracteres`)
  if (/^(.)\1+$/.test(password)) issues.push('Não use um único caractere repetido')

  const normalized = password.toLowerCase()
  if (COMMON_PASSWORDS.has(normalized)) issues.push('Senha muito comum')

  const canonicalEmail = email?.trim().toLowerCase()
  if (canonicalEmail) {
    const localPart = canonicalEmail.split('@')[0] ?? ''
    if (normalized === canonicalEmail || (localPart.length >= 3 && normalized === localPart)) {
      issues.push('A senha não pode ser igual ao e-mail')
    }
  }

  return issues
}

/** Lança erro com mensagem explícita quando a senha viola a política (uso em CLI). */
export function assertPasswordPolicy(password: string, email?: string | null): void {
  const issues = passwordPolicyIssues(password, email)
  if (issues.length > 0) throw new Error(`Senha não atende à política: ${issues.join('; ')}.`)
}
