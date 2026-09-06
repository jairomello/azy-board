## 1. Contratos E Modelo De Dados

- [x] 1.1 Mapear contratos atuais de tenant, grupos globais, sessão JWT, API, MCP, skill, auditoria, WebSocket e componentes de shell sem alterar comportamento existente.
- [x] 1.2 Definir tipos compartilhados para disponibilidade, provider, credencial, conversa, mensagem, run, evento, tool call, preview e aprovação.
- [x] 1.3 Criar migrações aditivas tenant-scoped para configuração do assistente, credenciais cifradas, conversas, mensagens, runs, eventos, tool calls, aprovações e índices operacionais.
- [x] 1.4 Garantir defaults seguros para dados existentes: assistente desligado, nenhuma credencial ativa e nenhuma conversa criada.
- [x] 1.5 Documentar política de retenção, exclusão, auditoria, custo e classificação de dados antes de persistir conteúdo de chat ou CSV.

## 2. Configuração Root E Credenciais

- [x] 2.1 Implementar endpoints protegidos para consultar/alterar disponibilidade, configurar provider, testar conexão, ativar, rotacionar e revogar credencial, exigindo `ROOT` no escopo do tenant.
- [x] 2.2 Implementar serviço de cifragem/decifragem server-side com chave de ambiente, versionamento de ciphertext, rotação e tratamento de falha sem revelar segredo.
- [x] 2.3 Implementar adapter OpenAI por API key usando cliente oficial e validação de modelo, timeout, erros, limites e `safety_identifier` privacy-preserving.
- [x] 2.4 Remover OAuth/token plan do escopo; o Azy Agent usa somente API keys oficiais da API de modelos.
- [x] 2.5 Implementar capability probe que diferencie credencial compatível com API de modelos de login/token de produto sem audience ou escopo adequado.
- [x] 2.6 Criar testes de autorização Root/non-Root, isolamento tenant, segredo ausente em payload/log/erro, rotação, revogação e timeout.

## 3. Registry De Tools E Integração MCP

- [x] 3.1 Extrair definições de nome, descrição, JSON Schema, política mínima e executor para um registry compartilhado por `apps/mcp` e pelo Azy Agent.
- [x] 3.2 Adaptar executores internos para receber explicitamente o contexto do usuário humano, tenant, projeto e metadados do run, sem reutilizar API Key Root ou credencial MCP compartilhada.
- [x] 3.3 Revalidar autorização no momento da execução e preservar anti-IDOR, Leaf Rule, hierarquia, escopos e sanitização de respostas já existentes.
- [x] 3.4 Implementar seleção progressiva de tools, começando com leituras/discovery e carregando namespaces de planejamento/mutação por intenção, com fallback seguro para tool não registrada.
- [x] 3.5 Mapear os comandos da skill oficial (`status`, `plan`, `start`, `update`, `complete`, `review`) para intents do registry e atualizar a skill quando o catálogo mudar.
- [x] 3.6 Criar testes de paridade MCP/harness para schemas, políticas, autorização por usuário, tool desconhecida, resposta sanitizada e regressão do servidor MCP.

## 4. Harness E Segurança Do Agente

- [x] 4.1 Implementar abstração `ModelProvider` e adapter OpenAI Responses API com function tools estritas, suporte a múltiplos calls, resultados e streaming.
- [x] 4.2 Implementar máquina de estados persistida `QUEUED`, `RUNNING`, `WAITING_USER`, `WAITING_APPROVAL`, `COMPLETED`, `FAILED`, `CANCELLED` e `EXPIRED`, com retomada segura.
- [x] 4.3 Implementar prompt de sistema do Azy Agent com escopo de domínio, regras de autorização, hierarquia, Leaf Rule, uso de fontes, recusa e tratamento de conteúdo não confiável.
- [x] 4.4 Implementar validação de argumentos, allowlist por run, limite de passos/tool calls/tokens/tempo/payload/custo e detecção de loop ou repetição.
- [x] 4.5 Implementar classificação de risco, preview/diff, hash da operação, expiração e aprovação/rejeição humana antes de mutações; exclusões e cascatas sempre exigem confirmação.
- [x] 4.6 Implementar idempotência, cancelamento, timeout, retry somente para erros seguros e revalidação de toggle/provider/permissão antes de cada tool call.
- [x] 4.7 Sanitizar tool outputs, erros, logs e eventos; não persistir nem exibir chain-of-thought bruto, secrets, prompts completos ou PII desnecessária.
- [x] 4.8 Criar testes unitários e de integração para loop, múltiplas tools, pergunta de esclarecimento, aprovação alterada, cancelamento, limites, prompt injection e isolamento entre usuários/tenants.

## 5. Knowledge E Importação

- [x] 5.1 Criar pipeline de knowledge pack versionado com wiki relevante, `docs/AI_FIRST_PLAYBOOKS.md`, README MCP, skill oficial e specs selecionadas.
- [x] 5.2 Implementar busca/retrieval limitada às fontes curadas, com referências/proveniência e atualização reproduzível sem web search ou dados externos.
- [x] 5.3 Implementar guardrail de domínio e testes para pergunta fora do Azy Board, instrução conflitante em card/CSV e tentativa de override do sistema.
- [x] 5.4 Implementar parser seguro de texto/CSV com limites de tamanho/linhas, detecção de colunas, normalização, mapeamento de tipos/relações e erros por linha.
- [x] 5.5 Implementar pipeline de prévia idempotente para criação em lote, perguntas de esclarecimento e conversão final em `create_task`/`batch` autorizado.

## 6. API De Chat E Streaming

- [x] 6.1 Criar endpoints autenticados para listar/criar/retomar/excluir conversas e enviar mensagens associadas ao tenant, usuário e projeto opcional.
- [x] 6.2 Criar endpoint SSE reconectável por `runId`/cursor para tokens, status, tool lifecycle, perguntas, aprovações, erros e conclusão.
- [x] 6.3 Criar endpoints para responder pergunta, aprovar/rejeitar preview e cancelar run, validando ownership, expiração e estado da máquina.
- [x] 6.4 Implementar rate limit, quotas, orçamento por tenant/usuário, limites de concorrência e mensagens de erro operacionais sem vazamento.
- [x] 6.5 Adicionar auditoria e métricas para runs, modelo, latência, tokens/custo, tools, aprovações, recusas, falhas e cancelamentos sem conteúdo sensível.

## 7. Interface Humana

- [x] 7.1 Criar tela/seção Root para toggle, status do provider, modelo, API key, teste de conexão, rotação e revogação.
- [x] 7.2 Adicionar contexto global de disponibilidade carregado após autenticação, com atualização quando o toggle/provider mudar e sem expor credenciais.
- [x] 7.3 Implementar botão e cortina lateral direita do Azy Agent com layout desktop/mobile, abrir/fechar, projeto atual, histórico e estado indisponível.
- [x] 7.4 Implementar renderização de streaming, mensagens, fontes, progresso de tools, prévias, aprovação/rejeição, perguntas e erros retomáveis.
- [x] 7.5 Implementar colagem de texto/CSV, prévia tabular, erros por linha, respostas de esclarecimento e feedback de importação por item.
- [x] 7.6 Adicionar acessibilidade, foco, teclado, ARIA, responsividade, i18n PT-BR/EN/ES e testes de interação da cortina.

## 8. Documentação, Observabilidade E Entrega

- [x] 8.1 Atualizar README, wiki, skill oficial e guidelines com configuração Root por API key, limites, privacidade e comandos do chat.
- [x] 8.2 Atualizar `SECURITY_CHECKLIST.md` com threat model de prompt injection, confused deputy, credenciais, tenant isolation, aprovação e custo.
- [x] 8.3 Adicionar testes de contrato das rotas, migrações SQLite, provider mock, SSE, harness, CSV, permissões, regressão MCP e cenários adversariais.
- [x] 8.4 Executar `bun run typecheck`, `bun run test:integration`, `bun run test:mcp`, `bun run test:mcp-catalog`, testes do Azy Agent, `bun test`, lint e build.
- [x] 8.5 Fazer red-team do agente com prompts fora do domínio, conteúdo malicioso, requests ambíguos, ações destrutivas, replay e falhas do provider antes de habilitar em produção.
- [x] 8.6 Validar rollout com feature flag desligada por padrão, migração, monitoramento, rollback, revogação de credenciais e atualização da skill sem alterar contratos MCP existentes.
