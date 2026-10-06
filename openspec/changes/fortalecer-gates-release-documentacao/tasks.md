Board ref: c7156663-1b21-44ed-9dfb-77a207ac9086

## 1. Política e provas externas

- [ ] 1.1 Inventariar jobs/contextos reais de `.github/workflows/ci.yml`, branches de release/principal, regras efetivas e bypass usando consulta futura somente-leitura; registrar desconhecido quando acesso não for possível.
- [ ] 1.2 Criar manifesto versionado de required checks/contexto/app/branches e política de evidência, incluindo check, contratos, smoke, E2E, ADVANCED e imagem/restore.
- [ ] 1.3 Implementar auditoria de branch protection/rulesets versus manifesto com testes de check faltante/renomeado/app divergente e permissões indisponíveis.
- [ ] 1.4 Na implementação, configurar regras externas com administrador autorizado, guardar prova sem segredos e testar bloqueio em PR descartável falho/pendente/ausente; não confundir proposta com configuração aplicada.
- [ ] 1.5 Executar auditoria em contexto confiável de privilégio mínimo sem credenciais administrativas em PRs de fork; definir manutenção ao renomear checks.

## 2. Smoke essencial por perfil

- [ ] 2.1 Consumir boot/migrations/setup real de T36 `corrigir-inicializacao-advanced` e worker de T37 `separar-worker-agent-advanced`, sem duplicar composição.
- [ ] 2.2 Ampliar `scripts/smoke.ts` com seed descartável/login/cookie/auth-me/readiness/web/proxy e criação/edição/movimento/nova leitura de item.
- [ ] 2.3 Acrescentar sessão VIEWER e segundo tenant com negativa de mutação/leitura, além de 401 sem sessão.
- [ ] 2.4 Integrar jornada básica do agente com provider determinístico somente de teste e execução de worker adequada ao perfil.
- [ ] 2.5 Executar smoke SIMPLE/ADVANCED obrigatório no CI, com timeout, teardown e artefatos de erro sem segredos; integrar jornadas T42 sem duplicá-las.

## 3. Restore e recuperação

- [ ] 3.1 Estender `scripts/deploy-test-restore.ts` com fixture de negócio/relações, anexo/hash, marcadores e autenticação/leitura após restore.
- [ ] 3.2 Testar backup consistente/restauração em volumes novos em SIMPLE/ADVANCED e rejeitar dados ausentes, hash inválido e perfil incompatível.
- [ ] 3.3 Tornar restore de ambos os perfis gate de imagem/release e acrescentar execução semanal com falha visível e evidência vinculada ao SHA.
- [ ] 3.4 Registrar versões de imagem/migration no backup e ensaiar rollback compatível com schema ou recuperação integral com downtime declarado, medindo tempo/perda reais sem inventar RTO/RPO.

## 4. Documentação comprovável

- [ ] 4.1 Criar matriz de garantias/limites por perfil e release, status verificado/limitado/pendente, teste/comando/evidência/SHA/data; integrar resultados T36–T42 sem prometer pendências resolvidas.
- [ ] 4.2 Atualizar README/DEPLOY/TESTING e índice de docs com required checks, reprodução, limites gerados, backup/restore/rollback e definição curta de pronto.
- [ ] 4.3 Sinalizar `docs/ANALISE-SISTEMA.md` como histórica e ligar revisão atualizada/cards T36–T43, preservando o diagnóstico original.
- [ ] 4.4 Ampliar `scripts/check-docs.ts` para links/metadados/evidências da matriz e fixtures de garantia sem prova; manter verificações de geração/paridade existentes.
- [ ] 4.5 Documentar regressão visual observacional ou promovê-la apenas após evidência determinística e política atualizada, sem declarar `continue-on-error` bloqueante.

## 5. Aceite da release

- [ ] 5.1 Exercitar falhas controladas em cada gate essencial e registrar bloqueio efetivo, sem remover proteção para contornar falha.
- [ ] 5.2 Na futura implementação, executar `bun run check`, `bun run test:smoke`, `bun run test:e2e`, `bun run check:docs`, matriz ADVANCED e `bun run test:restore` para os dois perfis.
- [ ] 5.3 Revisar TypeScript strict, funções pequenas, licenças, ausência de segredos e comentários `// [TENANT]`/`// [DB-SWAP]` nos novos pontos aplicáveis.
- [ ] 5.4 Publicar evidência/limites/documentação junto à release e verificar que rollback de workflow mantém checks/proteção coordenados.
