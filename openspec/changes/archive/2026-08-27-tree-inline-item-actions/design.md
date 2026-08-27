## Context

A Tree View já renderiza a hierarquia de módulos e itens e possui edição inline limitada de alguns campos. A criação e a edição completa, porém, ficam acessíveis por fluxos fora da árvore. A mudança deve reutilizar os fluxos existentes de criação e a `ItemModal`, preservando o modelo unificado em `/projects/:id/items`, a regra de hierarquia e as permissões server-side.

## Goals / Non-Goals

**Goals:**

- Tornar as ações de inclusão descobríveis e acessíveis no contexto da árvore.
- Oferecer ações de criação compatíveis com o tipo do nó e preencher o pai automaticamente quando houver.
- Abrir a modal completa de edição a partir de cada linha e refletir o resultado na árvore.
- Manter acessibilidade, estados de carregamento/erro e atualização por realtime já usados pelo produto.

**Non-Goals:**

- Criar novos endpoints, tabelas ou dependências.
- Alterar regras de tipos, vínculos parentais ou permissões existentes.
- Substituir a edição inline de título e responsável já especificada para a árvore.

## Decisions

- **Ações no cabeçalho e nas linhas:** manter um botão geral de inclusão para itens de topo e um conjunto contextual de ações na linha selecionada. Isso evita poluir todas as linhas e mantém explícito onde o novo item será criado.
- **Reutilizar modais existentes:** os botões devem abrir o modal de criação correspondente já usado pela toolbar, passando `parentId` e `moduleId` derivados do nó quando aplicável. Para edição, a ação deve abrir a `ItemModal`/modal específica já existente, em vez de criar uma segunda implementação.
- **Permissões como fonte única:** a Tree View apenas oculta ou desabilita ações conforme o papel conhecido no frontend; a API continua responsável pela autorização final e pela validação da hierarquia. Assim, ações diretas não criam um novo caminho de segurança.
- **Recarregar a árvore após mutação:** após criação ou salvamento, invalidar/refazer a consulta da árvore e preservar expansão e filtros sempre que possível. Eventos realtime continuam sendo tratados pelo mecanismo existente para sincronizar outros clientes.
- **Ações acessíveis:** cada ação terá `aria-label`, foco por teclado e tooltip/label textual; o botão de editar ficará na coluna de ações e não acionará expansão ou seleção da linha.

Alternativas consideradas: duplicar formulários específicos dentro da árvore, rejeitado por criar divergência com os modais atuais; adicionar endpoints dedicados à árvore, rejeitado porque o CRUD unificado já atende ao caso.

## Risks / Trade-offs

- **[Contexto pai inválido ou desatualizado]** → API valida o pai e o frontend exibe erro sem fechar silenciosamente o modal.
- **[Conflito entre clique na linha e clique na ação]** → interromper a propagação dos eventos dos botões e cobrir o comportamento com testes de interação.
- **[Árvore perder estado após atualização]** → capturar nós expandidos e filtros antes da invalidação e restaurá-los após a nova resposta.
- **[Viewer visualizar ações indevidas]** → não renderizar ações mutáveis para Viewer e manter a rejeição server-side como proteção definitiva.

## Migration Plan

1. Implementar as ações usando as APIs e modais existentes.
2. Validar criação, edição, permissões, hierarquia e preservação do estado em testes automatizados.
3. Publicar sem migração de banco; rollback consiste em remover/ocultar as ações da Tree View.

## Open Questions

Nenhuma questão bloqueante identificada; o comportamento deve seguir os modais e permissões já existentes.
