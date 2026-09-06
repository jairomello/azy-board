# Playbooks

## Bootstrap

Liste projetos, selecione pelo nome confirmado, leia configuração e board. Em projeto novo, crie-o somente com autorização adequada e confirme o modo, colunas e módulo padrão.

## Planejamento

Leia board/árvore, sprint e recursos de planejamento. Escolha card, subtask ou checklist pela independência do trabalho. Em hierarquia, crie EPIC, STORY e depois TASK/BUG; em SIMPLE, crie TASK/BUG diretamente.

## Execução

Liste folhas disponíveis, faça claim, registre contexto técnico, mova o card conforme progresso e registre apenas atividade relevante. Atualize checklist quando os passos forem verificáveis.

## Revisão

Consulte item, logs, checklists, responsáveis, bloqueios e sprint. Use `get_board` ou `get_shadow_markdown` para validar o estado final e registre BUG separado quando a correção tiver ciclo próprio.

## Encerramento

Confirme conclusão com `complete_task`, confira a coluna/status e deixe evidências úteis. Para arquivamento/exclusão, valide o preview e obtenha confirmação antes da mutação.
