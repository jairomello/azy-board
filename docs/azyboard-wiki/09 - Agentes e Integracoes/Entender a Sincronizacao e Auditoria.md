---
title: Entender a Sincronização e Auditoria
type: guide
order: 5
---

# Entender a Sincronização e Auditoria

Pessoas e agentes operam sobre o mesmo estado do projeto. Alterações feitas pela interface, REST, MCP ou Shadow Markdown são persistidas pela API e propagadas aos participantes conectados.

## O que é atualizado em tempo real

O Board reage a eventos como:

- criação, edição, movimentação e exclusão de itens;
- reivindicação de uma task por agente;
- criação de subtask e mudança da `Leaf Rule`;
- atualização do progresso de checklists;
- arquivamento e restauração;
- mudança da sprint ativa.

Assim, uma ação de agente pode aparecer para uma pessoa sem recarregar a página, e uma alteração humana fica disponível para a próxima consulta do agente.

## Fluxo de uma alteração

1. Pessoa ou agente envia uma ação pela interface, MCP, REST ou Shadow Markdown.
2. A API autentica, valida permissões e aplica a regra funcional.
3. O estado é persistido.
4. A API publica um evento tipado para o projeto.
5. Clientes conectados atualizam a parte afetada da interface.

O WebSocket é um canal de notificação. Alterações não são enviadas diretamente por ele; as mutações continuam passando pela API.

## Identificar trabalho de agente

Quando um agente reivindica um item, o Azy Board associa:

- o proprietário humano da API Key;
- a chave específica utilizada;
- o nome ou modelo do agente, quando informado.

Essa identificação permite exibir um badge de IA e distinguir agentes que pertencem à mesma pessoa.

## Histórico funcional

O detalhe do item registra mudanças relevantes, autor e horário. Atividades manuais podem complementar o registro com descrição e duração.

Para reconstruir uma execução:

1. abra o card;
2. consulte **Histórico de atividades**;
3. compare alterações automáticas e registros manuais;
4. verifique responsável, datas e progresso das checklists;
5. consulte a API Key e seu último uso quando necessário.

## Reconexão

Se a conexão em tempo real cair, o cliente tenta reconectar automaticamente com intervalos crescentes, até o limite configurado. Após restabelecer a conexão, o estado atual é recarregado para incorporar eventos perdidos.

Durante a interrupção, ações confirmadas pela API continuam persistidas. Se houver dúvida, recarregue o Board ou consulte novamente o recurso antes de repetir a operação.

## Conflitos entre participantes

- Leia o estado mais recente antes de alterações em lote.
- Use `claim_task` para evitar que dois agentes assumam o mesmo item.
- Não repita uma criação após timeout sem consultar o resultado.
- Preserve os IDs ao editar Shadow Markdown.
- Trate respostas `409` e `422` antes de tentar novamente.
- Divida agentes por chave para facilitar identificação e revogação.

## Isolamento

Eventos são separados por projeto e tenant. Participantes de outro projeto não recebem as mudanças, mesmo que estejam conectados ao mesmo servidor.

A conexão exige autenticação válida e um `projectId`. A autorização de cada mutação continua sendo verificada individualmente pela API.

## Eventos reconhecidos

| Evento | Mudança representada |
|---|---|
| `ITEM_CREATED` | Novo item na hierarquia. |
| `ITEM_UPDATED` | Campos ou ciclo de vida alterados. |
| `ITEM_DELETED` | Item removido. |
| `CARD_MOVED` | Card transferido de coluna. |
| `TASK_CLAIMED` | Trabalho reivindicado por pessoa ou agente. |
| `SUBTASK_CREATED` | Filho criado e agregação recalculada. |
| `CHECKLIST_UPDATED` | Progresso de checklist alterado. |
| `SPRINT_CHANGED` | Sprint ativa modificada. |

Eventos legados de card continuam reconhecidos para compatibilidade.

## Funcionalidades relacionadas

- [[04 - Board e Visualizacoes/Sincronizacao em Tempo Real|Sincronização em tempo real no Board]]
- [[06 - Tasks Bugs e Subtasks/Historico de Atividades e Tempo Trabalhado|Histórico de atividades e tempo trabalhado]]
- [[09 - Agentes e Integracoes/Usar as Ferramentas MCP|Usar as ferramentas MCP]]
- [[09 - Agentes e Integracoes/Integrar pela API REST e Autenticar Agentes|Integrar pela API REST e autenticar agentes]]

<details>
<summary><strong>Como funciona tecnicamente</strong></summary>

O servidor WebSocket mantém salas por projeto. A conexão autenticada carrega `projectId`, `tenantId` e `userId`; os broadcasts são serializados como `{ type, projectId, payload }` e enviados somente aos clientes da sala compatível.

O frontend despacha cada tipo para um handler local e recalcula folhas ou progresso quando necessário. Em desconexão, tenta restabelecer o canal com backoff exponencial de até 30 segundos. Em ambientes com múltiplas instâncias, a distribuição de eventos requer um barramento compartilhado, como Redis Pub/Sub.

</details>

