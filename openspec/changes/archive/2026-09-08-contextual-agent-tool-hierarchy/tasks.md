## 1. Registry e consistência do catálogo

- [x] 1.1 Definir tipos compartilhados de domínio, escopo, operação, risco, dependency tools, tipos de alvo e policy.
- [x] 1.2 Anotar as 57 tools existentes com metadados adaptativos sem alterar nomes públicos ou comportamento do MCP externo.
- [x] 1.3 Reclassificar `claim_task`, `create_checklist`, `add_checklist_item` e `check_item` como operações de escrita com risco/aprovação coerentes.
- [x] 1.4 Corrigir divergências de `list_attachments.itemId`, filtros de `list_tasks/get_tree`, datas de `create_sprint` e demais inconsistências encontradas.
- [x] 1.5 Ampliar `check-mcp-catalog` para verificar metadata, schema, validator, policy e dispatcher de toda tool.

## 2. Contexto como prioridade

- [x] 2.1 Ampliar `AssistantPageContext` com screen, projeto, item, modo/subvisão do board e filtros relevantes.
- [x] 2.2 Publicar contexto nas páginas de projetos, Kanban, árvore, dashboard, configurações, conta e administração sem herdar projeto em telas globais.
- [x] 2.3 Enviar contexto em conversa, mensagem e ajuste como sinal de prioridade, mantendo autorização server-side.
- [x] 2.4 Implementar precedência de alvo explícito, item selecionado, projeto atual e pergunta de esclarecimento.
- [x] 2.5 Impedir que títulos, descrições, CSV ou retrieval alterem intenção/escopo, cobrindo o caso de item chamado "Projetos".

## 3. Resolver adaptativo e progressive disclosure

- [x] 3.1 Implementar índice interno de capabilities derivado do registry e busca por domínio, operação, alvo e intenção.
- [x] 3.2 Selecionar conjunto inicial pequeno por contexto/intenção sem transformá-lo em allowlist rígida.
- [x] 3.3 Permitir expansão para dependency tools read-only necessárias à resolução de nomes e IDs.
- [x] 3.4 Permitir pedido cross-domain explícito para criação de projeto fora de `/projects`, mantendo a autorização REST como barreira final.
- [x] 3.5 Registrar expansões, domínios e contagem de schemas por rodada usando eventos existentes, sem prompt completo ou PII desnecessária.
- [x] 3.6 Manter feature toggle `AZY_AGENT_TOOL_ROUTING=legacy|adaptive` para comparação e rollback do seletor.

## 4. Recuperação automática de erros

- [x] 4.1 Criar classificação sanitizada de erros recuperáveis e terminais para respostas de tool/API.
- [x] 4.2 Devolver ao modelo como function output erros de validação, dependência ausente, nome duplicado, recurso não resolvido, estado conflitante e tool não carregada.
- [x] 4.3 Permitir correção de argumentos, carregamento de dependencies e nova tentativa com assinatura diferente dentro dos limites da run.
- [x] 4.4 Manter terminal autenticação, tenant, permissão, escopo de API key, aprovação rejeitada/expirada, budgets, timeout e repetição sem progresso.
- [x] 4.5 Garantir que recuperação não exponha SQL, stack, payload sensível, IDs fora de escopo ou detalhes de infraestrutura.

## 5. Binding, policy e aprovação

- [x] 5.1 Injetar projeto/item atuais quando não houver alvo explícito e resolver server-side qualquer alvo alternativo solicitado.
- [x] 5.2 Exibir projeto efetivo no preview e incluir o alvo no operation hash.
- [x] 5.3 Filtrar busca/carregamento por grupo global, membership, manager, papel local, projeto restrito, tenant e API key scope.
- [x] 5.4 Aplicar policy antes de tool call/preview e revalidar tudo na rota REST no momento da execução.
- [x] 5.5 Fazer a aprovação usar o fluxo seguro do harness, revalidando provider, policy, alvo e hash depois da decisão humana.

## 6. Experiência do chat

- [x] 6.1 Manter a mesma run durante busca de capability, resolução de dependência e tentativa recuperável.
- [x] 6.2 Exibir mensagens localizadas em PT-BR, EN e ES somente para informação obrigatória ausente, permissão real, capability não implementada ou limite terminal.
- [x] 6.3 Oferecer navegação como conveniência quando não houver tool, nunca como requisito para capability executável.
- [x] 6.4 Converter códigos internos como `TOOL_NOT_ALLOWED_FOR_RUN` e `TOOL_NOT_REGISTERED` em estados seguros sem ocultar o diagnóstico nos logs.

## 7. Testes e rollout

- [x] 7.1 Criar testes do registry para metadata completa, risco, policy, dependencies e paridade schema-validator-executor.
- [x] 7.2 Criar matriz context × intent × role cobrindo `/projects`, board, árvore, dashboard, settings, item, conta e administração.
- [x] 7.3 Cobrir pedido cross-domain autorizado, incluindo criar projeto dentro de um board, e garantir que não exige navegação.
- [x] 7.4 Cobrir alvo explícito diferente do contexto, nomes ambíguos e títulos com palavras de capability.
- [x] 7.5 Cobrir recuperação de módulo ausente, projeto duplicado, argumento inválido, estado conflitante e retry transitório.
- [x] 7.6 Cobrir erros terminais, loops, budgets, downgrade de papel, projetos restritos, API key scoped e isolamento entre tenants.
- [x] 7.7 Cobrir frontend para publicação/limpeza de contexto, progresso da run e mensagens localizadas.
- [x] 7.8 Atualizar `SECURITY_CHECKLIST.md`, documentação do Azy Agent e referências da skill oficial.
- [ ] 7.9 Executar `bun run check` e validar manualmente pedidos locais, cross-domain, recuperáveis e proibidos com feature toggle ligado/desligado.
