# Playbooks

## Bootstrap

Liste projetos, selecione pelo nome confirmado, leia configuração e board. Em projeto novo, crie-o somente com autorização adequada e confirme o modo, colunas e módulo padrão.

## Planejamento

Leia board/árvore, sprint e recursos de planejamento. Escolha card, subtask ou checklist pela independência do trabalho. Em hierarquia, crie EPIC, STORY e depois TASK/BUG; em SIMPLE, crie TASK/BUG diretamente.

## Rastreamento da codebase

Quando `AZYBOARD_PROJECT_ID` estiver configurada no MCP, considere o board o espaço de acompanhamento da codebase. Antes de uma tarefa relevante, pergunte se o usuário deseja um card, exceto quando houver preferência explícita na sessão. Verifique cards existentes antes de criar. Para uma tarefa única, crie ou mova o card atual para `IN_PROGRESS`; para várias tarefas, deixe as seguintes em `NOT_STARTED`.

Para trabalho demorado ou com vários passos verificáveis, pergunte se deve criar checklist. Registre passos da mesma unidade com `create_checklist` e `add_checklist_item`, marcando-os com `check_item` durante a execução. Use subtask em vez de checklist quando o passo tiver responsável, estimativa ou ciclo Kanban próprio.

## Execução

Liste folhas disponíveis, faça claim, registre contexto técnico, mova o card conforme progresso e registre apenas atividade relevante. Atualize checklist quando os passos forem verificáveis.

## Revisão

Consulte item, logs, checklists, responsáveis, bloqueios e sprint. Use `get_board` ou `get_shadow_markdown` para validar o estado final e registre BUG separado quando a correção tiver ciclo próprio.

## Encerramento

Confirme conclusão com `complete_task`, confira a coluna/status e deixe evidências úteis. Para arquivamento/exclusão, valide o preview e obtenha confirmação antes da mutação.
