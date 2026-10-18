# Design

Board ref: 5ba05757-4c53-4012-bc84-2d32f936177a

## Context

`GET /projects` aplica `includeHidden` e autorização por tenant/membership. A tabela `projects` possui `isHidden` e `isRestricted`, mas não estado de arquivamento. `ProjectsPage` consulta essa listagem, renderiza cards com editar/excluir/abrir board e mantém os resultados em React Query. A busca de projetos será aplicada aos resultados já carregados. Ver `proposal.md` e `specs/project-management/spec.md`.

## Goals / Non-Goals

**Goals:**
- Adicionar estado persistente de arquivamento e endpoints de arquivar/restaurar com verificação server-side de papel e tenant.
- Preservar os filtros e o comportamento existentes de ocultação/restrição.
- Atualizar a listagem após mutações usando o padrão de invalidação de cache já existente.

**Non-Goals:**
- Arquivar automaticamente itens, sprints ou outros dados pertencentes ao projeto.
- Alterar permissões de acesso ao board por arquivamento; a remoção do card da listagem é a mudança de apresentação planejada.
- Busca remota, indexação ou busca em descrição/campos que não sejam o nome.

## Decisions

1. **Estado próprio no projeto.** Adicionar `isArchived` booleano, default `false`, ao modelo de projeto, persistido nos dois drivers (SQLite e PostgreSQL), exposto nas respostas e coberto por migração compatível. Alternativa: reutilizar `isHidden`; rejeitada porque `isHidden` já representa preferência de visibilidade e pode ser revertido por usuário, enquanto arquivamento é um estado compartilhado e explícito do projeto.

2. **Listagem com filtros ortogonais.** Estender a listagem/persistência para aceitar `includeArchived`; por padrão, excluir arquivados. `includeHidden` continua controlando apenas `isHidden`. A combinação de parâmetros aplica os dois critérios independentemente, além das verificações atuais de membership, restrição e escopo da API Key. Alternativa: criar endpoint separado para arquivados; rejeitada para reaproveitar autorização e projeção da listagem atual.

3. **Operações REST reversíveis.** Expor operações explícitas de arquivar e restaurar sob `/projects/:id`, com `requireRole('ADMIN')`, consulta do projeto via contexto do tenant e alteração somente do estado de arquivamento. Seguir a distinção existente entre exclusão permanente e arquivamento de item, sem cascata para itens do projeto.

4. **UI por estado de listagem.** Adicionar na página de projetos um controle de visualização normal/arquivados, enviando a variante adequada à API e usando chave de cache distinta. Exibir Arquivar para projetos ativos e Restaurar para arquivados apenas em cards administráveis; invalidar as variantes relacionadas após a mutação. O botão de ação deve interromper propagação para não abrir o board.

5. **Busca local por nome.** Aplicar correspondência sem distinção de caixa sobre o nome dos projetos retornados pela consulta atual, após carregamento. Alternativa: parâmetro de busca no backend; não é necessário para o volume/escopo conhecido e adicionaria estado e contrato de API sem benefício definido.

6. **Confirmação apenas ao arquivar.** Confirmar a ação destrutiva reversível com nome do projeto antes de enviar a requisição; restaurar é uma ação direta. Se houver falha, manter o estado anterior e informar erro pelo padrão de toast já usado na página.

## Risks / Trade-offs

- [Risco] Drivers, tipos de domínio e projeções podem divergir e deixar projetos sem `isArchived` em uma variante de banco → atualizar schemas SQLite/PostgreSQL, migrações e testes de paridade na mesma mudança.
- [Risco] A combinação de projetos ocultos e arquivados pode mostrar resultados inesperados → manter parâmetros independentes e cobrir combinações com testes de integração.
- [Risco] Cache da lista normal pode permanecer visível após arquivar/restaurar → invalidar a chave base de projetos que engloba as variantes de visibilidade e arquivamento.
- [Trade-off] Busca local só encontra projetos que a consulta atual carregou → alinhado ao escopo definido; paginação ou volumes que exijam busca remota podem ser tratados separadamente.
- [Risco] Projeto arquivado continua acessível por URL direta → arquivamento é organização da listagem, não bloqueio de autorização; não usar o estado para conceder nem retirar membership.

## Migration Plan

1. Adicionar `is_archived` com default `false` nas migrações dos bancos suportados e atualizar modelos, adapters e projeções.
2. Publicar listagem filtrada e operações de arquivar/restaurar, preservando compatibilidade de clientes existentes: sem `includeArchived`, a listagem exclui projetos arquivados.
3. Publicar a UI com toggle, busca e ações; confirmar em testes que a migração atribui `false` aos projetos existentes.
4. Rollback: reverter aplicação e migração pelo mecanismo de migração do banco; antes de remover a coluna, preservar/exportar quaisquer registros já arquivados, pois a reversão do esquema descartaria esse estado.

## Open Questions

Nenhuma. As escolhas de comportamento necessárias estão explicitadas na proposta e na especificação.
