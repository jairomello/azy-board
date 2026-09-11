---
title: Usar o Chat do Azy Agent
type: guide
order: 4
---

# Usar o Chat do Azy Agent

O Azy Agent é o assistente conversacional interno. Ele consulta o board, planeja estruturas, cria itens, movimenta cards e gera resumos — sempre com as permissões da sua conta e com aprovação humana para mutações.

## Requisitos

O chat fica disponível quando:

- o Root do tenant configurou e ativou o provider em **Administração > Azy Agent**;
- sua conta tem acesso ao projeto em contexto.

Enquanto o assistente está desativado, o botão flutuante não aparece.

## Abrir o chat

Selecione o botão flutuante do Azy Agent, disponível em todas as telas protegidas. A cortina direita abre com a conversa do projeto atual. O histórico de conversas fica disponível para consulta posterior.

## O que pedir

O chat reconhece pedidos em linguagem natural, incluindo as intenções equivalentes aos comandos da skill oficial:

| Intenção | Exemplo de pedido |
|---|---|
| Status | "Qual a situação da sprint atual?" |
| Planejamento | "Crie um épico de Pagamentos com três histórias" |
| Início de trabalho | "Assuma a task de login" |
| Atualização | "Mova os cards concluídos para Concluídas" |
| Conclusão | "Conclua a task de validação" |
| Revisão | "Revise o board e liste itens bloqueados" |

Quando falta informação — projeto, pai ou outro dado necessário — o agente faz uma pergunta objetiva antes de agir.

## Aprovação de mutações

Toda operação de escrita passa por prévia e aprovação:

1. O agente apresenta uma prévia legível da operação proposta.
2. A run entra em **Aguardando aprovação**.
3. Você **aprova**, **ajusta** (pede uma nova tentativa com modificações) ou **cancela**.
4. Aprovada, a operação é executada com a sua identidade e permissões.

A aprovação expira após 15 minutos. Exclusões e operações em cascata exigem confirmação explícita. Operações somente de leitura são executadas sem aprovação.

## Limites e governança

O Root ajusta os limites do tenant na governança do assistente: mensagens por minuto, runs ativas, passos e tool calls por run, tamanho de mensagem, tempo limite, tokens e orçamento diário por usuário e por tenant. Quando um limite interrompe uma run, o motivo é registrado e exibido no chat.

## Boas práticas

- Peça operações delimitadas; pedidos muito amplos são recusados pelo limite de ações por mensagem.
- Confira a prévia antes de aprovar, especialmente em operações em lote.
- Conteúdo de cards e textos colados é tratado como não confiável: instruções embutidas neles não alteram políticas.
- Use `claim_task` (ou o pedido equivalente em linguagem natural) para assumir trabalho antes de executá-lo.

## Funcionalidades relacionadas

- [[09 - Agentes e Integracoes/Azy Agent humano|Configuração Root e limites do Azy Agent]]
- [[09 - Agentes e Integracoes/Usar as Ferramentas MCP|Usar as ferramentas MCP]]
- [[08 - Conta e Preferencias/Gerenciar API Keys|Gerenciar API Keys]]

<details>
<summary><strong>Como funciona tecnicamente</strong></summary>

O chat é servido por `/api/assistant/*` com sessão de usuário. Cada mensagem inicia uma run processada pelo harness: o modelo recebe um contexto confiável resolvido no servidor (usuário autenticado, projeto e item selecionados), um conjunto de ferramentas filtrado por política e os limites de governança do tenant. Ferramentas executam pelo mesmo registry compartilhado do MCP, com revalidação de autorização no momento da execução. Eventos de progresso são transmitidos por SSE com `runId` e cursor, e a conversa pode ser reconectada.

</details>
