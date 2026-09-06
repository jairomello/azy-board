## Why

O Azy Board já oferece uma superfície rica de operações por MCP e uma skill para orientar agentes externos, mas usuários humanos ainda precisam conhecer a interface e executar cada ação manualmente. O Azy Agent deve transformar esses mesmos contratos em um assistente contextual dentro do produto, capaz de ensinar o uso do board, responder perguntas fundamentadas e executar operações autorizadas com confirmação e rastreabilidade.

Esta é uma mudança grande porque introduz um novo produto dentro do produto: configuração centralizada de provedor, consumo de modelo, conversação persistida, harness de tools, importação de texto/CSV, streaming, guardrails, aprovação humana e observabilidade. O MVP será limitado a modelos OpenAI usando API key; outros provedores serão extensões posteriores.

## What Changes

- Adicionar ao painel de administração Root um toggle global por tenant para habilitar ou desabilitar o Azy Agent na interface humana.
- Adicionar configuração Root de modelo OpenAI por API key.
- Armazenar credenciais apenas no servidor, cifradas, com rotação, revogação, teste de conexão e sem exposição ao browser, logs ou respostas da API.
- Exibir uma cortina lateral de chat no lado direito, abrível/fechável, responsiva e disponível em toda a interface somente quando o assistente estiver habilitado e configurado.
- Criar o harness server-side do Azy Agent sobre a Responses API, com loop limitado de tool calls, contexto de usuário/tenant/projeto, streaming de eventos e retomada após perguntas ou aprovações.
- Reutilizar os recursos do Azy Board e o catálogo MCP como tools internas tipadas, mantendo a autorização efetiva do usuário humano e registrando cada execução.
- Permitir que o usuário consulte a documentação do Azy Board, aprenda fluxos e execute comandos equivalentes à skill, incluindo criação em lote por texto/CSV, com validação, prévia, perguntas de esclarecimento e confirmação de mutações relevantes.
- Aplicar guardrails de escopo: o agente só responde sobre Azy Board e só executa operações dentro do Azy Board permitidas ao usuário; solicitações fora do domínio são recusadas de forma segura.
- Adicionar limites de custo, tamanho, tempo, passos, concorrência e rate limit, além de auditoria, métricas e testes adversariais.
- Definir uma arquitetura de provedores extensível para incluir Anthropic, OpenRouter e outros no futuro sem alterar o contrato do chat ou do harness.

## Capabilities

### New Capabilities

- `assistant-availability`: habilitação global do Azy Agent por tenant e disponibilidade controlada na interface.
- `ai-provider-configuration`: configuração segura de modelo OpenAI por API key, com extensibilidade para provedores futuros.
- `azy-agent-chat`: conversa contextual em cortina lateral, streaming, histórico, anexos de texto/CSV e perguntas de esclarecimento.
- `azy-agent-harness`: execução server-side de ciclos de raciocínio/tool calls com contexto, guardrails, aprovação humana, autorização, idempotência, auditoria e limites operacionais.
- `azy-agent-knowledge`: respostas fundamentadas na documentação, skill e contratos do Azy Board, com recusa de assuntos fora do domínio.

### Modified Capabilities

- `mcp-server`: reutilizar o catálogo e as regras de autorização MCP como fonte de tools internas do Azy Agent, sem relaxar contratos ou permissões existentes.
- `mcp-permissions`: explicitar que a execução interna de uma tool pelo Azy Agent deve aplicar a identidade e permissões do usuário humano solicitante, não uma credencial Root ou API Key compartilhada.

## Impact

- Novas tabelas/migrações para configuração de assistente, credenciais/provedores, conversas, mensagens, runs, aprovações, tool calls e auditoria, sempre isoladas por tenant e usuário.
- Novos serviços e rotas protegidas na API para configuração Root, chat, streaming e aprovação; nenhum segredo será enviado ao frontend.
- Novo harness de modelo com adaptador OpenAI Responses API, schemas estritos de tools e camada futura de provider adapter.
- Refatoração ou extração do catálogo MCP para que o servidor MCP e o harness interno compartilhem definições e executores sem duplicação insegura.
- Novos componentes React, contexto global de disponibilidade, cortina de chat e estados de streaming/aprovação.
- Novas dependências somente com licenças permitidas e avaliação explícita de retenção, custo, privacidade, prompt injection e uso de dados em provedores.
- Atualização da documentação, skill oficial, contratos OpenSpec, checklist de segurança e guidelines de manutenção da skill.
