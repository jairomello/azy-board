# continuous-integration Specification

## Purpose
TBD - created by archiving change add-ci-pipeline. Update Purpose after archive.
## Requirements
### Requirement: CI obrigatorio em branches e pull requests

O sistema SHALL executar um workflow de integracao continua em `.github/workflows` para todo push de branch e todo pull request, sem depender de acao manual. O workflow SHALL usar a versao de Bun fixada pelo projeto e SHALL instalar dependencias de forma deterministica a partir do lockfile.

#### Scenario: Push em branch dispara CI
- **WHEN** um commit e enviado para qualquer branch que nao seja um artefato de release
- **THEN** o workflow de CI e iniciado automaticamente com os jobs de validacao

#### Scenario: Pull request dispara CI
- **WHEN** um pull request e aberto ou atualizado
- **THEN** o workflow de CI e iniciado e reporta o status no pull request

#### Scenario: Versao de Bun fixada
- **WHEN** o workflow prepara o ambiente
- **THEN** ele instala a versao de Bun declarada pelo projeto, garantindo reproducibilidade entre execucoes e maquinas

### Requirement: Gate de check completo

O workflow SHALL executar `bun run check` como gate principal, cobrindo typecheck, lint, testes e build. A falha de qualquer etapa SHALL reprovar o job e o pull request nao SHALL ser considerado valido.

#### Scenario: Check passa
- **WHEN** typecheck, lint, testes e build concluem com sucesso
- **THEN** o job de check e marcado como bem-sucedido

#### Scenario: Falha de typecheck
- **WHEN** existe erro de tipagem em qualquer pacote (types, api, web ou mcp)
- **THEN** o job falha e o pull request fica bloqueado

#### Scenario: Falha de build
- **WHEN** o build de api, web ou mcp falha
- **THEN** o job falha e o pull request fica bloqueado

### Requirement: Lint real e reprovativo

O comando `lint` do projeto SHALL executar uma ferramenta de lint real, com regras configuradas, em vez de repetir o typecheck. O CI SHALL reprovar quando o lint encontrar violacoes. A ferramenta adotada SHALL ter licenca MIT, Apache 2.0, BSD, ISC ou dominio publico.

#### Scenario: Violacao de lint reprova o CI
- **WHEN** o lint encontra uma violacao de regra
- **THEN** o comando `lint` retorna codigo de saida diferente de zero e o job falha

#### Scenario: Codigo conforme passa no lint
- **WHEN** o codigo respeita todas as regras configuradas
- **THEN** o comando `lint` retorna sucesso e o job prossegue

### Requirement: Gates de contrato sincronizados

O workflow SHALL executar gates que detectam divergencia de contratos antes do merge: verificacao de i18n, testes de migration, validacao do catalogo MCP, verificacao da skill de agente e verificacao do orcamento de bundle do web. Qualquer divergencia SHALL reprovar o job correspondente.

#### Scenario: Texto fora do i18n
- **WHEN** a verificacao de i18n encontra texto localizado fora dos arquivos de idioma
- **THEN** o gate de i18n falha e o pull request fica bloqueado

#### Scenario: Migration inconsistente
- **WHEN** o teste de migrations detecta schema, journal ou snapshot divergente
- **THEN** o gate de migrations falha e o pull request fica bloqueado

#### Scenario: Catalogo MCP divergente
- **WHEN** o catalogo MCP difere do registry de ferramentas
- **THEN** o gate de catalogo MCP falha e o pull request fica bloqueado

#### Scenario: Skill de agente divergente
- **WHEN** a skill oficial do agente diverge do comportamento verificado
- **THEN** o gate da skill de agente falha e o pull request fica bloqueado

#### Scenario: Orcamento de bundle ultrapassado
- **WHEN** a verificacao de orcamento detecta um chunk do web acima do limite versionado
- **THEN** o gate de bundle falha e o pull request fica bloqueado

### Requirement: Smoke test do fluxo web e API

O workflow SHALL subir a API e o frontend e executar `bun run test:smoke`, verificando que a pagina inicial responde 200 e que a rota autenticada responde 401 sem sessao. A falha do smoke test SHALL reprovar o job.

#### Scenario: Servicos respondem
- **WHEN** a API e o frontend estao no ar
- **THEN** o smoke test valida `200` na raiz e `401` na rota de sessao e conclui com sucesso

#### Scenario: Servico indisponivel
- **WHEN** a API ou o frontend nao sobem ou respondem de forma inesperada
- **THEN** o smoke test falha e o pull request fica bloqueado

### Requirement: Bloqueio de merge por required checks

O repositorio SHALL documentar e configurar os jobs de CI como verificacoes obrigatorias da branch principal, de modo que pull requests com gate reprovado nao possam ser mesclados. A configuracao externa de protecao de branch SHALL ser registrada na documentacao do projeto.

#### Scenario: Gate reprovado impede merge
- **WHEN** um pull request tem qualquer gate de CI reprovado
- **THEN** a mesclagem permanece bloqueada ate a correcao

#### Scenario: Todos os gates aprovados liberam merge
- **WHEN** todos os gates de CI passam
- **THEN** o pull request fica apto a ser mesclado segundo as regras da branch

### Requirement: Reprodutibilidade e diagnostico do CI

O workflow SHALL permitir reproduzir localmente cada gate documentado e SHALL publicar logs e artefatos uteis quando houver falha, sem expor segredos. A documentacao SHALL descrever como executar os gates localmente antes de abrir o pull request.

#### Scenario: Falha com diagnostico
- **WHEN** um job de CI falha
- **THEN** o log da etapa que falhou fica visivel e, quando aplicavel, os artefatos de diagnostico sao publicados

#### Scenario: Reproducao local
- **WHEN** um desenvolvedor segue a documentacao de CI
- **THEN** ele consegue executar localmente os mesmos gates do workflow antes de enviar o pull request

