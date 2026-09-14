// [TENANT] E-mail canônico: lowercase + trim. Mantém paridade com a unicidade
// por tenant e com o saneamento da migration de integridade.
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}
