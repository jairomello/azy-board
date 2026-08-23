## Context

O Azy Board já autentica humanos e possui perfis de membership dentro de cada projeto, mas ainda não define um papel global do usuário nem um limite consistente para navegação, APIs e consultas. A aplicação é multi-tenant, portanto o papel global deve ser interpretado dentro dos tenants associados e nunca permitir acesso cruzado. A mudança atravessa banco, sessão, middleware, APIs e frontend.

## Goals / Non-Goals

**Goals:**

- Definir os grupos globais cumulativos `TEAM_MEMBER`, `MANAGER`, `ADMIN` e `ROOT`.
- Centralizar autorização server-side e derivar o escopo de projeto a partir do grupo.
- Disponibilizar administração de usuários no tenant para Admin, sem delegação de Root.
- Preservar os papéis de membership como permissões específicas dentro do projeto, subordinadas ao escopo global.
- Garantir que a UI esconda controles indisponíveis, sem usar a UI como mecanismo de segurança.

**Non-Goals:**

- Implementar parametrização global, administração de tenants ou outras funções futuras do Root.
- Criar fluxo de convite, recuperação de senha ou gestão de múltiplos tenants além do necessário para autorização.
- Remover os papéis existentes de membership (`ADMIN`, `MEMBER`, `VIEWER`).

## Decisions

- **Papel global persistido no usuário:** adicionar um campo enumerado com valor padrão `TEAM_MEMBER`; isso mantém a autoridade fora do cliente e permite incluir o grupo na identidade autenticada. Uma tabela de permissões genéricas foi descartada por ser mais complexa que os quatro níveis fixos desta etapa.
- **Ordem explícita de privilégio:** representar a precedência em um único mapa server-side (`TEAM_MEMBER < MANAGER < ADMIN < ROOT`) e usar predicados de nível para autorizações cumulativas. Comparações textuais ou baseadas em ordem de enumeração do banco foram descartadas por serem frágeis.
- **Escopo de projetos:** `TEAM_MEMBER` e `MANAGER` consultam somente memberships ativas; `ADMIN` consulta todos os projetos do tenant; `ROOT` recebe o mesmo acesso operacional de Admin nesta etapa, sem endpoints globais novos. Toda consulta continua usando `withTenant` e filtros de identidade quando o recurso exigir membership.
- **Mutações de grupo:** somente Admin e Root podem alterar grupos, mas uma operação iniciada por Admin rejeita qualquer destino Root, inclusive alteração em si mesmo. Root pode atribuir qualquer grupo existente, mas não ganha telas globais nesta mudança. O servidor valida o grupo alvo e o tenant do usuário antes de persistir.
- **Autorização em duas camadas:** middleware protege endpoints por nível global e handlers aplicam membership/papel do projeto. O frontend usa os mesmos dados para navegação condicional, mas nunca é considerado fonte de autorização.
- **Sessão após alteração:** alterações de grupo invalidam ou renovam a sessão do usuário afetado para que o JWT não mantenha privilégios antigos; o backend consulta o papel persistido em operações sensíveis. Isso evita depender de logout manual.
- **Seed determinístico:** o setup de desenvolvimento localiza `jairo.silva@ntconsult.com.br` no tenant de teste e define `ROOT`, mantendo a senha fornecida por variável de ambiente e armazenada somente como hash.

## Risks / Trade-offs

- [JWT pode conter papel antigo] -> validar papel persistido no backend em endpoints administrativos e renovar a sessão após mudanças.
- [Filtro incompleto pode expor projeto de outro tenant] -> exigir `withTenant(tenantId)` em toda query e cobrir endpoints com testes de isolamento.
- [Ocultar menu não impede acesso direto] -> proteger rotas e APIs server-side e retornar 403/404 conforme a existência do recurso.
- [Conflito entre grupo global e papel de projeto] -> aplicar primeiro o escopo global e depois o papel de membership; documentar que nenhum papel local amplia o escopo do grupo.

## Migration Plan

1. Adicionar o campo de grupo com default `TEAM_MEMBER` e migrar dados existentes sem ampliar privilégios silenciosamente.
2. Atualizar seed/setup para promover o usuário de teste a `ROOT`.
3. Publicar middleware, endpoints e filtros; validar sessões existentes e renovar o JWT conforme necessário.
4. Publicar a interface de Administração e controles condicionais de projetos.
5. Em caso de rollback, desabilitar as rotas de Administração e manter o campo persistido; restaurar o comportamento anterior somente com uma decisão explícita, pois a reversão pode reabrir dados.

## Open Questions

- A associação de um usuário a múltiplos tenants e a seleção do tenant ativo precisarão de uma regra própria quando a administração de tenants for implementada.
- O comportamento de exclusão/desativação de um usuário administrado não faz parte desta etapa e deve ser definido antes de ser exposto.
