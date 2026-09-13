## Context

O Azy Board identifica items exclusivamente por UUID (`id`), que é ilegível e difícil de referenciar. Em conversas da equipe, "o card a1b2c3d4-..." é impraticável. Precisamos de um identificador visual curto, humano e único por projeto que facilite comunicação e referência rápida.

O projeto usa Drizzle ORM com SQLite, multi-tenant com `tenant_id` em todas as tabelas, e o schema de items já possui 30 colunas. A feature deve ser backwards-compatible (coluna nullable).

## Goals / Non-Goals

**Goals:**
- Identificador curto por item: prefixo por tipo (E/S/T/B) + sequencial por projeto (ex: E1, S1, T1, B3)
- Gerado automaticamente na criação, sugerindo o próximo número disponível
- Editável pelo usuário (com validação de unicidade por projeto)
- Exibido no card do Kanban e no formulário de item
- Retornado em todas as respostas da API de itens

**Non-Goals:**
- Não implementar "subtask" como tipo separado (subtask é TASK, usa prefixo T)
- Não numerar items existentes automaticamente (ficam sem código até edição manual)
- Não alterar o MCP server (geração é responsabilidade do backend)
- Não implementar busca/filtro por sequenceCode nesta fase

## Decisions

### D1. Armazenamento: coluna nullable na tabela `items`

**Decisão:** Adicionar `sequence_code text` nullable na tabela `items`, com índice único composto `(tenant_id, project_id, sequence_code)`.

**Alternativas consideradas:**
- Tabela separada `item_codes`: Rejeitado. Adicionaria JOIN desnecessário e complexidade.
- Coluna NOT NULL com default: Rejeitado. Não sabemos qual código atribuir a items existentes sem criar conflitos.
- Gerar na migration para items existentes: Rejeitado. Risco de conflitos e comportamento inesperado.

**Rationale:** Coluna nullable é simples, backwards-compatible, e o índice único garante integridade.

### D2. Formato do código: prefixo por tipo + número

**Decisão:** Formato `{PREFIX}{N}` onde PREFIX = E (EPIC), S (STORY), T (TASK), B (BUG), e N = inteiro sequencial iniciando em 1 por projeto.

**Alternativas consideradas:**
- Formato com separador (T-1, T.1): Rejeitado. Mais caracteres, menos limpo.
- Sequencial único por projeto (sem prefixo): Rejeitado. Prefixo por tipo facilita identificação visual.
- Hash curto (tipo Jira AB-123): Rejeitado. Complexo demais para o escopo atual.

### D3. Geração automática: query MAX por prefixo

**Decisão:** Na criação, buscar o maior número existente para o mesmo prefixo no projeto (`SELECT MAX(CAST(SUBSTR(sequence_code, 2) AS INTEGER)) ...`) e incrementar.

**Alternativas consideradas:**
- Contador por projeto em tabela separada: Rejeitado. Adicionaria tabela e transação extra.
- Atomicidade com SELECT FOR UPDATE: Não necessário. SQLite é single-writer; conflitos são resolvidos pelo índice único.

### D4. Edição: validação de unicidade no PATCH

**Decisão:** Permitir editar `sequence_code` via PATCH com validação de formato e unicidade. Conflito retorna 409.

**Rationale:** O usuário pode querer reorganizar a numeração ou corrigir gaps. A unicidade é garantida pelo índice único do banco.

### D5. Display: substituir UUID truncado no card

**Decisão:** No `KanbanCard`, exibir `sequenceCode` quando disponível; caso contrário, manter o UUID truncado como fallback.

**Rationale:** Items existentes sem código continuam visíveis. Novos items mostram o código amigável.

## Risks / Trade-offs

- **[Items sem código]** → Items existentes ficam sem `sequenceCode`. Mitigação: campo nullable, frontend exibe fallback com UUID truncado.
- **[Gaps na numeração]** → Se um item for deletado, o número não é reutilizado. Mitigação: aceitável para manter referências estáveis.
- **[Concorrência na criação]** → Dois users criando items simultaneamente podem tentar o mesmo número. Mitigação: índice único retorna erro 409, backend pode retry.
- **[Query MAX pode ser lenta]** → Para projetos com muitos items. Mitigação: índice em `sequence_code` e a query é simples.

## Migration Plan

1. Criar migration `0020_item-sequence-code.sql` com `ALTER TABLE items ADD COLUMN sequence_code text` e `CREATE UNIQUE INDEX`
2. Deploy do backend (coluna nullable, sem impacto)
3. Deploy do frontend (exibe código quando disponível)
4. Items existentes: sem código, podem ser editados manualmente para adicionar

**Rollback:** Remover coluna e índice via migration reversa. Sem perda de dados.
