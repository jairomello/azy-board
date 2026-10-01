## Why

Hoje cada tenant possui uma única configuração de provider/modelo para o Azy Agent. Se ela falha no momento de uma chamada, a run falha mesmo quando o tenant poderia ter outros modelos e credenciais válidos disponíveis.

## What Changes

- Permitir que ROOT cadastre, teste, edite, ordene, habilite, desabilite e remova N configurações de modelo por tenant.
- Usar a ordem definida pelo ROOT como prioridade de execução e tentar o próximo modelo elegível quando uma chamada ao provider falhar.
- Preservar o estado global de disponibilidade e os limites de governança atuais, permitindo habilitar o Azy Agent quando houver pelo menos um modelo ativo e validado.
- Migrar a configuração única existente para a primeira entrada da lista, sem interromper tenants já configurados.
- Atualizar a tela ROOT com uma lista ordenável de modelos e um formulário de inclusão/edição.
- Incluir o protótipo SVG da nova seção em `model-fallback-prototype.svg`.

## Capabilities

### New Capabilities

### Modified Capabilities
- `ai-provider-configuration`: substituir a configuração única por uma lista ordenada de modelos/provider por tenant, com CRUD seguro e fallback.
- `assistant-availability`: definir disponibilidade conforme a existência de pelo menos um modelo ativo e validado, preservando governança e isolamento do tenant.
- `agent-worker-process`: conectar o worker já existente ao servidor e ao fluxo da fila para que runs enfileiradas sejam efetivamente executadas com as configurações atuais do tenant.

## Impact

- API e persistência do Azy Agent: `assistant_settings`, credenciais e configuração dos modelos, worker e reconstrução do contexto da run.
- Endpoints ROOT de configuração/teste/reordenação e resolução do provider no runtime.
- `apps/web/src/components/RootAssistantSettings.tsx`, contratos compartilhados, traduções PT-BR/EN/ES e testes de API, persistência e harness.
- Banco SQLite e PostgreSQL, com migração retrocompatível da configuração já existente; sem novas dependências externas.

Board ref: 64203ebf-a76c-44ba-952e-e06ed53c616b
