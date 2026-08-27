# Testes

## Visão Geral

O projeto usa dois níveis de verificação:

- Testes de integração Bun para o backend, com banco SQLite em memória.
- Smoke test HTTP para validar uma aplicação local ou publicada.

Os testes não usam o banco persistente, não criam arquivos de upload e não
exigem credenciais reais.

## Local

Os testes de integração da API usam SQLite em memória e não alteram `dev.db`:

```bash
bun run test:integration
```

Esse comando executa `apps/api/src/integration.test.ts` e cobre:

- migração do schema e default `HIERARCHICAL`;
- criação de projetos simples e hierárquicos;
- criação automática da STORY fixa e associação de TASK;
- conversão simples para hierárquico e hierárquico para simples;
- preservação de cards, tags, sprints, anexos, checklists e logs;
- bloqueio de MEMBER e isolamento entre tenants.

Os contratos do servidor MCP podem ser verificados sem servidor externo:

```bash
bun run test:mcp
bun run test:mcp-catalog
```

Esses comandos cobrem o catálogo de ferramentas, validação de argumentos,
fluxos de board, idempotência, erros estruturados e a obrigatoriedade de
política de autorização por ferramenta. As API Keys usadas nos testes são
simuladas e não são credenciais reais.

Para a validação completa do monorepo:

```bash
bun run check
```

Com os servidores locais ativos, valide a publicação web e o endpoint de
autenticação:

```bash
bun run test:smoke
```

O smoke test verifica HTTP `200` na raiz e HTTP `401` em `/api/auth/me` sem
sessão. Para usá-lo contra outra instalação, defina `SMOKE_URL`.

## Instalações Publicadas

Para validar uma instalação publicada, informe a URL base do ambiente:

```bash
SMOKE_URL=https://example.com/app bun run test:smoke
```

O resultado esperado é HTTP `200` para a aplicação e HTTP `401` para
`/api/auth/me` sem sessão.

O teste de integração da API usa banco SQLite em memória e pode ser executado
no mesmo ambiente de runtime, desde que os arquivos de teste estejam presentes
na imagem ou no workspace:

```bash
bun run test:integration
```

O seed de desenvolvimento também não aceita mais uma senha padrão. Se for
necessário executá-lo, informe uma senha temporária somente pelo ambiente:

```bash
SEED_ADMIN_PASSWORD='senha-local-temporaria' bun run db:seed
```

Procedimentos específicos de host, containers, domínios internos, SSH e
persistência devem ser mantidos na documentação privada da infraestrutura, fora
deste repositório.
