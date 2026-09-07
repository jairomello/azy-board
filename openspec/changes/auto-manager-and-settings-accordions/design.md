## Context

A `SettingsPage` atual renderiza 10 seções empilhadas (Formato do board, Visibilidade, Planejamento, Colunas, Gerente, Membros & Squads, Centros de Custo, Módulos, Sprints, Versões) sem qualquer comportamento colapsável. O sistema já possui um padrão de accordions maduro (`AccordionSection`, `AccordionToolbar`, `AccordionSummary`) usado em `ItemModal`, `EpicModal` e `StoryModal`, com estado baseado em `Set<string>`, botões "Expandir tudo"/"Recolher tudo" e acessibilidade via `aria-expanded`/`aria-controls`.

Na criação de projeto, o campo `managerUserId` é opcional e o fallback atual é `null`, deixando projetos sem gerente. O `ctx.userId` está disponível no contexto da requisição e o criador já se torna ADMIN automaticamente via membership.

## Goals / Non-Goals

**Goals:**
- Atribuir automaticamente `ctx.userId` como `managerUserId` quando o campo não for informado na criação de projeto.
- Migrar todas as seções da `SettingsPage` para o padrão de accordion existente (`AccordionSection` + `AccordionToolbar`).
- As duas primeiras seções iniciam abertas por padrão; as demais iniciam fechadas.
- A seção "Módulos" (condicional para HIERARCHICAL) participa do sistema de accordions quando visível.

**Non-Goals:**
- Alterar o comportamento de alteração de gerente após criação (PATCH já funciona).
- Persistir estado de accordions entre sessões (stateless por carregamento de página).
- Alterar a lógica interna de cada seção — apenas envolver cada uma em `AccordionSection`.
- Alterar ferramentas MCP ou contexto do agente (sem impacto).

## Decisions

### 1. Fallback de managerUserId no backend

**Decisão**: Alterar `managerUserId: body.managerUserId ?? null` para `managerUserId: body.managerUserId ?? ctx.userId` na rota `POST /projects`.

**Alternativa considerada**: Fazer o fallback no frontend (enviar `ctx.userId` explicitamente). Rejeitada porque: (a) cria dependência do frontend para uma regra de negócio; (b) não protege contra criações via MCP/API direta; (c) o backend já tem `ctx.userId` disponível.

**Racional**: O criador já se torna ADMIN do projeto no mesmo transaction. Atribuí-lo como gerente é consistente e não introduz risco de segurança — o `ctx.userId` é resolvido pelo middleware de autenticação.

### 2. IDs das seções do accordion

**Decisão**: Usar IDs kebab-case descritivos para cada seção:
1. `board-format` — Formato do board
2. `visibility` — Visibilidade do projeto
3. `planning` — Planejamento
4. `columns` — Colunas
5. `manager` — Gerente Geral do Projeto
6. `members-squads` — Membros & Squads
7. `cost-centers` — Centros de Custo
8. `modules` — Módulos (condicional)
9. `sprints` — Sprints
10. `versions` — Versões

**Racional**: IDs estáticos e previsíveis facilitam testes e deep-linking futuro. A ordem reflete a posição atual na página.

### 3. Estado inicial dos accordions

**Decisão**: Inicializar `openSections` com `new Set(['board-format', 'visibility'])` — as duas primeiras seções abertas.

**Racional**: Formato do board e Visibilidade são as configurações mais fundamentais do projeto. Planejamento (3ª seção) e as demais são complementares e podem ser exploradas sob demanda.

### 4. Seção condicional "Módulos"

**Decisão**: A seção "Módulos" só aparece no array `sectionIds` quando `boardMode === 'HIERARCHICAL'`. O `AccordionToolbar` recebe dinamicamente os IDs visíveis.

**Alternativa considerada**: Sempre incluir `modules` no array e esconder via CSS. Rejeitada porque poluiria o toolbar com uma seção inexistente.

## Risks / Trade-offs

- **[Performance do mount/unmount]** → O accordion atual usa mount/unmount (condicional `{isOpen && ...}`). Isso significa que estados internos de formulários não submetidos serão perdidos ao colapsar. Mitigação: este é o comportamento já aceito nos modais de item; os dados são persistidos via API ao salvar.
- **[Mudança visual inesperada]** → Usuários acostumados com a página longa podem estranhar o novo comportamento. Mitigação: o toolbar "Expandir tudo" permite reverter instantaneamente.
- **[Compatibilidade com MCP]** → A mudança de `managerUserId` fallback é transparente para o MCP — o campo já é opcional e o servidor decide o valor. Sem breaking change.
