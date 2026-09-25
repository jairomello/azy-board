## Purpose

Definir a arquitetura dos contratos compartilhados do monorepo: localização em packages dedicados, separação por domínio, barrel de compatibilidade durante a migração e ausência de drift entre tipos, schema, backend e frontend.

## Requirements

### Requirement: Contratos compartilhados vivem em packages dedicados

Os contratos usados por mais de uma aplicação SHALL viver em packages do monorepo (`packages/`), acessíveis por nome de package (ex.: `@azy-board/domain`), não por caminho relativo de código-fonte. Cada app SHALL declarar suas dependências em `package.json`.

#### Scenario: App importa contrato por nome de package
- **WHEN** um app precisa de um tipo ou constante compartilhada
- **THEN** o import usa o nome do package (ex.: `import { TaskStatus } from '@azy-board/domain'`), não um caminho relativo para outro app

#### Scenario: Dependência declarada
- **WHEN** um app usa um package compartilhado
- **THEN** o `package.json` do app declara o package como dependência

#### Scenario: Build parcial funciona
- **WHEN** o Dockerfile copia apenas `apps/api` e `packages/`
- **THEN** o build resolve os packages sem precisar de `apps/mcp`

### Requirement: Separação por domínio

O pacote de tipos SHALL ser separado em packages por domínio: `domain` (enums de entidade), `api-contracts` (transporte HTTP, erros, auth), `realtime-contracts` (WebSocket), `assistant-contracts` (assistente e limites) e `ui-contracts` (preferências, presentation helpers, board adapter). Cada package SHALL exportar apenas o seu domínio.

#### Scenario: Enum de domínio em package de domínio
- **WHEN** um app precisa do enum `TaskStatus`
- **THEN** ele importa de `@azy-board/domain`

#### Scenario: Contrato WebSocket em package de realtime
- **WHEN** um app precisa do tipo `WsEvent`
- **THEN** ele importa de `@azy-board/realtime-contracts`

#### Scenario: Função de apresentação em ui-contracts
- **WHEN** um app precisa de `parseWorkDuration` ou `toCard`
- **THEN** ele importa de `@azy-board/ui-contracts`

### Requirement: Barrel de compatibilidade durante migração

O package `@azy-board/types` SHALL re-exportar todos os novos packages durante a migração, permitindo que imports existentes continuem funcionando. O barrel SHALL ser removido quando todos os apps estiverem migrados.

#### Scenario: Import legado funciona durante migração
- **WHEN** um código ainda usa `import { TaskStatus } from '@azy-board/types'`
- **THEN** o import resolve corretamente via barrel de compatibilidade

#### Scenario: Barrel não duplica definições
- **WHEN** o barrel re-exporta de um package
- **THEN** não há definição duplicada; typecheck detectaria conflitos

### Requirement: Tipos sem drift

Tipos compartilhados SHALL refletir o contrato real usado por schema, backend e frontend. Quando um tipo divergir, a fonte de verdade SHALL ser o schema de validação.

#### Scenario: AssistantProvider consistente
- **WHEN** o schema aceita `'OPENAI' | 'OPENROUTER'`
- **THEN** o tipo `AssistantProvider` em `@azy-board/assistant-contracts` declara `'OPENAI' | 'OPENROUTER'`

#### Scenario: Sem tipos locais duplicados
- **WHEN** um app precisa de um tipo que existe num package compartilhado
- **THEN** ele importa do package, não redeclara localmente
