## Why

Atualmente, ao recarregar o board ou navegar para outra página e voltar, todos os filtros aplicados são perdidos. Usuários que trabalham focados em uma squad, épico, história ou nas próprias tarefas precisam reaplicar os filtros a cada sessão — fricção desnecessária que atrapalha o fluxo de trabalho.

## What Changes

- O estado de filtros do board (squad, módulo, sprint, responsável, tipos, tags, toggles) passa a ser persistido no `localStorage` por chave `board-filters:<projectId>`.
- Ao abrir o board, os filtros são restaurados a partir do `localStorage` automaticamente.
- Os filtros persistidos só são removidos quando o usuário clica explicitamente em "Limpar filtros".
- Filtros de projetos diferentes são armazenados independentemente.

## Capabilities

### New Capabilities
- `board-filters-persistence`: Persistência e restauração automática do estado de filtros do board via localStorage, com escopo por projeto.

### Modified Capabilities
- `board-filters`: Adiciona requisito de persistência ao ciclo de vida dos filtros — leitura inicial do localStorage e escrita a cada mudança de filtro.

## Impact

- **Frontend**: `BoardPage.tsx` (ou hook de filtros) — inicialização do estado lendo do `localStorage` e efeito de escrita a cada mudança de filtro.
- **Sem impacto em backend, API ou banco de dados** — mudança puramente client-side.
- **Sem novas dependências** — `localStorage` é nativo do browser.
