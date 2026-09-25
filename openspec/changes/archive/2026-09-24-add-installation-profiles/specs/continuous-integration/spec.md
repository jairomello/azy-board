## ADDED Requirements

### Requirement: Matriz de perfis de instalação no CI

O CI SHALL validar o perfil SIMPLE sem PostgreSQL/Redis e executar gate separado com PostgreSQL e serviço Redis-compatível temporários para o perfil ADVANCED. O gate avançado SHALL verificar migrations de schema idempotentes, setups novos independentes, isolamento por tenant, jornadas críticas HTTP/MCP, coordenação e rejeição da troca de perfil em instalações já marcadas; falhas SHALL impedir considerar o perfil ADVANCED pronto. A suíte local padrão `bun run check` SHALL continuar funcional sem serviços externos.

#### Scenario: Check local simples sem serviços
- **WHEN** o desenvolvedor executa `bun run check` sem PostgreSQL nem Redis
- **THEN** typecheck, lint, testes SIMPLE e build são executados sem exigir esses serviços

#### Scenario: Gate avançado com serviços efêmeros
- **WHEN** CI testa ADVANCED com PostgreSQL e Valkey inicializados
- **THEN** migrations, setup, integridade, autorização e jornadas HTTP/MCP passam sobre o banco avançado

#### Scenario: Perfis misturados ou configuração inconsistente
- **WHEN** um ajuste quebra paridade, isolamento ou rejeição de tentativa de trocar o perfil registrado de uma instalação
- **THEN** o gate avançado falha antes de permitir publicação desse perfil
