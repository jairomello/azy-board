## Context

O Azy Board é um monorepo Bun/Hono/React com autenticação por sessão JWT, grupos globais `TEAM_MEMBER`/`MANAGER`/`ADMIN`/`ROOT`, isolamento por tenant, API orientada a agentes e um servidor MCP em `apps/mcp`. O catálogo MCP contém dezenas de tools tipadas, com políticas e validações próprias. A skill oficial em `skills/azyboard/` já descreve os fluxos AI First e os comandos semânticos.

O novo Azy Agent será uma capacidade do produto para usuários humanos. O Root configura se o recurso existe no tenant e qual credencial/modelo OpenAI será usado; o usuário conversa por uma cortina lateral e pode pedir explicações ou ações. O servidor deve ser o único lugar com acesso a credenciais e deve executar ações como o usuário solicitante, nunca como Root por procuração.

A pesquisa de padrões atuais orienta as decisões: a Responses API oferece um ciclo explícito de resposta, function calls e `function_call_output`; o Agents SDK oferece um loop pronto, sessões, guardrails e approvals, mas reduz o controle do produto sobre autorização e estado. MCP recomenda credenciais em ambiente para transporte stdio, enquanto OAuth é relevante para transports HTTP. A documentação atual do Codex distingue login ChatGPT/token plan de API key e recomenda access tokens apenas para automação confiável, não como API key genérica.

## Goals / Non-Goals

**Goals:**

- Controlar a disponibilidade do assistente por tenant e expor a UI somente quando houver toggle e provider válido.
- Implementar o MVP com OpenAI Responses API e API key.
- Manter credenciais server-side, cifradas em repouso, rotacionáveis e ausentes de payloads, logs e browser.
- Criar um harness determinístico e auditável: contexto, catálogo de tools, autorização, loop limitado, aprovação, execução, erro, retry e conclusão.
- Reutilizar executores/contratos MCP sem duplicar regras de domínio e impor a identidade do usuário humano atual.
- Responder perguntas fundamentadas em documentação e skill, recusar fora do domínio e ensinar fluxos passo a passo.
- Suportar texto/CSV com prévia, validação, perguntas de esclarecimento, idempotência e confirmação antes de criar em lote.
- Entregar streaming de texto, andamento de tools, pedidos de confirmação e perguntas de esclarecimento com retomada.
- Preservar uma interface de provider adapter para futuros Anthropic, OpenRouter e outros providers.

**Non-Goals:**

- Não permitir que o modelo execute código, shell, browser, chamadas HTTP arbitrárias ou tools fora do Azy Board.
- Não expor chain-of-thought bruto; a UI recebe resposta, evidências, chamadas de tools e resumos seguros.
- Não transformar o assistente em administrador global, mesmo quando o usuário for Root; cada ação continuará sujeita ao contexto do usuário e do projeto.
- Não suportar Anthropic, OpenRouter ou OpenCode Go no MVP, apenas deixar contratos extensíveis.
- Não aceitar tokens OAuth genéricos ou tokens de sessão do ChatGPT como se fossem API keys da API OpenAI sem contrato oficialmente documentado.
- Não criar autonomia em background sem uma solicitação e um estado de aprovação retomável.

## Decisions

- **Responses API com harness próprio no MVP.** O loop será controlado pelo Azy Board: preparar contexto, enviar mensagem/tools, validar cada function call, solicitar aprovação quando necessário, executar, devolver resultado sanitizado e continuar até resposta final ou limite. Isso é preferível ao Agents SDK neste estágio porque autorização, persistência, tenant e aprovação são responsabilidades do produto. O Agents SDK fica como alternativa futura para experimentos, desde que não substitua os gates server-side.
- **Provider adapter estável.** Definir `ModelProvider` com `createRun`, `streamRun`, `cancelRun`, `validateCredential` e capacidades declaradas. A implementação `OpenAIProvider` usa Responses API e `strict: true`; credenciais são resolvidas por `providerCredentialId`, nunca recebidas do cliente.
- **Configuração no tenant, credencial Root-owned.** Uma configuração ativa pertence ao tenant e referencia uma credencial protegida criada pelo Root. Usuários comuns não veem valor, prefixo completo, refresh token ou detalhes sensíveis; podem apenas usar o assistente se habilitado. Rotação cria nova versão e só desativa a anterior após teste bem-sucedido.
- **Registry interno compartilhado com MCP.** Extrair/compartilhar definições de nome, descrição, JSON Schema, política mínima e executor entre `apps/mcp` e o harness. O adaptador não chama o processo stdio nem usa a API Key MCP do Root; injeta `RequestContext` do usuário e passa por uma autorização comum antes do executor.
- **Tool surface progressiva.** Começar cada turno com poucas tools de descoberta/leitura e carregar tools de planejamento/mutação conforme a intenção, em vez de enviar as 55 tools sempre. O registry poderá usar namespaces e busca interna; cada tool permanece estritamente tipada e com `additionalProperties: false` quando compatível.
- **Máquina de estados persistida.** Uma execução terá estados `QUEUED`, `RUNNING`, `WAITING_USER`, `WAITING_APPROVAL`, `COMPLETED`, `FAILED`, `CANCELLED` e `EXPIRED`. Mensagens, eventos, tool calls, prévias e aprovações são persistidos para reconexão e retomada; o cliente nunca decide o próximo estado.
- **Aprovação por risco.** Leituras e cálculos sem efeito colateral podem rodar automaticamente. Criação/edição em lote, movimentação, claim, arquivamento e exclusão exigem preview e confirmação configurável; exclusões e ações cascata sempre exigem confirmação explícita. A aprovação inclui resumo, escopo, contagem, diff e expiração, e fica vinculada ao hash da operação para impedir replay alterado.
- **Contexto mínimo e proveniência.** O prompt inclui identidade não sensível do usuário, tenant/projeto selecionado, estado consultado e trechos versionados da documentação/skill. Conteúdo de cards e arquivos colados é dado não confiável: deve ser delimitado e nunca substituir instruções do sistema. Respostas de knowledge devem citar a referência usada quando possível.
- **CSV como import pipeline, não tool direta.** O backend detecta texto/CSV, limita tamanho/linhas, faz parsing seguro, normaliza colunas, mapeia tipos e relações, reporta erros por linha e gera uma prévia idempotente. Só após confirmação converte o plano em operações `create_task`/`batch` autorizadas.
- **Streaming por SSE inicialmente.** Chat POST cria a mensagem/run e um endpoint SSE entrega tokens, tool lifecycle, approval/question e finalização. O stream pode ser reconectado por `runId`/cursor; a fonte da verdade é o banco. WebSocket existente pode ser integrado depois sem mudar o contrato do run.
- **Observabilidade sem conteúdo sensível.** Registrar run, latência, tokens/custo informado pelo provider, modelo, tool name, duração, resultado resumido, erro e ator. Redigir chaves, prompts completos, CSV bruto e PII conforme política de retenção. Métricas e traces devem permitir detectar loops, rejeições e custo anormal.
- **Knowledge curada antes de RAG complexo.** O MVP indexa/empacota documentação confiável da wiki, `docs/AI_FIRST_PLAYBOOKS.md`, README MCP, skill e specs selecionadas em chunks versionados; busca lexical/embeddings só retorna trechos permitidos. Não usar web search nem conhecimento externo para responder como se fosse contrato do Azy Board.

## Risks / Trade-offs

- [Prompt injection em cards, CSV ou documentação alterada] → separar instruções confiáveis de dados, marcar conteúdo não confiável, não permitir que texto do board altere políticas e testar ataques de override.
- [Tool com efeito colateral executada sem intenção clara] → classificação de risco, preview, confirmação por hash, idempotency key e autorização novamente no momento da execução.
- [Credencial Root central cria blast radius e custo compartilhado] → tenant isolation, quotas, rate limits por usuário, limites de custo, auditoria e revogação imediata.
- [Loop do agente pode ficar caro ou infinito] → limite de passos, tokens, tempo, tool calls, tamanho de contexto e detecção de repetição; interromper com estado retomável.
- [Respostas do provider podem conter raciocínio ou dados sensíveis] → persistir apenas eventos necessários, sanitizar tool outputs e apresentar ao usuário resumo de decisão, não chain-of-thought.
- [55 tools aumentam erro de seleção] → catálogo progressivo, busca/namespace e schemas estritos; medir taxa de sucesso por intenção antes de ampliar o conjunto inicial.
- [Dados do chat podem exigir retenção e exclusão] → política explícita por tenant, endpoints de exclusão/exportação planejados e jobs de expiração de runs/eventos.

## Migration Plan

1. Criar migrações aditivas para configuração do tenant, credenciais, conversas, mensagens, runs, tool calls, aprovações e auditoria; defaults mantêm o assistente desligado.
2. Implementar provider OpenAI API key, teste de conexão e configuração Root sem habilitar UI automaticamente.
3. Implementar registry/executores compartilhados e harness somente com tools de leitura em ambiente de teste.
4. Adicionar guardrails, aprovação, mutações idempotentes, CSV preview e auditoria antes de liberar tools de escrita.
5. Adicionar knowledge pack versionado, chat streaming, cortina lateral e integração de estado global.
7. Habilitar o toggle para tenants existentes somente após migração; rollback desabilita o assistente e interrompe novas runs, preservando dados para diagnóstico. Revogar credenciais e cancelar runs ativos antes de remoção de tabelas em uma migração futura.

## Open Questions

- O tenant terá um orçamento mensal global, orçamento por usuário ou ambos, e qual ação ocorre quando o limite é atingido?
- O histórico de conversas será retido por padrão por quanto tempo e o Root poderá configurar essa retenção?
- Quais tools de escrita entrarão no primeiro allowlist do MVP, além de criação/atualização de itens e checklists?
- Será necessário suporte a anexos binários na primeira versão ou somente texto/CSV colado?
