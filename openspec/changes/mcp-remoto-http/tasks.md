# Tasks

## 1. Pacote neutro de protocolo MCP

- [x] 1.1 Criar `packages/mcp-protocol` extraindo o core MCP de `apps/mcp/src/index.ts` (`createMcpServer`, wrappers de schema opcional, `ok`/tratamento de erro), com `package.json` declarando `@modelcontextprotocol/sdk`, `@azy-board/tool-execution` e `@azy-board/tool-registry`; verificar `bun run --cwd packages/mcp-protocol typecheck`.
- [x] 1.2 Refatorar `apps/mcp` para adaptador fino (stdio) do core, preservando o entrypoint `apps/mcp/mcp-server.ts`; verificar `bun run test:mcp` verde e `bun run --cwd apps/mcp typecheck`.
- [x] 1.3 Fiar o pacote no monorepo (typecheck raiz e os manifests de build que copiam `package.json` por pacote, inclusive `Dockerfile`/`Dockerfile.web`); verificar `bun run build` e `bun run check:deploy-versions` sem erro.

## 2. Endurecimento do contexto de execução

- [x] 2.1 Endurecer `assertHumanContext` para exigir identidade resolvida no servidor quando `source='mcp'`; verificar com teste que rejeita contexto incompleto ou forjado.
- [x] 2.2 Garantir que o `ApiCall` do MCP recusa identidade, tenant, grupo ou escopo vindos dos argumentos da ferramenta; verificar teste de escalada em `apps/api` (payload alterando identidade é rejeitado sem mutação).

## 3. Endpoint MCP HTTP na API

- [x] 3.1 Montar a rota `/mcp` com o transporte Streamable HTTP (stateless, resposta JSON) reutilizando o core do pacote neutro; verificar teste HTTP de handshake e `tools/list`.
- [x] 3.2 Resolver a credencial por requisição (Bearer API Key) e construir o `ApiCall` in-process com `Idempotency-Key` nas mutações; verificar `tools/call` e retry idempotente (mesmo resultado, sem efeito duplicado).
- [x] 3.3 Aplicar `projectId` explícito e contexto de sessão opcional, sem `AZYBOARD_PROJECT_ID` de ambiente; verificar ferramenta com `projectId` e falha acionável quando o projeto está ausente.
- [x] 3.4 Preservar o envelope de erro normalizado e a sanitização de saída; verificar testes de 401 sem chave, escopo de projeto negado e erro normalizado, sem chave em log ou resposta.
- [x] 3.5 Adicionar variável de ambiente para desabilitar o endpoint (rollback); verificar que, desabilitado, o endpoint não responde chamadas MCP.

## 4. Fronteira arquitetural e gates

- [x] 4.1 Atualizar `scripts/check-api-boundary.ts` para permitir `@azy-board/mcp-protocol` e o SDK como trânsito, manter a proibição de acoplar a `apps/mcp` e incluir o pacote neutro no staging do boot isolado; verificar `bun run check:api-boundary` verde.
- [x] 4.2 Verificar que a API compila e inicializa sem fontes de `apps/mcp` e sem import direto do SDK MCP; verificar pelo próprio gate (build isolada + readiness).

## 5. Deploy e proxy

- [x] 5.1 Adicionar `location = /mcp` com `proxy_buffering off`, `proxy_http_version 1.1`, `Connection ''` e timeouts em `docker/nginx-web.conf.template` e `docker/nginx-web-cloudflare.conf.template`; verificar a validade do template (envsubst/`nginx -t` em container quando disponível).
- [x] 5.2 Documentar a rota e o teste de conectividade em `DEPLOY.md` e `deploy/production/README.md`; verificar que o comando documentado reproduz o handshake.

## 6. Documentação e skill

- [x] 6.1 Atualizar `skills/azyboard/references/mcp-setup.md` com os modos stdio e remoto, mantendo `EASYBOARD_API_KEY`; verificar `bun run test:agent-skill`.
- [x] 6.2 Atualizar `apps/mcp/README.md` e `opencode.json.example` para os dois transportes; verificar `bun run test:mcp-catalog` e `bun run check:docs`.

## 7. Integração e verificação final

- [x] 7.1 Rodar `bun run check` (typecheck + lint + fronteiras + testes + build) e `bun run test:smoke`; verificar tudo verde.
- [x] 7.2 Exercitar paridade REST/MCP HTTP/agente para um comando equivalente de criação/movimentação com fixtures equivalentes; verificar contratos e efeitos persistidos equivalentes.

## Workflow follow-up

- Arquivar a mudança após a revisão do projeto e a atualização da skill.
- Se um card do Azy Board for criado para este trabalho, registrar `Board ref: <itemId>` nos artefatos e encerrar o card em coluna com `baseStatus` DONE.
