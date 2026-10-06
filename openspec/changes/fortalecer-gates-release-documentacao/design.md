Board ref: c7156663-1b21-44ed-9dfb-77a207ac9086

## Context

`.github/workflows/ci.yml` tem jobs `check`, `contracts`, `smoke`, `e2e`, `advanced (PostgreSQL + Valkey)` e `image (deploy reproduzível)`. ADVANCED hoje testa migrations/paridade e coordenação local, não boot. Smoke cobre raiz/live/401. `scripts/deploy-test-restore.ts` aceita ambos os perfis, grava sonda SQL/arquivo e verifica readiness; CI chama apenas padrão SIMPLE. `check-docs.ts` e `generate-docs.ts` já existem. As specs prometem bloqueio, mas arquivo YAML não prova branch protection real; a revisão distingue observação de garantia.

## Goals / Non-Goals

**Goals:** gates essenciais efetivamente bloqueantes e verificáveis; smoke de negócio e restore em ambos os perfis; documentação rastreável à versão/evidência.

**Non-Goals:** modificar GitHub nesta fase de proposta, fornecer suporte a migração entre perfis, corrigir boot/worker/outbox/pub-sub ou repetir testes de componentes de T42.

## Decisions

### Manifesto versionado e auditoria externa

Recomendar política em `docs/release-policy.json` (novo): branches protegidas, nomes exatos/contextos dos checks, app emissor, bypass autorizado e evidência exigida. Inicialmente incluir os seis jobs atuais, com nomes finais extraídos das execuções reais; se matriz alterar contexto, atualizar manifesto e proteção conjuntamente. Auditoria futura somente-leitura com `gh api` consulta branch protection e rulesets efetivos, compara contexto/app, strict/up-to-date e bypass. Ausência de permissão para leitura é estado desconhecido que não comprova conformidade. Configuração posterior por administrador é tarefa de implementação, com prova de PR intencionalmente falho em branch descartável e confirmação de bloqueio. Screenshot ou YAML isolado são insuficientes. Gate de auditoria não exige token administrativo em PR de fork; auditoria privilegiada em job confiável separado e relatório vinculado à release, sem segredo no log.

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

Estabilizar T36/T37, compor gates/jornadas T38–T42, manter nomes dos checks até atualizar proteção externamente, rodar PR negativo controlado e arquivar evidência. Publicar documentação junto da release validada. Rollback de workflow preserva o conjunto obrigatório ou atualiza manifesto/proteção coordenadamente; não desabilitar proteção para contornar falha. Recuperação de aplicação segue compatibilidade de schema e restore testado.

## Open Questions

Configuração GitHub atual não foi consultada e permanece não comprovada. A futura auditoria resolve isso sem suposições. Frequência semanal de restore é proposta inicial; ajustes precisam política versionada e responsável.
