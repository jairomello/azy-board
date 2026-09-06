// Preferência de sessão para exibir projetos ocultos.
// Vive em sessionStorage (e não em localStorage nem no banco) porque precisa voltar a
// "não mostrar" no próximo login, sobrevivendo apenas a recarregamentos da mesma sessão.
const CHAVE_PROJETOS_OCULTOS = 'show-hidden-projects'

export function lerMostrarProjetosOcultos(): boolean {
  try {
    return sessionStorage.getItem(CHAVE_PROJETOS_OCULTOS) === 'true'
  } catch {
    // sessionStorage indisponível (SecurityError) — a preferência simplesmente não sobrevive ao reload.
    return false
  }
}

export function gravarMostrarProjetosOcultos(valor: boolean): void {
  try {
    sessionStorage.setItem(CHAVE_PROJETOS_OCULTOS, String(valor))
  } catch {
    // sessionStorage indisponível — o estado em memória do AuthContext continua valendo.
  }
}
