## Why

O Azy Agent seleciona tools principalmente por regex e expõe um conjunto fixo por mensagem, o que já causou escolhas erradas quando títulos de items coincidiram com palavras de comando. Ao mesmo tempo, restringir capacidades rigidamente pela tela reduziria a utilidade de um agente global; a oportunidade é usar o contexto como prioridade e alvo padrão, permitindo descoberta dinâmica e conclusão autônoma sempre que o usuário tiver permissão.

## What Changes

- Introduzir metadados de domínio, escopo, operação, risco, dependências e policy no registry compartilhado, sem criar tools-fachada nem alterar os nomes públicos existentes.
- Usar tela, projeto e item atuais como sinais de prioridade e valores padrão, não como bloqueios de capacidade.
- Permitir que intenção explícita carregue dinamicamente tools de outro domínio, mesmo fora da tela primária, após resolução do recurso e verificação de permissão.
- Definir precedência de alvo: recurso explicitamente informado pelo usuário, item selecionado, projeto atual e, por último, pergunta de esclarecimento.
- Enviar inicialmente apenas os schemas mais prováveis e ampliar o catálogo por busca interna de capabilities quando necessário.
- Devolver erros recuperáveis de tool ao modelo para que ele resolva dependências, corrija argumentos e tente novamente dentro dos limites da run.
- Encerrar imediatamente apenas em limites rígidos: autenticação, tenant, permissão, rejeição/expiração de aprovação, orçamento, timeout e comportamento repetitivo inseguro.
- Produzir resposta elegante somente depois que busca e recuperação não puderem concluir a solicitação, explicando a limitação ou permissão real sem exigir navegação desnecessária.
- Corrigir classificação de risco e divergências de schema/validator/executor no catálogo atual.

## Capabilities

### New Capabilities

- `adaptive-agent-tool-routing`: Define priorização contextual, descoberta progressiva, resolução de alvo, expansão cross-domain e recuperação automática de erros.

### Modified Capabilities

- `azy-agent-chat`: Passa a transportar contexto como alvo padrão e apresentar progresso, esclarecimento ou limitação somente quando a execução autônoma não for possível.
- `azy-agent-harness`: Passa a ampliar tools por rodada, devolver erros recuperáveis ao modelo e manter bindings/policies durante tentativas e aprovação.
- `assistant-context-optimization`: Passa a usar progressive disclosure de schemas sem transformar o conjunto inicial em allowlist rígida.
- `mcp-server`: Passa a expor metadados hierárquicos e schemas coerentes no registry compartilhado usado pelo MCP e pelo Azy Agent.
- `mcp-permissions`: Passa a filtrar descoberta por permissão efetiva e revalidar antes da execução, sem usar rota/tela como fronteira de autorização.

## Impact

- Frontend: `AssistantContext`, páginas protegidas e drawer passam a enviar tela/projeto/item como contexto opcional de prioridade.
- Backend: `routes/assistant.ts` e `assistantHarness` recebem um resolver adaptativo, catálogo progressivo e tratamento de erros recuperáveis.
- Registry MCP: as 57 tools recebem metadados; nomes e compatibilidade pública permanecem estáveis.
- Segurança: tenant, permissão e aprovação continuam rígidos; contexto visual nunca concede acesso.
- Persistência: preferencialmente reutiliza runs, eventos e tool calls existentes para registrar expansões/tentativas, evitando migração nesta primeira entrega.
- Testes: seleção inicial, expansão dinâmica, alvo explícito, recuperação, papéis, cross-tenant e regressões de títulos ambíguos.
