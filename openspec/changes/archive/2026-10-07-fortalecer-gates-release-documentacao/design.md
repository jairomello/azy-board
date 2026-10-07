Board ref: c7156663-1b21-44ed-9dfb-77a207ac9086

## Context

`.github/workflows/ci.yml` tem jobs `check`, `contracts`, `smoke`, `e2e`, `advanced (PostgreSQL + Valkey)` e `image (deploy reproduzível)`, disparados em todo `push` e `pull_request`, sem filtro de branch. A consulta somente-leitura (2026-10-07, checkout HEAD `6f311de528b643760ac38aaac3efa671957a498e`) confirmou `jairomello/azy-board` público, branch padrão `main` e refs remotas `main`, `ci/add-ci-pipeline`, `feat/t15-card-description-autosave`, `fix/azy-agent-chat-contrast`, `fix/profile-menu-stacking`; nenhuma branch `release` apareceu. O comando `gh` não está instalado. O endpoint público de branch protection de `main` respondeu HTTP 401 sem autenticação; GET público de rulesets retornou lista vazia, o que não comprova proteção nem bypass. Portanto, regras efetivas, checks obrigatórios e bypass ficam **não comprovados** até auditoria autenticada somente-leitura. O workflow inclui seis jobs; os contextos aparentes pelos `name` são `check`, `contracts`, `smoke`, `e2e`, `advanced (PostgreSQL + Valkey)` e `image (deploy reproduzível)`; `docs/ci.md` contradiz isso ao chamá-los genericamente de required checks e também recomendar não os exigir no modo solo. ADVANCED já testa boot/worker e jornada real no workflow; o restore de imagem ainda só chama padrão SIMPLE. `scripts/check-docs.ts` e `generate-docs.ts` já existem. YAML e execuções verdes não provam branch protection efetiva.

## Goals / Non-Goals

**Goals:** gates essenciais executados pelo CI; smoke de negócio e restore em ambos os perfis; documentação rastreável à versão/evidência.

**Non-Goals:** configurar branch protection/rulesets ou executar PR de falha deliberada no GitHub; fornecer suporte a migração entre perfis; corrigir boot/worker/outbox/pub-sub ou repetir testes de componentes de T42.

## Decisions

### Inventário local de checks e proteção externa não comprovada

Manter `docs/release-policy.json` como inventário local dos nomes/contextos de CI e da política de evidência. `scripts/audit-release-policy.ts` verifica drift no workflow e pode consultar regras externas somente-leitura quando o operador fornecer credencial local; sem acesso, reporta `NOT_PROVEN`. A configuração de branch protection/rulesets, política de bypass, PR falho descartável e auditoria privilegiada foram removidas do escopo por decisão do usuário. O workflow e a documentação não alegam bloqueio externo de merge.

### Smoke autenticado por perfil

Expandir script reutilizável com seed isolada via setup oficial, login/cookie, auth/me, projeto, criação/edição/movimento/leitura de item, confirmação após reload HTTP e sessão VIEWER com mutação negada; segundo tenant não vê recursos. Verificar `/health/ready`, raiz web e proxy para API. Agente com provider determinístico habilitado só em teste verifica caminho básico sem custo externo; execução ADVANCED precisa worker de T37. Manter 401 sem sessão. Jobs usam runtime/compose reais por perfil e volumes descartáveis; exit diferente de zero em qualquer etapa e teardown em finally. T36 entrega boot/migrations/fixture ADVANCED; T43 reusa a jornada como gate de release, não cria novo composition root.

### Restore de negócio e rollback condicionado ao schema

Estender `deploy-test-restore.ts` para dados autorizados de projeto/item/relações e anexo com hash, marker do perfil e sessão pós-restore; manter sondas baixas para diagnóstico. Testar backup consistente, volumes novos, health/ready e leitura de negócio em SIMPLE/ADVANCED, isolamento e rejeição de backup incompatível. Matriz de restore no CI de imagens/release; execução semanal proposta com artefatos sem segredos. Manifesto de backup/versionamento registra imagem e migration; rollback de imagem permitido apenas com schema compatível; caso contrário restore completo previamente validado e downtime declarado. Não prometer downgrade destrutivo automático nem migração entre perfis. Medir tempo e perda observada sem inventar RTO/RPO.

### Garantia documental vinculada a prova

Acrescentar matriz de garantias/limites por perfil e release com link para teste, comando, artefato, SHA e data; status verificado/limitado/pendente. `README.md`/`DEPLOY.md` referenciam fontes geradas para limites voláteis; `TESTING.md` identifica gates e reproduções. `docs/ANALISE-SISTEMA.md` recebe indicação histórica e link para revisão atualizada; esta aponta cards T36–T43. Checker valida links, metadados e afirmações cadastradas, não tenta provar qualquer prosa com regex. Garantia sem prova não é marcada verificada. Regressão visual atual é observacional; promoção a required só com baseline/tolerância determinística validada e política explícita, sem anunciar bloqueio hoje.

## Risks / Trade-offs

- [Checks renomeados não bloqueiam] → comparar execuções reais com manifesto e regras externas; testar missing/pending/failed, não só success.
- [Privilégio excessivo de CI] → auditoria em contexto confiável, leitura mínima, nenhuma credencial administrativa em PR.
- [Restore verde com aplicação quebrada] → recuperar dados de negócio/anexo e autenticar após restauração.
- [Documentação promete T36–T39 ainda pendentes] → usar status limitado/pendente até evidência real por versão/perfil.
- [CI caro] → smoke curto por PR, restore completo em gate de imagem/release e semanal; nenhuma etapa essencial marcada `continue-on-error`.

## Migration Plan

Estabilizar T36/T37, compor gates/jornadas T38–T42 e publicar documentação junto da release validada. Esta change mantém o inventário e auditor local dos checks, mas não configura nem testa branch protection/rulesets externamente. Rollback de workflow preserva os jobs e sua documentação; recuperação de aplicação segue compatibilidade de schema e restore testado.

## Open Questions

Branch protection de `main` exige permissão autenticada, indisponível nesta sessão (CLI `gh` ausente; endpoint retornou 401); configuração efetiva e bypass permanecem não comprovados e estão fora do escopo atual. Frequência semanal de restore é proposta inicial; ajustes precisam política versionada e responsável.
