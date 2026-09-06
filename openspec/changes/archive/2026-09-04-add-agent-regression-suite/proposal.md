## Why

As mudanças estruturais do Azy Board podem quebrar o contrato entre o agente, as tools, a API e a interface sem que os testes atuais cubram os fluxos mais recorrentes. Precisamos de uma suíte de regressão executada no fluxo padrão de verificação para detectar falhas em criação, hierarquia, atribuição e atualizações em lote antes que cheguem ao uso real.

## What Changes

- Criar uma suíte de regressão do agente cobrindo criação de projetos com dados mínimos e completos.
- Cobrir criação de EPICs, STORYs, TASKs, subtasks e hierarquias em lote por referências nominais.
- Cobrir atualizações em lote de datas, responsáveis, listas/colunas e relacionamento com histórias ou épicos.
- Validar resolução de nomes, usuário logado, status inicial e preservação da ordem hierárquica.
- Integrar a suíte ao comando de verificação executado após mudanças significativas.
- Manter os testes determinísticos, isolados por tenant/projeto e sem depender de um provedor externo de IA.

## Capabilities

### New Capabilities

- `agent-regression-suite`: Contrato e cobertura dos fluxos recorrentes de mutação do Azy Agent.

### Modified Capabilities

- `azy-agent-harness`: O harness passa a ter uma suíte de regressão obrigatória para seus fluxos de tools e aprovações.
- `mcp-ai-first-workflow`: Os fluxos de criação hierárquica e atualização em lote passam a ser protegidos por testes de contrato executados continuamente.

## Impact

- Novos testes de integração/contrato em `apps/api`, `apps/mcp` e, quando necessário, `apps/web`.
- Scripts raiz de teste e verificação contínua.
- Contratos existentes de `create_project`, `create_task`, `batch`, `create_project_structure` e `update_items`.
- Banco SQLite de teste, fixtures de tenant, usuário logado, projeto e hierarquia.
- Nenhuma dependência externa ou mudança obrigatória no modelo de produção.
