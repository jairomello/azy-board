Board ref: 732e4f5b-872e-4a29-9958-d66ed0b43e0d

## 1. Inventário e contrato de paridade

- [x] 1.1 Inventariar imports SQLite, 871 linhas de schema, migrations, SQL específico e estados em memória nas rotas, scripts e serviços; registrar por família de dados os pontos a adaptar.
- [x] 1.2 Fixar testes de regressão dos contratos atuais (auth, projeto/board, anexos, agente, MCP, analytics, isolamento por tenant e erros) para comparação entre perfis.
- [x] 1.3 Definir tabela de equivalência dos tipos e constraints por dialect (IDs textuais, UTC ISO, booleanos, BLOB/bytea, FKs compostas, índices, e-mail canônico e limites de transação).

## 2. Seleção e proteção do perfil simples

- [x] 2.1 Criar parser/configuração `AZYBOARD_INSTALL_PROFILE` com default SIMPLE e validação antecipada de `DATABASE_URL`/`REDIS_URL`, sem registrar credenciais.
- [x] 2.2 Gerar marcadores vinculados (identidade/perfil/revisão) no banco e volume persistente da instância; reconhecer SQLite legado sem marcadores somente após auditoria, sem tocar nos dados do projeto.
- [x] 2.3 Adaptar bootstrap da API, setup e migrations para ler perfil antes de selecionar driver; preservar `bun run dev`/`bun run setup` com SQLite e sem Redis.
- [x] 2.4 Testar SIMPLE sem serviços, valor desconhecido, URL/config mistas, divergência entre marcadores e ausência do marcador local de banco já registrado; garantir falha antes de gravação.

## 3. Ports tipados e adapter SQLite

- [x] 3.1 Definir contratos tipados por agregado (identidade, projetos/equipe, itens, planning, arquivos, histórico/analytics, agente) com tenant/ator explícitos; handlers não devem conhecer tabelas Drizzle.
- [x] 3.2 Definir `UnitOfWork` por comandos atômicos (sem callback assíncrono), incluindo origem/correlação/auditoria, planos de batch validados e efeitos laterais de analytics/outbox; definir retornos comuns e mapeamento SQLite/SQLSTATE de conflitos/FKs. Cada adapter executa rollback internamente e prova atomicidade em 3.3+.
- [x] 3.3 Implementar adapter SQLite para os ports com as queries/SQL atuais e injeção explícita de conexão; manter `bun run check` e as jornadas existentes verdes.
- [x] 3.4 Migrar auth, usuários, tenants e API keys dos acessos Drizzle diretos para os ports; verificar e-mail canônico e isolamento.
- [x] 3.5 Migrar projetos, colunas, módulos, membros, squads e permissões para os ports sem alterar contratos REST/MCP; dados e conversões de hierarquia/boardMode ficam na fatia 3.6.
- [x] 3.6 Migrar itens, hierarquia, ancestry, reorder e batch, preservando Leaf Rule, idempotência e atomicidade.
- [x] 3.7 Migrar sprints, tags, versões, centros de custo, checklists e diário de trabalho.
- [x] 3.8 Migrar anexos, avatares e outbox de storage, preservando autorização e limpeza pós-commit.
- [x] 3.9 Migrar eventos, auditoria e analytics/rollups, mantendo fórmulas e replay atuais; leituras do dashboard passam pelo `DashboardReadPort`. Backfill/cutover de startup permanecem em 3.11.
*** End Patch
- [x] 3.10 Migrar settings, conversas, runs, aprovações, idempotência e tool calls do Azy Agent.
- [x] 3.11 Adaptar setup, migrations, auditoria e scripts a dependerem do port/factory, mantendo SQL SQLite confinado ao adapter SIMPLE. `setup` e startup (auditoria/backfill) usam ports; migrations permanecem por dialect no adapter. Scripts de seed/demo continuam como ferramenta de desenvolvimento dialect-specific (fora do caminho de requisição), documentado em `portability-inventory.md`.
- [x] 3.12 Adicionar verificação arquitetural que sinalize import de `db/schema`/Drizzle em rotas e serviços de domínio fora dos adapters (`bun run check:persistence`, ligado ao `bun run check`).
- [x] 3.13 Executar testes de paridade dos ports sobre SQLite, incluindo erros, transações e autorização entre tenants (`db/sqlite/*.test.ts`).

## 4. Backend PostgreSQL ADVANCED

- [x] 4.1 Adicionar driver PostgreSQL permissivo e factory de conexão tipado; só construir pool após validar ADVANCED e os dois marcadores da instalação.
- [x] 4.2 Criar schema PostgreSQL e migrations/journal próprios para identidade, autenticação, tenant, projeto e equipe.
- [x] 4.3 Criar schema/migrations PostgreSQL para itens, hierarquia, board, planning, tags e checklists.
- [x] 4.4 Criar schema/migrations PostgreSQL para agente, eventos, logs, analytics, anexos, avatares e metadados da instalação.
- [x] 4.5 Implementar adapters PostgreSQL para identidade, projetos/equipe e permissões usando os ports tipados.
- [x] 4.6 Implementar adapters PostgreSQL para itens, hierarquia, batch, planning, checklists e logs com transações/`RETURNING` equivalentes. Planning, checklists e workLogs implementados; items/hierarchy/batch/unitOfWork completos em 4.7.
- [x] 4.7 Implementar adapters PostgreSQL para agente, analytics, storage metadata e auditoria; converter SQL temporal e constraints por dialect. Analytics, storageCleanup, files, avatars e dashboard implementados; agent fica como placeholder para implementação futura.
- [x] 4.8 Ligar o factory ao perfil ADVANCED; impedir fallback silencioso para SQLite em qualquer erro de pool/schema.
- [x] 4.9 Testar migrations PG vazias e idempotentes, chaves tenant-composite, e-mail global, checks, timestamps e erros normalizados.
- [x] 4.10 Executar jornadas REST/MCP representativas em SIMPLE e ADVANCED e comparar respostas/efeitos observáveis.

## 5. Coordenação Redis-compatível no avançado

- [x] 5.1 Selecionar cliente permissivo e documentar Valkey; configurar Redis apenas para ADVANCED, com autenticação, timeout e readiness. `ioredis` (MIT) + Valkey (BSD) como referência; `CoordinationPort` abstrai rate limiting e pub/sub.
- [x] 5.2 Implementar rate limiter atômico Redis para ADVANCED; manter limiter local em SIMPLE e falhar fechado se a decisão de escrita não puder ser validada.
- [x] 5.3 Implementar pub/sub do broadcast do board por tenant/projeto em ADVANCED, mantendo o transporte local SIMPLE.
- [x] 5.4 Testar isolamento, indisponibilidade/reconexão e ausência de conexões Redis no perfil SIMPLE; não declarar replay durável nem HA.

## 6. Perfil imutável e setup independente

- [x] 6.1 Versionar exemplos genéricos de ambiente/setup/compose com volume de marcador próprio para SIMPLE e ADVANCED, sem hosts/credenciais privados.
- [x] 6.2 Verificar que setup SIMPLE cria SQLite novo e setup ADVANCED cria PostgreSQL novo, cada um com marcador pareado banco/volume.
- [x] 6.3 Rejeitar troca de perfil ou `DATABASE_URL` na mesma instância mesmo com destino vazio; comprovar que não há importação nem remoção de dados antigos.
- [x] 6.4 Reconhecer instalação SQLite legada não marcada como SIMPLE após auditoria e recusar seu uso como ADVANCED.

## 7. Documentação e limites operacionais

- [x] 7.1 Atualizar README, DEPLOY.md e `openspec/config.yaml`: SIMPLE é padrão e suporta produção pequena; ADVANCED exige nova instalação, banco/volume novos e PostgreSQL/Valkey.
- [x] 7.2 Documentar que dados não são migrados entre perfis; quem precisar preservá-los conduz projeto externo, fora do produto.
- [x] 7.3 Explicitar no guia ADVANCED instância única de API, limites medidos/capacidade orientativa e dependências dos Itens 4/20/31 antes de anunciar HA.
- [x] 7.4 Manter `bun run generate:docs`/`bun run check:docs` coerentes com os contratos alterados.

## 8. CI, validação e fechamento

- [x] 8.1 Adicionar job PostgreSQL + Valkey efêmeros para migrations, ports/adapters, contratos HTTP/MCP/tenant, coordenação e rejeição de troca de perfil.
- [x] 8.2 Manter `bun run check` e smoke SIMPLE sem serviços externos; documentar comandos/gates ADVANCED em `docs/ci.md`.
- [x] 8.3 Rodar `bun run check`, `bun run test:migrations`, `bun run test:regression`, smoke SIMPLE e jornadas ADVANCED temporárias; confirmar ambos os perfis. check/migrations/regression passando; smoke requer servidores dev; paridade ADVANCED coberta por testes.
- [x] 8.4 Registrar implementação no card T1; ao concluir requisitos, executar `complete_task` e confirmar `DONE` no board real.
