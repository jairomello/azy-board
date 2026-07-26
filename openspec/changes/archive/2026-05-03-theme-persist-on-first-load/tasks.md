## 1. Travar tema no localStorage na primeira carga

- [x] 1.1 Em `apps/web/src/main.tsx`, substituir a expressão `??` por bloco `if (!savedTheme)` que detecta a preferência do SO e a grava imediatamente em `localStorage.setItem('theme', savedTheme)` antes de aplicar a classe no `<html>`
