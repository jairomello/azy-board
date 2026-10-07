Board ref: c7156663-1b21-44ed-9dfb-77a207ac9086

## ADDED Requirements

### Requirement: Inventário de checks sem promessa de bloqueio externo

O repositório SHALL manter manifesto dos jobs/contextos de CI e validar localmente sua correspondência com `.github/workflows/ci.yml`. Esta change SHALL NOT configurar branch protection/rulesets, exigir confirmação externa de required checks nem afirmar que o merge está bloqueado. Estado externo desconhecido SHALL ser rotulado `NOT_PROVEN`; alteração de nomes dos jobs SHALL atualizar o manifesto.

#### Scenario: Workflow diverge do manifesto
- **WHEN** job essencial é removido ou seu contexto muda sem atualização do manifesto
- **THEN** a auditoria local detecta a divergência e informa o contexto esperado/observado

#### Scenario: Proteção externa não comprovada
- **WHEN** a API de proteção GitHub não pode ser consultada com credencial apropriada
- **THEN** o manifesto registra `NOT_PROVEN` e a documentação não promete bloqueio de merge

## MODIFIED Requirements

### Requirement: Smoke test do fluxo web e API

O workflow SHALL subir API e frontend em instalações descartáveis SIMPLE e ADVANCED e executar smoke essencial autenticado reutilizável por comando. SHALL verificar raiz 200, live/readiness, auth/me 401 sem sessão, login/cookie, criação/edição/movimento/leitura de item e persistência após nova leitura, negativa de mutação VIEWER e isolamento de outro tenant. A jornada básica do agente SHALL usar provider determinístico somente de teste e worker conforme o perfil. A falha de qualquer etapa SHALL reprovar o job, com teardown garantido e diagnóstico sem segredos.

#### Scenario: Servicos respondem
- **WHEN** API e frontend de cada perfil estão no ar com setup descartável
- **THEN** smoke valida raiz/live/readiness, 401 sem sessão e fluxo autenticado completo, incluindo negativa de permissões

#### Scenario: Servico indisponivel
- **WHEN** API, frontend ou worker necessário não sobem ou respondem inesperadamente
- **THEN** smoke falha, publica diagnóstico e não substitui boot real por teste de adapter

#### Scenario: Item não persiste
- **WHEN** criação, edição ou movimentação aparenta sucesso mas nova leitura não confirma estado persistido
- **THEN** smoke reprova o perfil mesmo que os três endpoints de disponibilidade respondam corretamente

#### Scenario: Isolamento negado
- **WHEN** usuário VIEWER tenta mutação ou usuário de outro tenant tenta ler o projeto criado
- **THEN** operação é negada e nenhum estado proibido é persistido ou revelado

## REMOVED Requirements

### Requirement: Bloqueio de merge por required checks
**Reason**: Por decisão do usuário em 2026-10-07, branch protection/rulesets externos, required checks efetivos e prova de bloqueio de merge não fazem parte desta change; a API de proteção não pôde ser consultada com acesso autenticado.
**Migration**: Usar o inventário local de checks e evidências `NOT_PROVEN`. A documentação limita suas afirmações aos jobs do workflow e não afirma que eles bloqueiam merge.
