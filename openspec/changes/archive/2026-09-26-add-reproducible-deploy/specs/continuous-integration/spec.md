## ADDED Requirements

### Requirement: Build das imagens de deploy no CI

O workflow de CI SHALL buildar as imagens Docker de API e Web a partir dos arquivos versionados e SHALL validar a configuração dos compose files dos perfis SIMPLE e ADVANCED em todo push de branch e pull request. O job SHALL executar o teste automatizado de restore e SHALL falhar quando o build das imagens, a validação dos compose ou o teste de restore falhar.

#### Scenario: Imagem construída a partir do clone

- **WHEN** um push ou pull request altera código, dependências, migrations ou arquivos de infraestrutura de containers
- **THEN** o CI constrói as imagens de API e Web usando apenas arquivos do repositório

#### Scenario: Compose inválido reprova o merge

- **WHEN** um compose file referencia arquivo inexistente ou contém configuração inválida
- **THEN** o job de imagens falha e o pull request não pode ser considerado válido

#### Scenario: Teste de restore executado no CI

- **WHEN** o job de imagens conclui o build das imagens
- **THEN** o teste automatizado de backup e restore é executado e sua falha reprova o job
