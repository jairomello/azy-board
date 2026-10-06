Board ref: c7156663-1b21-44ed-9dfb-77a207ac9086

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

### Requirement: Bloqueio de merge por required checks

O repositorio SHALL documentar, configurar e comprovar os jobs essenciais como verificações obrigatórias das branches de release/principal conforme manifesto versionado. A política SHALL cobrir check, contratos, smoke autenticado, E2E, ADVANCED e imagem/restore com nomes e app emissor correspondentes às execuções reais. Regras efetivas e bypass SHALL ser auditados; YAML sozinho SHALL NOT comprovar bloqueio. Gates falhos, pendentes ou ausentes SHALL impedir merge, e alteração de nomes SHALL atualizar manifesto/proteção conjuntamente. Verificação externa SHALL usar contexto confiável sem expor credenciais privilegiadas a PR de fork.

#### Scenario: Gate reprovado impede merge
- **WHEN** um pull request tem qualquer gate obrigatório falho, pendente ou ausente
- **THEN** mesclagem permanece bloqueada e a prova controlada desse bloqueio é registrada

#### Scenario: Todos os gates aprovados liberam merge
- **WHEN** todos os gates obrigatórios passam e regras efetivas correspondem ao manifesto
- **THEN** pull request fica apto segundo as demais regras da branch, sem tratar etapa observacional como check obrigatório

#### Scenario: Contexto divergente
- **WHEN** job é renomeado ou app emissor difere do manifesto/proteção
- **THEN** auditoria falha até a política e a proteção efetiva serem reconciliadas
