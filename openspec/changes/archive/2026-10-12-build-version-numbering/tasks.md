# Tasks

## 1. Geração da versão e propagação no build

- [x] 1.1 Criar `scripts/build-version.ts` que calcula `version = YYYY.MM.DD.N` (data UTC + contador de commits do dia, com override `AZYBOARD_BUILD_NUMBER`) e a data do build; validar com testes unitários cobrindo primeiro build do dia, incremento e reinício em novo dia.
- [x] 1.2 Integrar a geração ao `bun run build` raiz e propagar a versão/data ao web via `define` no `apps/web/vite.config.ts` (`__APP_VERSION__`/`__BUILD_DATE__`, com fallback `dev` em dev); validar com `bun run build:web` e conferindo o valor embutido no bundle.
- [x] 1.3 Propagar a versão/data à API no build (env/`--define`/arquivo em `dist`) e criar `apps/web/src/lib/buildInfo.ts` como ponto único de leitura no frontend; validar com typecheck e com um teste que lê o valor embutido.

## 2. Endpoint público de versão

- [x] 2.1 Adicionar rota pública `GET /version` retornando `{ version, buildDate }` sem autenticação e sem segredos; validar com teste de API cobrindo resposta sem sessão e ausência de campos sensíveis.
- [x] 2.2 Documentar o endpoint de versão na documentação de operação; validar com `bun run check:docs`.

## 3. Exibição no frontend

- [x] 3.1 Exibir versão e data do build no canto da tela de login a partir de `buildInfo`; validar com teste de `LoginPage` cobrindo presença do texto e ausência de dados sensíveis.
- [x] 3.2 Exibir versão e data do build na sidebar do `AppShell`, abaixo de "Trabalho conectado" na largura estendida; validar com teste de contrato do `AppShell`.
- [x] 3.3 Adicionar as chaves de i18n de versão/data em PT-BR, EN e ES nos namespaces usados; validar com `bun run check:i18n`.

## 4. Pipeline e documentação

- [x] 4.1 Integrar a etapa de geração de versão ao workflow de CI antes dos builds, reprovando o job em caso de falha; validar executando a etapa de geração localmente e revisando o workflow (a falha retorna código diferente de zero).
- [x] 4.2 Documentar a regra de numeração `YYYY.MM.DD.N`, sua origem e como conferir a versão publicada (login, sidebar e `GET /version`); validar com `bun run check:docs`.

## 5. Verificação de integração

- [x] 5.1 Executar `bun run check` (typecheck + lint + testes + build) e corrigir eventuais falhas.
- [x] 5.2 Executar `bun run test:smoke` e confirmar a exibição da versão no login/sidebar e a resposta de `GET /version`.

## Workflow follow-up

- Encerrar o card T60 (`4d12abaf-d55c-45fa-a0aa-ac4206626c09`) com `complete_task` e confirmar no board que o `status` é `DONE`.
- Arquivar a change após a revisão.
