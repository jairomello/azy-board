## Context

A `CardModal` é o componente central de interação com tasks no EasyBoard. Atualmente expõe campos de edição, tags, tipo e subtask creation, mas não exibe filhos diretos, não identifica o criador do card e não possui histórico de atividades. As três features desta mudança estendem esse componente sem quebrar o contrato atual.

O sistema é multi-tenant com `tenant_id` obrigatório em toda query. Logs automáticos precisam ser gerados em triggers de serviço (não de banco) para respeitar essa arquitetura e poder incluir `user_id` do contexto de requisição.

## Goals / Non-Goals

**Goals:**
- Exibir filhos diretos da task aberta na modal, em grid navegável por empilhamento de modais
- Persistir e exibir `author_id` (criador original) distinto de `assignee_id` (responsável atual)
- Criar sistema de logs de atividade híbrido (automático + manual) com soma de horas trabalhadas
- Manter retrocompatibilidade total: tasks existentes recebem `author_id = null`

**Non-Goals:**
- Logs de auditoria para fins de compliance ou retenção regulatória
- Exibição de netos ou ancestrais na seção de filhos (já coberto pelo breadcrumb e `card-footer-children-indicator`)
- Edição inline de filhos diretos a partir da modal pai
- Notificações ou alertas baseados em logs

## Decisions

### Decisão 1: Stack de modais (empilhar) vs fechar-e-abrir ao navegar para filho

**Escolhido: Stack de modais** — ao clicar em um card filho, a modal do filho abre sobre a modal atual.

**Alternativa descartada**: fechar a modal atual e abrir a do filho — perde o contexto de onde o usuário veio e impede navegação de volta sem reabrir manualmente.

**Implementação**: `useModalStack` hook que mantém um array de `taskId[]`. Cada modal renderizada lê o topo da pilha. Botão "Voltar" (← ícone) no header da modal filho faz pop da pilha. Overlay de fundo com `z-index` incremental garante empilhamento visual correto. Máximo de 5 níveis de profundidade para evitar stack overflow visual.

### Decisão 2: Armazenamento de logs — tabela dedicada vs campo JSON na task

**Escolhido: Tabela dedicada `task_logs`**

Razões: volume de logs pode crescer indefinidamente; queries de soma de horas são triviais em SQL (`SUM(duration_minutes)`); indexação por `task_id + created_at` é direto; sem limite de tamanho de coluna.

**Alternativa descartada**: JSON em coluna `logs` na tabela `tasks` — sem suporte a agregações SQL nativas, problemas de concorrência em updates, dificulta paginação.

**Schema `task_logs`:**
```
id            UUID PK
tenant_id     UUID NOT NULL  -- [TENANT]
task_id       UUID FK tasks.id ON DELETE CASCADE
author_id     UUID FK users.id
type          ENUM('auto', 'manual')
activity      TEXT NOT NULL   -- descrição da atividade
duration_min  INTEGER NULL    -- apenas logs manuais
created_at    TIMESTAMPTZ DEFAULT now()
updated_at    TIMESTAMPTZ DEFAULT now()
```

### Decisão 3: Geração de logs automáticos — trigger de banco vs camada de serviço

**Escolhido: Camada de serviço** — funções wrapper `loggedUpdate(task, changes, userId)` e `loggedMove(task, newColumn, userId)` chamadas explicitamente nos handlers Hono existentes.

**Razão**: triggers de banco não têm acesso ao `user_id` do contexto HTTP; a geração na camada de serviço permite incluir quem fez a ação, respeitar `tenant_id` e testar unitariamente.

### Decisão 4: Campo `author_id` — preenchimento retroativo vs null

**Escolhido: null para tasks existentes** — migration não tenta preencher retroativamente.

**Razão**: não há como determinar com certeza quem criou tasks antigas a partir dos dados existentes. Exibir "Autor desconhecido" é mais honesto que uma inferência potencialmente errada.

### Decisão 5: UX de acesso ao histórico — botão inline vs aba vs ícone no header

**Escolhido: Botão "Histórico" no rodapé da modal** (acima da seção de filhos), abrindo sub-modal `ActivityLogModal`.

**Razão**: abas aumentam a altura mínima da modal; ícone isolado no header é pouco descobrível; botão textual com ícone de relógio (🕐) é claro e não polui o fluxo principal. A sub-modal exibe dados mínimos do card (título, ID) + lista de logs + botão "+ Registrar" e lápis nos manuais.

## Risks / Trade-offs

- **Stack de modais e memória**: muitos níveis empilhados podem degradar performance em hierarquias profundas → Mitigação: limite de 5 níveis; após isso, substituir o topo em vez de empilhar.
- **Volume de logs automáticos**: em projetos ativos com muitos agentes de IA gerando ações, a tabela `task_logs` pode crescer rapidamente → Mitigação: paginação na listagem de logs (20 por página); sem retenção automática no MVP.
- **Concorrência em soma de horas**: múltiplos usuários inserindo logs simultâneos não geram conflito pois são linhas independentes → sem mitigação necessária.
- **Migration em banco grande**: adicionar `author_id` em tabela `tasks` com muitos registros requer `ALTER TABLE` potencialmente lento em PostgreSQL → Mitigação: usar `ADD COLUMN ... DEFAULT NULL` (operação online no Postgres 11+).

## Migration Plan

1. Executar migration: `ALTER TABLE tasks ADD COLUMN author_id UUID REFERENCES users(id)` — tasks existentes ficam com `null`
2. Executar migration: `CREATE TABLE task_logs (...)` com todos os campos e índices
3. Deploy do backend com novos endpoints e lógica de log automático
4. Deploy do frontend com `CardModal` atualizado
5. Rollback: remover coluna `author_id` e dropar tabela `task_logs` (sem impacto em dados existentes de negócio)

## Open Questions

- Logs automáticos devem ser deletáveis por ADMIN? (por ora: não, logs auto são imutáveis e permanentes)
- A soma de horas trabalhadas deve aparecer também no card do Kanban (fora da modal)? (por ora: não, apenas na modal)
