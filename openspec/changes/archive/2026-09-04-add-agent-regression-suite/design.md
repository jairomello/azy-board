## Context

O Azy Agent possui testes unitários, testes de integração da API e verificações do catálogo, mas os fluxos de uso mais frequentes estão distribuídos entre `apps/api`, `apps/mcp` e a UI. Mudanças em entidades, schemas ou tools podem quebrar a cadeia completa sem falhar em um teste isolado. A suíte deve usar a infraestrutura de testes existente, fixtures determinísticas e uma API fake/in-memory quando o objetivo for contrato do agente.

## Goals / Non-Goals

**Goals:**

- Criar uma suíte nomeada e facilmente localizável para os fluxos essenciais do agente.
- Cobrir criação mínima/completa de projeto, hierarquia individual e lote.
- Cobrir alterações em lote por filtros para datas e responsáveis.
- Cobrir movimentação entre listas/colunas e reparenting de tasks.
- Executar a suíte pelo comando padrão `bun test` e, consequentemente, por `bun run check`.
- Validar contratos sem credenciais reais, chamadas de rede externa ou dependência de um modelo não determinístico.

**Non-Goals:**

- Não testar todas as ferramentas MCP existentes.
- Não substituir testes unitários específicos de cada rota ou componente.
- Não criar um ambiente separado de CI nesta mudança.
- Não fazer chamadas reais ao provedor de IA.

## Decisions

- **Usar testes de integração com API e fixtures isoladas:** os casos de mutação precisam confirmar persistência, hierarquia, tenant, status e atribuição. A alternativa de testar apenas o prompt/modelo não detectaria regressões no backend.
- **Usar um agente/provider determinístico fake para o fluxo do harness:** chamadas de tools, aprovação e continuidade serão simuladas por respostas fixas. A alternativa de usar OpenAI em testes é lenta, instável e exige credenciais.
- **Organizar casos por capacidade e não por entidade:** cada teste representa uma tarefa recorrente do usuário e pode atravessar tool, API e persistência. A alternativa de um teste por endpoint fragmentaria o contrato.
- **Manter o limite do lote dentro do limite de produção:** o cenário em lote usará EPICs, STORYs e TASKs em ordem, com `ref`/`parentRef`, para validar a resolução de nomes sem depender de IDs inventados.
- **Adicionar o arquivo ao fluxo existente de `bun test`:** Bun já descobre arquivos `*.test.ts`, portanto a suíte será executada automaticamente sem um runner novo. O comando `bun run check` continuará sendo a porta de entrada para mudanças estruturais.

## Risks / Trade-offs

- [Suíte excessivamente acoplada ao schema atual] → usar helpers de fixture e assertions sobre o contrato público, evitando snapshots integrais do banco.
- [Execução lenta por muitos cenários de integração] → agrupar cenários relacionados por fixture e manter o provider fake; medir o tempo no comando padrão.
- [Falsa sensação de cobertura do modelo] → testar tanto a seleção/canonicalização de tools quanto a execução real, deixando explícito que não é teste de qualidade de resposta do LLM.
- [Mudança de uma tool sem atualização da suíte] → incluir a suíte no `bun test`/`bun run check` e documentar o grupo como contrato obrigatório.

## Migration Plan

1. Criar fixtures reutilizáveis para tenant, usuário logado, projeto, módulo, épico, história e colunas.
2. Implementar os cenários da nova capacidade e adaptar helpers existentes sem alterar dados de desenvolvimento.
3. Registrar a suíte no fluxo padrão e executar typecheck, testes, lint e build.
4. Em caso de falha após uma mudança estrutural, corrigir a implementação ou atualizar explicitamente o contrato e seus testes; não ignorar o arquivo no runner.

## Open Questions

- Nenhuma para a primeira implementação; os casos devem usar os contratos já existentes de API, MCP e harness.
