## Context

O Board possui estado local distribuído: filtros já usam `board-filters:<projectId>`, lanes recolhidas usam chaves próprias e densidade usa a chave global `board-density`. O modo Kanban/árvore e o módulo ativo não são persistidos. A mudança deve consolidar preferências sem introduzir estado no backend ou compartilhar contexto entre projetos.

## Goals / Non-Goals

**Goals:**

- Restaurar o mesmo contexto visual ao reentrar em cada projeto.
- Manter filtros de conteúdo e opções de visualização independentes por projeto.
- Evitar flash do padrão e sobreviver a dados removidos ou storage indisponível.
- Preservar compatibilidade com estado já salvo.

**Non-Goals:**

- Sincronizar preferências entre dispositivos ou usuários.
- Persistir itens selecionados, texto de busca temporário, modais abertos ou dados do Board.
- Alterar filtros, regras de negócio, permissões ou API.

## Decisions

### Uma chave de preferências por projeto

Usar `board-view-state:<projectId>` para `view`, `density` e `activeModuleId`, mantendo `board-filters:<projectId>` e as chaves de colapso existentes durante a transição. A densidade antiga `board-density` será usada somente como fallback inicial e migrada para o projeto atual quando possível. Isso evita colisões entre projetos sem invalidar instalações existentes.

### Leitura segura e normalização

Criar helpers puros para ler JSON, validar enums, normalizar arrays e descartar referências inexistentes após os catálogos carregarem. Um campo inválido não deve apagar os demais campos válidos. Falhas de `SecurityError` são absorvidas como estado padrão.

### Escrita controlada

Um efeito por estado persistido gravará somente depois da inicialização do projeto, evitando que defaults sobrescrevam uma preferência antes da restauração. Troca de `projectId` deve criar novo estado inicial a partir da chave do novo projeto, sem reaproveitar closures do projeto anterior.

### Compatibilidade

O formato salvo terá `version` numérica para permitir evolução. Estados sem versão serão tratados como versão inicial. `showStories` legado continuará sendo ignorado conforme a regra existente, e filtros inválidos serão limpos apenas depois que o catálogo correspondente estiver carregado.

## Risks / Trade-offs

- **Storage limitado ou bloqueado** → fallback silencioso ao padrão e nenhum erro visível.
- **Preferência aponta para módulo removido** → limpar somente `activeModuleId` após validar módulos.
- **Defaults sobrescrevem estado restaurado** → flag de hidratação por projeto antes de habilitar efeitos de gravação.
- **Chaves legadas divergentes** → prioridade explícita para a chave por projeto e migração somente como fallback.

## Migration Plan

1. Adicionar helpers e testes de serialização/normalização.
2. Hidratar filtros, view, densidade, módulo e colapsos por projeto.
3. Gravar alterações sob chaves por projeto, mantendo leitura legada.
4. Validar troca de projetos, storage corrompido, catálogos removidos e navegação direta.
5. Rollback: remover a nova chave e helpers; preservar as chaves antigas e o comportamento anterior.

## Open Questions

Nenhuma questão bloqueante. A densidade global existente será mantida como fallback, mas novas gravações serão vinculadas ao projeto atual.
