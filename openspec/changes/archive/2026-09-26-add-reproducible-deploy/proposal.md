# Proposal — add-reproducible-deploy

## Why

O deploy não é reproduzível pelo repositório: os compose files (`docker-compose.simple.yml`, `docker-compose.advanced.yml`) fazem `build` de um `Dockerfile` que não existe no repo, e o deploy real depende de um preparador privado que gera a infraestrutura fora de revisão. Mudanças em migrations, versão do Bun, paths ou build podem depender de arquivos nunca revisados junto com o código (drift entre aplicação e infraestrutura). Também não existe build de imagem no CI, migration roda embutida no start do container, não há plano de rollback nem backup testado.

## What Changes

- Versionar no monorepo os Dockerfiles da aplicação (`Dockerfile` da API e `Dockerfile.web` do nginx), eliminando a dependência de infraestrutura gerada fora do repositório.
- Fixar a versão do Bun das imagens a partir de `.bun-version`, com verificação automática de coerência (`.bun-version` × Dockerfile × workflow).
- Completar os compose files dos perfis SIMPLE e ADVANCED com o serviço web (nginx) e com o job de migration, reproduzindo a topologia de 2 containers já documentada no `DEPLOY.md`.
- Executar migration como job separado antes do rollout; o start da API em produção deixa de aplicar migrations implicitamente — **BREAKING** para instalações existentes (ex.: labapps) que dependem de auto-migração no start e de Dockerfiles gerados pelo preparador privado.
- Rodar build das imagens e validação dos compose no CI, provando que o deploy constrói a partir de um clone limpo.
- Documentar no `DEPLOY.md` o rollout, o rollback e a compatibilidade entre versão da aplicação e versão do schema.
- Automatizar backup e restore (SQLite no SIMPLE, `pg_dump` no ADVANCED) e executar teste de restore automaticamente no CI.

## Capabilities

### New Capabilities

- `reproducible-deploy`: deploy reproduzível a partir do repositório — infraestrutura de containers versionada e coerente com o código, runtime com versão fixada, migration como job separado no rollout, compatibilidade aplicação × schema e rollback documentados, backup automatizado com teste de restore.

### Modified Capabilities

- `continuous-integration`: o workflow passa a buildar as imagens de deploy (API e Web) e validar os compose files em todo push e pull request, além de executar o teste automatizado de restore.

## Impact

- **Infraestrutura versionada**: novos `Dockerfile` (API) e `Dockerfile.web` (nginx) na raiz; `docker-compose.simple.yml` e `docker-compose.advanced.yml` ganham serviço web, job `migrate` e orquestração de rollout.
- **CI**: `.github/workflows/ci.yml` (novo job `image`) e `docs/ci.md`.
- **Scripts**: novos scripts de backup, restore e teste de restore em `scripts/`, expostos no `package.json`.
- **Aplicação**: entrypoint da imagem com subcomandos `api` e `migrate`; ajuste mínimo na API se o start atual pressupuser auto-migração.
- **Documentação**: `DEPLOY.md` (topologia alinhada aos arquivos versionados, rollout, rollback, compatibilidade app × schema, backup/restore).
- **Operação**: instalações existentes devem adotar os arquivos versionados; o preparador privado (labapps) deixa de gerar Dockerfiles/compose — ajuste operacional fora do repositório.
- **Licenças**: apenas bases com licenças permissivas (Bun MIT, nginx BSD-2-Clause, PostgreSQL License, Valkey BSD).
- **Rastreabilidade**: Board ref `e931a564-15c9-462d-8472-76157262ac28` (Item 31).
