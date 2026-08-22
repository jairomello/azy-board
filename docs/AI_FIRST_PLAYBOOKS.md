# Playbooks AI First

Este documento descreve fluxos genéricos para um code agent operar o Azy Board
por MCP. Não contém URLs, tokens, hosts ou detalhes de infraestrutura.

## Bootstrap

1. Use `list_projects` para verificar se o projeto já existe.
2. Use `create_project` informando nome, descrição e `boardMode`.
3. Use `get_project` e `get_board` para confirmar modo, colunas e contexto.
4. Em projeto `HIERARCHICAL`, crie módulos e organize EPIC → STORY → TASK.
5. Em projeto `SIMPLE`, crie TASKs/BUGs diretamente; a STORY fixa é automática.

## Planejamento

1. Leia `get_board` ou `get_tree` antes de criar itens.
2. Consulte `list_columns`, `list_sprints`, `list_tags` e `list_versions`.
3. Crie ou atualize os recursos de planejamento necessários.
4. Escolha TASK/BUG, subtask ou checklist conforme a independência do trabalho.
5. Use `get_shadow_markdown` quando uma visão textual for melhor para análise.

## Execução

1. Use `list_tasks` com filtros de status, responsável, sprint, tags ou coluna.
2. Use `claim_task` antes de iniciar uma tarefa atribuível.
3. Use `update_item` para registrar campos, responsável e contexto técnico.
4. Use `move_task` ou `complete_task` para atualizar o fluxo.
5. Use `create_item_log` para registrar progresso relevante.
6. Use checklist para passos verificáveis que não precisam de card próprio.

## Revisão

1. Consulte o item e seus logs/checklists.
2. Verifique cards bloqueados, responsáveis e sprint atual.
3. Use `get_board` para confirmar o estado final.
4. Registre bugs como `BUG` quando houver trabalho independente de correção.

## Encerramento

1. Confirme que os cards foram concluídos ou explicitamente arquivados.
2. Consulte a versão e a sprint associadas.
3. Use `dryRun` antes de exclusões ou arquivamentos em cascata.
4. Execute a ação destrutiva somente após validar o preview.

## Regras Operacionais

- Nunca reutilize um ID de entidade sem confirmar o `projectId` atual.
- Não repita automaticamente uma operação após `CONFLICT`.
- Use `idempotencyKey` em criações e lotes que possam ser reenviados.
- Trate `retryable=false` como erro definitivo até corrigir a entrada.
- Upload de arquivos via MCP não está disponível nesta versão.
