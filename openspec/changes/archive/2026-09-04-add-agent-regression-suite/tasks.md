## 1. Infraestrutura da suíte

- [x] 1.1 Mapear os helpers de fixture existentes em `apps/api`, `apps/mcp` e criar um fixture isolado para tenant, usuário logado, projeto, módulo, colunas e hierarquia.
- [x] 1.2 Criar um provider fake determinístico para exercitar o harness sem credenciais ou chamadas externas.
- [x] 1.3 Organizar o arquivo/grupo de testes como suíte de regressão do agente, mantendo execução automática pelo `bun test`.

## 2. Criação e hierarquia

- [x] 2.1 Testar criação de projeto informando somente o nome e validar defaults, gerente/responsável e campos opcionais.
- [x] 2.2 Testar criação de projeto com nome, descrição e modo `HIERARCHICAL`, validando a configuração persistida.
- [x] 2.3 Testar criação individual de EPIC e resolução do módulo por nome.
- [x] 2.4 Testar criação de STORY com EPIC pai e todos os campos ricos relevantes.
- [x] 2.5 Testar criação de TASK com status, prioridade, pontos e responsável do usuário logado.
- [x] 2.6 Testar criação de subtask com TASK pai e validar `ancestryPath` e Leaf Rule.
- [x] 2.7 Testar rejeição de relações hierárquicas inválidas e criação de órfãos em projeto hierárquico.
- [x] 2.8 Testar batch ordenado de EPICs, STORYs e TASKs usando `ref`, `parentRef`, módulo por nome e atomicidade.

## 3. Atualizações recorrentes

- [x] 3.1 Testar alteração em lote de datas com filtros de tipo/status ou outro critério e confirmar que itens fora do escopo não mudam.
- [x] 3.2 Testar alteração em lote do responsável de TASKs por critério, preservando outros tipos e vínculos.
- [x] 3.3 Testar movimentação de TASKs entre listas/colunas e validar o status/coluna resultante.
- [x] 3.4 Testar mudança de TASKs entre histórias e rejeitar pai EPIC quando a regra exigir STORY/TASK/BUG.
- [x] 3.5 Testar atualizações em lote de reparenting, inclusive bloqueio de desvinculação que criaria órfãos.

## 4. Harness, catálogo e verificação

- [x] 4.1 Testar seleção e canonicalização das tools para criação simples, criação composta, batch e atualização filtrada.
- [x] 4.2 Testar prévia, aprovação, execução única, idempotência e saída resumida dos fluxos cobertos.
- [x] 4.3 Atualizar contratos/documentação do catálogo quando uma tool coberta for adicionada ou modificada.
- [x] 4.4 Confirmar que `bun test` descobre a suíte e que `bun run check` executa typecheck, lint, testes e builds sem etapa manual adicional.
- [x] 4.5 Executar a suíte completa e registrar qualquer ajuste necessário nos contratos antes de concluir a mudança.
