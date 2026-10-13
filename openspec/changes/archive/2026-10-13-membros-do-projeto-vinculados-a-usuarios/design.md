# Design

## Context

Ver `proposal.md` — Why. O que o código atual já oferece e restringe o desenho:

- **Schema já vinculado**: `memberships.user_id` referencia `users` com FK por `(tenant_id, user_id)`, índice único por `(tenant_id, project_id, user_id)` e FK opcional para `squads`. Não há migration a fazer.
- **Leitura já vinculada**: `listProjectMembers` faz `innerJoin` com `users`, então a lista atual já exibe dados do usuário — o gap é de fluxo, não de dados.
- **Escrita por e-mail**: `POST /projects/:id/members` recebe `email`, resolve com `identity.findUserByCanonicalEmail` e rejeita com 404 quando não há usuário no tenant (`routes/projects.ts`).
- **Listagem de usuários restrita**: `GET /api/users` exige `requireGlobalGroup('ADMIN')`, então um Gerente que administra o projeto não consegue listar usuários.
- **Regra de administração de projeto**: `requireRole('ADMIN')` usa `authorizeProjectRole`, que exige grupo global ≥ `MANAGER` e vínculo com o projeto (membership ou Gerente Geral), com 404 para projeto restrito sem vínculo.
- **Camadas**: rotas não acessam o banco diretamente — usam portas (`persistence.identity.listUsers`, `persistence.projects.*`), verificadas por `check:persistence`. Há dois adapters (SQLite e PostgreSQL).
- **Web**: o dialog vive em `features/project-settings/components/OrganizationSettingsSections.tsx` com um `<input type="email">`; o projeto não tem dependência de combobox (usa `@radix-ui/react-select` e `<select>` nativos), e `check:bundle` limita o orçamento de bundle.
- **Contratos e docs**: testes de contrato em `apps/web/src/*.test.ts` leem o código-fonte das telas e comparam chaves de i18n; `check:i18n` exige paridade entre pt-BR/en/es; o OpenAPI é gerado por script; a wiki documenta o passo "informe o e-mail".

## Goals / Non-Goals

**Goals:**

- Tornar o cadastro de membros um recorte explícito dos usuários do sistema, com seleção em vez de digitação.
- Manter a membership por projeto como está (é o que sustenta "Restrito" e os papéis por projeto).
- Não quebrar clientes que adicionam membros por e-mail (MCP, agentes, testes existentes).
- Manter o módulo Administração restrito a Admin/Root.

**Non-Goals:**

- Sincronizar automaticamente o cadastro de usuários com a composição de projetos.
- Criar usuários a partir das configurações do projeto ou convidar por e-mail quem não tem conta.
- Alterar squads, a visibilidade de projetos ou o modelo de grupos globais.
- Introduzir dependência nova de UI (combobox) ou mudar o orçamento de bundle.

## Decisions

**1. Endpoint dedicado de candidatos, escopado ao projeto: `GET /projects/:id/member-candidates`.**

Usa o mesmo `requireRole('ADMIN')` de `POST /projects/:id/members`, portanto herda exatamente a regra de administração de projeto já existente (Gerente/Admin/Root com vínculo; 404 para projeto restrito sem vínculo; 403 para Membro de Equipe).

- *Alternativa rejeitada*: reutilizar `GET /api/users`. Exige grupo global Admin, o que deixa o Gerente — que hoje já pode adicionar membros — sem como escolher a pessoa.
- *Alternativa rejeitada*: adicionar `?projectId=` a `GET /api/users`. Mistura escopo de projeto numa rota de administração de tenant e amplia a superfície de listagem de usuários sem vínculo com o projeto.

**2. Retornar todos os usuários do tenant com `isMember`, não só os que não são membros.**

Uma única requisição serve ao seletor e à sinalização de "já é membro"; evita refetch a cada adição e expressa a lista de membros como recorte da lista de usuários, que é o pedido original.

- *Alternativa rejeitada*: retornar apenas não-membros. Mais simples, mas não permite sinalizar quem já é membro nem mostrar o estado completo.

**3. `POST /projects/:id/members` aceita exatamente um entre `userId` e `email`.**

A UI passa a enviar `userId`, eliminando ambiguidade de canonicalização de e-mail. `email` permanece aceito porque a ferramenta de agente `add_member` (`packages/tool-registry/src/fields.ts`) declara `email` como campo obrigatório e a rota é o adaptador local que ela usa; remover o campo seria **BREAKING** para o catálogo MCP e para o e2e atual (`regression.e2e.test.ts`).

- *Alternativa rejeitada*: substituir `email` por `userId`. Quebraria a ferramenta `add_member`, os agentes já configurados e os clientes existentes.

**4. Candidatos compostos na rota a partir de portas existentes, sem novo método de persistência.**

`identity.listUsers` (escopo de tenant via contexto) mais `listProjectMembers` (escopo de projeto) já entregam tudo; a rota cruza por `userId` para calcular `isMember`. Mantém o diff pequeno e evita duplicar SQL nos dois dialetos.

- *Alternativa rejeitada*: novo método `listMemberCandidates` em `ports.ts` e nos dois adapters. Mais código e mais superfície para divergir entre SQLite e PostgreSQL, sem ganho para o volume de usuários de um tenant.

**5. Seletor implementado com input de busca + lista filtrada, sem dependência nova.**

O dialog mantém os selects de papel e squad e troca o campo de e-mail por busca local sobre os candidatos já carregados. Respeita `check:bundle` e o padrão do projeto (Radix Select/`<select>`).

- *Alternativa rejeitada*: adicionar `cmdk`/combobox. Dependência nova para um único caso, com impacto no orçamento de bundle.

**6. `GET /api/users` não é alterado.**

Continua exigindo grupo global Admin. A nova listagem vive no escopo do projeto, o que mantém a fronteira do módulo Administração intacta.

## Risks / Trade-offs

- **[Exposição de dados] Gerentes passam a ver nomes e e-mails de todos os usuários do tenant no seletor.** → Mitigação: mesma regra de administração de projeto já exigida para adicionar membros, escopo restrito ao tenant ativo, conjunto de campos mínimo (`id`, `name`, `email`, `avatarUrl`, `globalGroup`, `isMember`) e nenhuma concessão de acesso ao módulo Administração. O Gerente já podia adicionar qualquer usuário do tenant conhecendo o e-mail.
- **[Compatibilidade] Clientes que enviam `email` não podem regredir.** → Mitigação: manter o caminho por e-mail, cobrir com testes de integração os dois caminhos e manter a rejeição por conflito (409) e por usuário fora do tenant (404).
- **[Testes de contrato] Contratos em `apps/web/src/*.test.ts` leem o fonte das telas e comparam chaves de i18n.** → Mitigação: atualizar os contratos afetados e rodar `check:i18n` e `check:frontend-tests` junto com a mudança.
- **[Documentação] A wiki instrui "informe o e-mail da pessoa".** → Mitigação: atualizar `Gerenciar Membros e Papeis.md` no mesmo trabalho; `check:docs`/`check:i18n-source` validam a integridade.
- **[OpenAPI] A rota nova precisa entrar no documento gerado.** → Mitigação: regenerar o OpenAPI e validar com o script do projeto.
- **[Estado vazio] Tenant com todos os usuários já membros deixa o seletor vazio.** → Mitigação: mensagem explícita de "nenhum usuário disponível" com a confirmação desabilitada, coberta por cenário na spec.

## Migration Plan

- **Sem migration de schema**: o vínculo já existe. A mudança é apenas de código (API + Web + docs).
- **Ordem**: publicar API antes da Web. A Web nova depende do endpoint novo; a API nova é retrocompatível (rota adicional e campo opcional), então uma janela com Web antiga + API nova funciona normalmente.
- **Rollback**: reverter as imagens. O endpoint é aditivo e `POST /members` continua aceitando `email`, então o rollback não deixa dados órfãos nem exige downgrade de schema.
- **Verificação**: em produção, conferir `GET /projects/:id/member-candidates` autenticado como Gerente associado (200 com `isMember`), como Membro de Equipe (403) e adicionar um membro pelo seletor.

## Open Questions

- Exibir o grupo global do usuário ao lado do nome no seletor (ajuda a evitar escolher o grupo errado) ou manter a lista enxuta? Decisão de UI, não altera specs, abordagem nem tarefas.
