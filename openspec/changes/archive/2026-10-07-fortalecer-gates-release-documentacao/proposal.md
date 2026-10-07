Board ref: c7156663-1b21-44ed-9dfb-77a207ac9086

## Why

O workflow existente não comprova as regras externas de merge, e `scripts/smoke.ts` valida somente três respostas HTTP. O restore SIMPLE já é executado no job de imagem, mas faltam prova equivalente ADVANCED e associação confiável entre documentação, limites, rollback e evidências de release.

## What Changes

- Inventariar e validar localmente nomes/contextos dos jobs de CI; registrar proteção externa como não comprovada, sem configurar regras GitHub nem prometer bloqueio de merge nesta change.
- Ampliar smoke autenticado essencial SIMPLE/ADVANCED e exigir restore com dados de negócio/anexos, execução periódica e evidência por release.
- Documentar garantias, limites e rollback por versão/perfil, ligando análise histórica, revisão atualizada e cards de continuidade.
- Vincular afirmações operacionais a testes e artefatos, ampliar `check:docs` e tornar a definição de pronto curta e verificável.
- Manter configuração externa de branch protection/rulesets fora do escopo desta change; documentar `NOT_PROVEN` sem alegar bloqueio de merge.

## Capabilities

### New Capabilities
- `release-evidence-policy`: evidência local de CI, recuperação e garantias por release, sem configurar proteção externa de merge.

### Modified Capabilities
- `continuous-integration`: smoke autenticado, inventário local dos checks e gates de ambos os perfis.
- `documentation-integrity`: exigir rastreabilidade das garantias operacionais à evidência e sinalizar diagnósticos históricos.

## Impact

Afeta `.github/workflows/ci.yml`, `scripts/{smoke,deploy-test-restore,check-docs}.ts`, `README.md`, `DEPLOY.md`, `TESTING.md`, índice de docs e futura política versionada. T36 é pré-requisito de smoke/restore ADVANCED; T37–T39 fornecem garantias de worker/transação/realtime a comprovar; T40–T42 fornecem contratos, metas e jornadas. Não reimplementa esses cards. Base: análise atualizada, specs `continuous-integration`, `documentation-integrity`, `reproducible-deploy`; o CI atual torna regressão visual observacional com `continue-on-error`, sem apresentá-la como bloqueio efetivo.
