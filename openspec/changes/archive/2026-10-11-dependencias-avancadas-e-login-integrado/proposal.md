# Proposal

## Why

O board já modela o cadastro de dependências entre itens (T46), mas o modelo ainda não sustenta cronograma de verdade: não existe um tipo próprio para dependências que não são trabalho da equipe, as datas não são recalculadas a partir do grafo, não há caminho crítico, o alvo é restrito ao mesmo projeto e os agentes (MCP/Azy Agent) não têm acesso ao grafo. Em paralelo, a autenticação é fixa em e-mail e senha, o que impede instalações corporativas que exigem login integrado com Microsoft EntraID ou Google.

## What Changes

- Novo tipo de item **dependência externa** (`EXTERNAL`), com o mesmo formulário da task, usado para registrar trabalho de terceiros/outra equipe que destrava o projeto e como alvo legítimo no grafo de dependências. Tradução PT-BR "Dep. Externa" e EN "Ext. Dependence".
- Integração das dependências (T46) com o tipo `EXTERNAL`: dependências podem apontar para itens desse tipo e tratá-los como alvos válidos no grafo.
- **Replanejamento automático de datas** por ação explícita do usuário (botão), recalculando início/fim dos itens não concluídos conforme os tipos FS/SS/SF/FF e o retardo, no estilo MS Project, sem recalcular a cada edição.
- **Cálculo de caminho crítico** a partir do grafo de dependências, com destaque dos itens que determinam a duração total do cronograma e um toggle de exibição que só funciona quando há dependências cadastradas.
- **Dependências cross-project**: um item pode depender de item de outro projeto, respeitando regras de acesso, projetos restritos/ocultos e isolamento multi-tenant, com seleção de projeto no formulário de dependência.
- **Ferramentas MCP e Azy Agent para dependências** (list/create/update/delete + leitura de `dependencies`/`dependencyCount`), seguindo o padrão de `packages/tool-registry` e da skill azyboard, para agentes consultarem e editarem o grafo.
- **Login integrado opcional** definido na instalação: o administrador escolhe entre usuário/senha local, Microsoft EntraID (OAuth) ou Google. A escolha é permanente por instalação (sem migrations de conversão). A tela de login se adapta: só campos de senha no modo local, só o botão do provedor nos modos integrados.

## Capabilities

### New Capabilities
- `integrated-login`: seleção do método de autenticação na instalação (local, Microsoft EntraID ou Google), comportamento da tela de login por provedor, callback OAuth, vinculação/criação de identidade e coexistência com o login local.

### Modified Capabilities
- `card-types`: passa a suportar um quinto tipo de item, `EXTERNAL` (dependência externa), com persistência, apresentação e regras de hierarquia/movimentação próprias.
- `item-dependencies`: alvo passa a incluir itens do tipo `EXTERNAL`; novas dependências cross-project; replanejamento automático de datas; cálculo de caminho crítico; e exposição das operações de dependência como ferramentas MCP/Azy Agent.
- `auth`: o requisito de autenticação de humanos via e-mail e senha passa a valer apenas quando o provedor configurado é local; nos demais, a autenticação humana ocorre pelo provedor integrado escolhido.

## Impact

**Banco / migrations**
- `apps/api/src/db/schema.ts` e `apps/api/src/db/postgres/schema.ts`: CHECK de `items.type` passa a incluir `EXTERNAL`; `item_dependencies` ganha suporte a projeto do alvo (`depends_on_project_id`) para cross-project.
- Novas colunas de identidade externa em `users` (provedor + subject) e possível tabela de vínculo; migrations SQLite e PostgreSQL com paridade.
- `apps/api/src/db/integrity.ts`: checks de órfão/cross-tenant/cross-project; `installationMarkers.ts` e `postgres/index.ts`.

**Domínio / contratos**
- `packages/domain` (`ItemType` = `EXTERNAL`), `packages/ui-contracts` (metadados de tipo, tipos de dependência, calendário/cronograma), `packages/api-contracts` (config pública de autenticação e JWT), `packages/assistant-contracts` (escopo de tipo).

**API**
- `apps/api/src/validation.ts` (enums de tipo e schemas de dependência/cronograma), `apps/api/src/application/itemRules.ts` + `items.ts` (regras do novo tipo), `apps/api/src/services/creationDefaults.ts`/`sequenceCode.ts` (prefixo do novo tipo).
- `apps/api/src/routes/itemDependencies.ts` (cross-project), novo serviço de cronograma (replanejamento e caminho crítico).
- `apps/api/src/routes/auth.ts` + `apps/api/src/services/auth.ts`: provedor configurável, endpoint público de descoberta de provedor, rotas OAuth (start/callback), `installProfile.ts` lê `AZYBOARD_AUTH_PROVIDER`.

**Web**
- `apps/web/src/components/ItemDependenciesArea.tsx` (seleção de projeto, alvo externo), nova área/visão de cronograma e caminho crítico no board.
- `apps/web/src/lib/itemTypeMeta.ts` e i18n (`board.json` PT-BR/EN/ES) para o novo tipo.
- `apps/web/src/pages/LoginPage.tsx` + `AuthContext.tsx`: tela adaptada ao provedor; botões Microsoft/Google.

**MCP / Azy Agent**
- `packages/tool-registry` (`fields.ts`, `registry.ts`, `validation.ts`, `policies.ts`) e `packages/tool-execution` (`http-adapter.ts`, `registry.ts`) com as novas ferramentas de dependência.
- `apps/mcp/README.md`, `skills/azyboard/` (SKILL.md + referências) e manifestos espelhados.

**Testes e gates**
- `integration.test.ts`, testes de contrato MCP, paridade SQLite/PostgreSQL, testes web e `test:agent-skill`/`test:mcp-catalog`.

## Board ref

- T47 — `8acbf95a-a006-46f4-9912-47435ff2b7db` (Criar o tipo de tarefa dependência externa)
- T48 — `05285605-2151-4883-b0ae-47eb61f1740f` (Replanejamento automático de datas com base nas dependências)
- T49 — `2bb6f505-ff7a-4a9c-b6eb-0cc60cd92f30` (Cálculo de caminho crítico entre itens)
- T50 — `68e9e0e0-929e-4553-b01d-02348104d73b` (Dependências entre projetos cross-project)
- T51 — `c5dd6011-15cc-4411-bdd2-0e9c1c720683` (Integrar dependências ao tipo de tarefa dependência externa)
- T52 — `4414081e-75e4-4cd0-afe9-32e7c93ded9f` (Tools MCP e Azy Agent para dependências entre itens)
- T45 — `703d05f3-c27e-458c-bc30-4a6690fa908c` (Login integrado Microsoft como Opção)
