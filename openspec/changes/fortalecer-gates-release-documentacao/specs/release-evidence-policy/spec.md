Board ref: c7156663-1b21-44ed-9dfb-77a207ac9086

## ADDED Requirements

### Requirement: Política de release com comprovação externa
O repositório SHALL manter manifesto versionado de branches protegidas, checks/contextos/apps emissores e bypass permitido. A comprovação de release SHALL comparar o manifesto com regras efetivas de branch protection/rulesets e execuções reais; ausência de acesso SHALL ser reportada como não comprovada. Evidência SHALL conter SHA, data e resultado sem segredos. A configuração externa SHALL ser tarefa explícita da implementação, nunca considerada realizada por apenas escrever OpenSpec/YAML.

#### Scenario: Check ausente ou renomeado
- **WHEN** contexto de um gate obrigatório não está nas regras efetivas ou diverge do job executado
- **THEN** auditoria reprova conformidade e a release não é marcada como protegida por esse gate

#### Scenario: Falha controlada bloqueia merge
- **WHEN** PR descartável tem gate essencial falho, pendente ou ausente
- **THEN** merge permanece bloqueado conforme a política e o resultado é registrado como evidência da proteção efetiva

#### Scenario: Auditoria sem permissão
- **WHEN** o ambiente não pode consultar regras externas
- **THEN** reporta estado não comprovado, sem afirmar que jobs verdes demonstram proteção

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
