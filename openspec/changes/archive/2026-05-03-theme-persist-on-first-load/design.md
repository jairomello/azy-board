## Context

O bloco de inicialização de tema em `main.tsx` (linhas 9-11) usa o operador `??` para ler do `localStorage` ou cair na detecção do SO:

```ts
const savedTheme = localStorage.getItem('theme') ??
  (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
document.documentElement.classList.toggle('dark', savedTheme === 'dark')
```

O problema: quando `localStorage.getItem('theme')` retorna `null`, a preferência do SO é detectada mas **nunca gravada**. Na próxima carga, o mesmo `null` é lido e a preferência do SO é consultada novamente — se mudou, o tema muda junto.

## Goals / Non-Goals

**Goals:**
- Garantir que o tema só muda quando o usuário age explicitamente (toggle)
- Usar a preferência do SO como ponto de partida na primeira visita, mas não continuar seguindo-a

**Non-Goals:**
- Adicionar listener de `prefers-color-scheme` para mudança em tempo real (fora do escopo)
- Mudar o comportamento do `ThemeToggle` ou do `AuthContext` (já corretos)

## Decisions

### Gravar no localStorage imediatamente quando não há entrada salva

**Decisão:** Substituir a expressão `??` por uma estrutura explícita que detecta, salva e aplica:

```ts
let savedTheme = localStorage.getItem('theme')
if (!savedTheme) {
  savedTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  localStorage.setItem('theme', savedTheme)
}
document.documentElement.classList.toggle('dark', savedTheme === 'dark')
```

**Rationale:** Mínima mudança, máximo efeito. Nenhuma outra parte do sistema precisa ser alterada. O `ThemeToggle` já grava no `localStorage` ao ser acionado. O `AuthContext` já grava no `localStorage` ao fazer login. Só faltava travar o valor inicial.

**Alternativa considerada:** Adicionar `addEventListener('change')` no `matchMedia` para seguir o SO em tempo real dentro da sessão. Descartada — vai contra o objetivo de dar controle total ao usuário.

## Risks / Trade-offs

- **Comportamento na primeira visita:** Usuários que já tinham `localStorage['theme']` não são afetados. Novos usuários terão o tema do SO travado após a primeira carga — se quiserem mudar, usam o toggle, exatamente como esperado.
- **Mudança sutil:** Antes, cada abertura sem `localStorage` consultava o SO. Agora, consulta só na primeira abertura. Esse é exatamente o comportamento desejado.
