## Context

O login é a única rota pública sensível (`auth.ts:17-73`) e não tem proteção contra força bruta. Fatos do código atual que restringem o design:

- **Instância única com SQLite** (`DEPLOY.md:32-35,52`), sem Redis nem store compartilhado; o único rate limit é um `Map` in-memory por usuário do assistente (`assistant.ts:75,158-162`).
- **Sem IP no contexto**: `RequestContext` (`packages/types/src/index.ts:196-201`) não expõe IP e não há uso de `getConnInfo`/`X-Forwarded-For` no repositório.
- **Contrato de erro já mapeia 429 → `RATE_LIMITED`** com `retryable: true` (`middleware/errorResponse.ts:21,52`), mas nenhuma rota emite `Retry-After`.
- **Política de senha efetiva é `min(1)`** (`validation.ts:160`); identidade é global por e-mail canônico desde `global-email-identity`.
- A API fica atrás do Nginx Proxy Manager no deploy `labapps`, que adiciona `X-Forwarded-For`.

## Goals / Non-Goals

**Goals:**

- Impedir força bruta e credential stuffing no login com limite por IP **e** por identidade (e-mail canônico).
- Aplicar atraso progressivo e bloqueio temporário, resistentes a reinício do processo.
- Registrar tentativas de login para auditoria, sem guardar senha/hash/segredo.
- Exigir política mínima de senha ao criar usuário via API.
- Emitir `Retry-After` em respostas 429.

**Non-Goals:**

- MFA para Root/Admin.
- Autosserviço de troca/recuperação de senha (não existe rota hoje).
- Rate limiting distribuído (Redis) ou coordenação multi-instância — a change assume a instância única atual.
- Bloqueio permanente de conta ou lista de IPs permitidos.
- Política de senha configurável por projeto/tenant.

## Decisions

### Decisão 1 — Limiter/auditoria persistentes em nova tabela `login_attempts`

Persistir cada tentativa em `login_attempts` (`id`, `ip`, `email_canonical`, `outcome` em `SUCCESS`/`FAILURE`/`THROTTLED`, `created_at`) e calcular janelas por consulta. Alternativa in-memory (estilo `assistant.ts:75`) foi descartada porque reinício zera contadores, não há auditoria e o estado não é observável. O volume é baixo (tentativas de login), então consultas indexadas bastam.

Índices: `(created_at)`, `(ip, created_at)`, `(email_canonical, created_at)`; retenção por poda oportunista de registros com mais de 30 dias.

### Decisão 2 — Duas chaves, com identidade como controle primário

- **IP**: janela deslizante de 15 min, máximo de **30** tentativas por IP. Limitador secundário.
- **Identidade (e-mail canônico)**: janela de 15 min; após **5** falhas, bloqueio temporário até a janela depurar. É o controle resistente a spoofing, pois não depende de header de proxy.

`email_canonical` sempre derivado por `normalizeEmail` (`utils/email.ts`), inclusive para e-mails inexistentes — nunca armazenar e-mail cru nem revelar existência da conta.

### Decisão 3 — Atraso progressivo + 429 com `Retry-After`

Falhas abaixo do limiar de bloqueio recebem um atraso pequeno e crescente (`min(250ms * falhasRecentes, 2s)`) antes de responder 401. Ao atingir o limiar ou o limite de IP, a resposta é `429 RATE_LIMITED` com `Retry-After` em segundos. O atraso é curto e limitado para não virar vetor de exaustão de conexões; o bloqueio real é o 429.

Sucesso de login limpa as falhas da identidade (grava `SUCCESS` e considera a janela sem falhas). A identidade permanece bloqueada durante toda a janela, mesmo com senha correta (evita oráculo de senha).

### Decisão 4 — Resolução de IP com proxy confiável explícito

O IP vem de `server.requestIP(req)` (Bun `serve`); quando `TRUST_PROXY=true` e há `X-Forwarded-For`, usa-se a **última** entrada (a anexada pelo proxy imediato confiável). Sem `TRUST_PROXY`, header de proxy é ignorado, impedindo bypass por spoofing. Isso é documentado como melhor esforço: o controle por identidade é o principal.

Um middleware inicial resolve o IP e o coloca no contexto (`HonoEnv`/`RequestContext`), sem exigir banco.

### Decisão 5 — Política mínima de senha no schema de cadastro

`createUserSchema` ganha validação: mínimo de **8** caracteres, não igual ao e-mail nem ao trecho local, não composta por um único caractere repetido e não presente em uma pequena denylist de senhas comuns. `loginSchema` permanece permissivo (senhas antigas continuam válidas para autenticar). Operadores de CLI (`setup.ts`, `seed.ts`) validam a mesma política com erro claro.

### Decisão 6 — `Retry-After` no contrato de erro

O middleware de erro adiciona `Retry-After` a qualquer `429` que ainda não o tenha, com valor padrão de 60s; rotas sensíveis (login) definem o valor preciso. Assim o assistente (`RATE_LIMITED`/`QUOTA_EXCEEDED`) também ganha o header sem refatoração.

## Risks / Trade-offs

- [Bloqueio por identidade permite DoS de conta conhecida] → janela curta de 15 min, sem bloqueio permanente, contadores resetam no sucesso legítimo e toda tentativa é auditada; mensagem de bloqueio não revela existência da conta.
- [Spoofing de `X-Forwarded-For` para burlar limite por IP] → header só é considerado com `TRUST_PROXY=true`; controle por identidade não depende de header.
- [Crescimento da tabela `login_attempts`] → poda de registros > 30 dias na própria verificação, além do índice por `created_at`.
- [Atraso progressivo exaure conexões em instância única] → atraso limitado a 2s e convertido em 429 com `Retry-After` a partir do limiar.
- [Política de senha quebra cadastros/fluxos existentes] → aplicada apenas na criação de usuário; login não revalida força; senhas já existentes seguem funcionando.
- [`server.requestIP` indisponível em alguns ambientes de teste] → fallback determinístico (ex.: `unknown`) que ainda aplica a janela por identidade.

## Migration Plan

1. Migration append-only `0029_*` cria `login_attempts` com índices; não altera dados existentes.
2. Deploy do código (limiter, auditoria, política de senha, `Retry-After`).
3. Rollback: a remoção do código desativa a proteção; a tabela pode permanecer (append-only) sem efeito colateral.
4. Verificação: `bun run check`, `bun run test:migrations`, `bun run test:smoke` e teste manual de 429 com `Retry-After`.

## Open Questions

- Definir `TRUST_PROXY` no deploy `labapps` (o NPM é o proxy confiável) — tratar como configuração de ambiente documentada, sem hardcode.
- Retenção de auditoria além de 30 dias (a política citada no `SECURITY_CHECKLIST.md` fala em 180 dias) fica para uma change de observabilidade.
