# release-evidence-policy Specification

## Purpose
TBD - created by archiving change fortalecer-gates-release-documentacao. Update Purpose after archive.
## Requirements
### Requirement: Política de release com evidência local
O repositório SHALL manter manifesto versionado dos contextos de checks do workflow e evidência por SHA/data sem segredos. O estado de branch protection/rulesets pode ser registrado como `NOT_PROVEN`, mas esta change SHALL NOT exigir configuração de regras externas, permissões administrativas ou prova de bloqueio de merge para concluir suas tarefas locais.

#### Scenario: Check local ausente ou renomeado
- **WHEN** contexto de um job inventariado diverge do workflow versionado
- **THEN** a auditoria local falha e informa a diferença

#### Scenario: Proteção externa fora do escopo
- **WHEN** branch protection/rulesets não foram consultados ou configurados por administrador
- **THEN** a documentação registra `NOT_PROVEN` e limita suas afirmações aos jobs executados no CI

### Requirement: Restore comprovado nos dois perfis
O pipeline de imagem/release SHALL testar backup e restore em instalações efêmeras SIMPLE e ADVANCED, com banco, anexos, marcadores e dados de negócio autorizados. Execução periódica semanal SHALL registrar evidência independente e falhar de forma visível. Restauração SHALL verificar readiness e autenticação/leitura de negócio, integridade de anexo e isolamento; SHALL rejeitar perfil incompatível. Procedimento de rollback SHALL distinguir compatibilidade de schema de recuperação por backup e SHALL NOT prometer migração entre perfis.

#### Scenario: Recuperação completa
- **WHEN** backup é restaurado em volumes novos do mesmo perfil
- **THEN** projeto/item/relações/anexo e marker são recuperados, hash confere e usuário autenticado acessa dados corretos após readiness

#### Scenario: Restore parcial ou perfil divergente
- **WHEN** arquivo/dado obrigatório falta, hash diverge ou backup pertence a outro perfil
- **THEN** restore/gate falha e a instalação não é declarada recuperada

#### Scenario: Rollback com schema incompatível
- **WHEN** versão anterior da imagem não suporta schema vigente
- **THEN** runbook exige recuperação pelo backup compatível previamente testado e declara impacto, sem downgrade destrutivo automático

