## Why

A tela de login atual deixa o card muito próximo das bordas verticais da área disponível. A referência visual mostra um card menor e claramente centralizado, com respiro equilibrado acima e abaixo, tornando a composição mais leve e consistente em telas desktop.

## What Changes

- Reduzir a altura visual ocupada pelo card de login em desktop sem alterar o conteúdo ou o fluxo de autenticação.
- Centralizar verticalmente o card dentro da viewport, mantendo margens mínimas responsivas em mobile e tablet.
- Ajustar o painel do formulário e o painel institucional para que tenham altura natural compartilhada, sem esticar o formulário desnecessariamente.
- Preservar o comportamento atual de overflow em telas menores e a estrutura preparada para fundo futuro.

## Capabilities

### New Capabilities

- `login-card-vertical-position`: Controle responsivo da altura e do posicionamento vertical do card de login.

### Modified Capabilities

Nenhuma.

## Impact

- `apps/web/src/pages/LoginPage.tsx`, principalmente o wrapper da viewport e o grid do card.
- Classes responsivas de Tailwind relacionadas a altura, padding, alinhamento e overflow.
- Nenhuma alteração na API, banco de dados, autenticação ou dependências.
