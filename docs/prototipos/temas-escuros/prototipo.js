// Apenas a demonstração alterna a classe usada pelo tema atual do aplicativo.
const botao = document.querySelector('#alternar-tema')
botao.addEventListener('click', () => {
  const escuro = document.documentElement.classList.toggle('dark')
  botao.textContent = escuro ? '☀  Modo claro' : '☾  Modo escuro'
  botao.setAttribute('aria-label', escuro ? 'Alternar para modo claro' : 'Alternar para modo escuro')
})
