# reproducible-deploy Specification

## Purpose
TBD - created by archiving change add-reproducible-deploy. Update Purpose after archive.
## Requirements
### Requirement: Infraestrutura de containers versionada no repositório

Os Dockerfiles e compose files necessários para publicar o Azy Board SHALL existir no repositório e SHALL ser revisados junto com o código da aplicação. Nenhum passo do deploy SHALL depender de arquivo de infraestrutura gerado fora do repositório. Os compose files dos perfis SIMPLE e ADVANCED SHALL descrever a topologia completa documentada (serviço web nginx + serviço API, serviços do perfil e job de migration), e alterações em migrations, versão de runtime, paths ou build SHALL poder ser revisadas no mesmo commit/PR que altera a imagem.

#### Scenario: Clone limpo constrói o deploy

- **WHEN** um operador clona o repositório público e executa o build das imagens pelos compose files versionados
- **THEN** as imagens de API e Web são construídas sem nenhum arquivo externo ao repositório

#### Scenario: Alteração de migration revisada com a imagem

- **WHEN** uma migration nova é adicionada em `apps/api/src/db/migrations`
- **THEN** o mesmo commit/PR contém todo ajuste de imagem necessário (como a cópia das migrations para o path esperado pelo runtime) sem depender de alterações fora do repositório

#### Scenario: Referência a arquivo de infraestrutura inexistente

- **WHEN** um compose file ou Dockerfile referencia um arquivo que não existe no repositório
- **THEN** a validação de deploy reprova antes do merge

### Requirement: Versão do runtime fixada e coerente

A imagem da API SHALL usar a versão do Bun declarada em `.bun-version`, e a imagem Web SHALL usar a mesma versão no estágio de build. O CI SHALL verificar a coerência entre `.bun-version`, os Dockerfiles e o workflow, e tags flutuantes de runtime (como `1-alpine`) SHALL NOT ser usadas.

#### Scenario: Divergência de versão reprova

- **WHEN** a versão do Bun no Dockerfile diverge de `.bun-version`
- **THEN** o CI falha e indica os arquivos inconsistentes

#### Scenario: Atualização de versão em um único lugar

- **WHEN** o desenvolvedor atualiza `.bun-version` para uma nova versão do Bun
- **THEN** as imagens passam a ser buildadas com a nova versão sem editar outros arquivos

### Requirement: Migration como job separado antes do rollout

As migrations SHALL rodar como job/etapa explícita, separada do start da API. Em produção, o start da API SHALL NOT aplicar migrations implicitamente. O rollout documentado SHALL executar backup, migration e start nessa ordem, e a falha no job de migration SHALL abortar o rollout sem interromper a versão em execução.

#### Scenario: Job de migration antes da API

- **WHEN** o operador sobe a instância pelos compose files versionados
- **THEN** o job de migration executa e conclui antes de o serviço da API aceitar tráfego

#### Scenario: Start da API não migra o banco

- **WHEN** o serviço da API inicia em produção apontando para um banco com migrations pendentes e o job de migration não foi executado
- **THEN** a API não aplica migrations implicitamente e o estado do banco permanece inalterado pelo start

#### Scenario: Migration falha e o rollout aborta

- **WHEN** o job de migration retorna erro durante o rollout
- **THEN** a versão em execução permanece ativa e o operador recebe o erro da migration sem troca de versão concluída

### Requirement: Rollback e compatibilidade entre aplicação e schema documentados

O `DEPLOY.md` SHALL documentar o procedimento de rollback e as regras de compatibilidade entre versão da aplicação e versão do schema, incluindo quando o rollback exige restauração de backup e a afirmação de que downgrade de schema não é suportado.

#### Scenario: Operador encontra o procedimento de rollback

- **WHEN** o operador precisa reverter uma versão publicada
- **THEN** o `DEPLOY.md` descreve a ordem de rollback (imagem anterior, quando o schema atual é compatível) e quando restaurar o backup pré-migração

#### Scenario: Migration incompatível com a versão anterior

- **WHEN** uma release contém migration destrutiva ou incompatível com a aplicação anterior
- **THEN** a documentação indica que o rollback exige restaurar o backup feito antes da migration

### Requirement: Backup automatizado com teste de restore

O produto SHALL fornecer scripts versionados de backup e restore que funcionem nos perfis SIMPLE (SQLite) e ADVANCED (PostgreSQL), e SHALL executar automaticamente um teste de restore que prova que um backup restaura uma instância funcional. A falha do teste de restore SHALL reprovar o CI.

#### Scenario: Restore verificado no CI (SIMPLE)

- **WHEN** o CI executa o teste de restore do perfil SIMPLE
- **THEN** uma instância efêmera é criada, populada, copiada em backup, destruída e restaurada, e os dados restaurados são verificados como intactos

#### Scenario: Backup antes do rollout

- **WHEN** o operador segue o rollout documentado de produção
- **THEN** o script de backup é executado antes do job de migration e o backup pode ser restaurado pelo script de restore

#### Scenario: Backup do ADVANCED cobre banco e uploads

- **WHEN** o operador executa o backup em instância ADVANCED
- **THEN** o dump do PostgreSQL e o volume de uploads são incluídos e o restore os reconstitui em instância limpa

