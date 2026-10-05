## 1. Preparação

- [x] 1.1 Mapear consumidores/testes que assumem o TTL fixo de 1 h (`grep` por `JWT_TTL`, `maxAge`, `3600`, `'1h'`, `session` cookie) em `apps/api` e `apps/web`
- [x] 1.2 Definir nomes e padrões das variáveis de sessão e atualizar `apps/api/.env.example`, `.env.example.simple` e `.env.example.advanced` (`SESSION_TTL=24h`, `SESSION_REMEMBER_TTL=30d`, `SESSION_MAX_TTL=180d`)

## 2. Backend — sessão configurável

- [x] 2.1 Centralizar a configuração de duração em `apps/api/src/services/auth.ts` (parse/validação de `SESSION_TTL`, `SESSION_REMEMBER_TTL`, `SESSION_MAX_TTL` com defaults 24h/30d/180d)
- [x] 2.2 Estender `signJwt` para receber a duração e os claims `rmb` (lembrado) e `auth_time` (login original), preservando `alg HS256` e `sub`/`tenantId`
- [x] 2.3 Atualizar `POST /api/auth/login` (`apps/api/src/routes/auth.ts`) para aceitar `remember?: boolean` com validação estrita de tipo, escolher a duração e refletir no `maxAge` do cookie `session`
- [x] 2.4 Revisar `POST /api/auth/logout` (mantém `deleteCookie` e comportamento atual) e confirmar que nenhum atributo do cookie mudou

## 3. Backend — renovação deslizante

- [x] 3.1 Em `apps/api/src/middleware/auth.ts`, renovar a sessão humana quando o token passar de metade da duração e antes do limite absoluto: reemitir JWT + `Set-Cookie` com a duração cheia, mantendo `rmb`
- [x] 3.2 Tratar `now - auth_time >= SESSION_MAX_TTL` como sessão expirada (401), mesmo com `exp` válido
- [x] 3.3 Garantir que a renovação não se aplica a autenticação por API Key de agente nem ao handshake do WebSocket

## 4. Frontend

- [x] 4.1 Adicionar o checkbox "Lembrar-me neste dispositivo" (desmarcado por padrão) em `apps/web/src/pages/LoginPage.tsx` e as chaves i18n nos três locales (`pt-BR`, `en`, `es`)
- [x] 4.2 Implementar o preenchimento automático do e-mail via `localStorage` (gravar no login com lembrar; remover no login sem lembrar), sem persistir a senha
- [x] 4.3 Repassar `remember` em `AuthContext.login` (`apps/web/src/contexts/AuthContext.tsx`) e no cliente HTTP do login (`apps/web/src/lib/api.ts`)

## 5. Testes e verificação

- [x] 5.1 Testes de API com relógio controlado: login com/sem `remember` (`exp`/`maxAge` corretos), renovação ao passar metade da duração, limite absoluto → 401, atributos do cookie inalterados
- [x] 5.2 Testes de frontend: checkbox presente e opt-in, preenchimento do e-mail lembrado, envio de `remember` no corpo do login e paridade i18n entre os três locales
- [x] 5.3 Rodar `bun run check` (typecheck + lint + testes + build) e corrigir apontamentos
- [x] 5.4 Rodar `bun run test:smoke` e validar manualmente no navegador (login com e sem lembrar, expiração do cookie, preenchimento do e-mail, renovação em uso)

## 6. Encerramento

- [x] 6.1 Registrar o resultado no card T31 do Azy Board (Board ref: `a4cb11fa-1c47-45a3-97f2-443155ef37e7`) com `create_item_log`
- [x] 6.2 Mover o card T31 para `Concluídas` com `complete_task` e confirmar `status = DONE` no board real
