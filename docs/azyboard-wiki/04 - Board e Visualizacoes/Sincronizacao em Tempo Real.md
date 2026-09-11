---
title: Sincronização em Tempo Real
type: guide
order: 8
---

# Sincronização em Tempo Real

Participantes conectados ao mesmo projeto recebem alterações sem precisar recarregar o navegador. Isso inclui ações realizadas por pessoas e agentes de IA.

## Mudanças sincronizadas

O Board pode atualizar automaticamente:

- Criação de itens.
- Alteração de campos.
- Movimentação de cards.
- Exclusão e arquivamento.
- Atribuição ou claim de trabalho.
- Criação de subtasks.
- Progresso de checklists.
- Mudanças relacionadas à sprint.

## Alteração realizada por outra pessoa

Quando outro participante move um card, a coluna e o status são atualizados na sua tela. O mesmo princípio vale para criação, edição e exclusão.

## Alteração realizada por um agente

Agentes podem agir por API ou MCP. As mudanças são transmitidas ao Board humano com a mesma estrutura de eventos.

Exemplo:

1. Um agente reivindica uma task.
2. A task recebe responsável e passa para em andamento.
3. Os Boards conectados atualizam o card.
4. A identificação do agente fica visível no card.

## Queda de conexão

Se a conexão em tempo real for interrompida:

- A interface continua disponível para leitura e ações que alcancem a API.
- O cliente tenta reconectar automaticamente.
- O intervalo entre tentativas aumenta até um limite.
- A reconexão não recarrega o estado automaticamente: mudanças ocorridas durante a interrupção aparecem na próxima consulta ou recarregamento.

## Isolamento

Eventos pertencem a um projeto específico. Uma movimentação no **Projeto A** não é enviada a participantes conectados somente ao **Projeto B**.

O tenant da sessão também participa da autenticação da conexão.

## Regras e comportamentos

- A API continua sendo a origem das mutações.
- A conexão em tempo real distribui resultados, não substitui validações.
- Eventos inválidos são ignorados pelo cliente.
- Reconexões não concedem acesso adicional ao projeto.
- Alterações locais podem aparecer antes da confirmação e ser revertidas em caso de erro.

## Permissões

Receber um evento não concede permissão para repetir a ação. Cada nova alteração continua sujeita ao papel da pessoa ou do proprietário da API Key.

## Exemplo prático

Enquanto uma pessoa acompanha a swimlane **Cobrança recorrente**, outra conclui uma subtask e um agente cria um checklist em outro card. A primeira pessoa vê o card mudar de coluna e o indicador de checklist ser atualizado sem recarregar a página.

## Funcionalidades relacionadas

- [[04 - Board e Visualizacoes/Criar Mover e Ordenar Cards|Criar, mover e ordenar cards]]
- [[06 - Tasks Bugs e Subtasks/Tasks Bugs e Subtasks|Tasks, Bugs e Subtasks]]
- [[09 - Agentes e Integracoes/Agentes e Integracoes|Agentes e Integrações]]

<details>
<summary><strong>Como funciona tecnicamente</strong></summary>

### Conexão

O cliente abre um WebSocket autenticado para o projeto atual. O servidor mantém salas de conexões agrupadas por projeto e registra usuário e tenant na sessão do socket.

### Eventos

Mutações REST emitem eventos tipados, como item criado, atualizado, movido, excluído, atribuído ou checklist atualizado. O frontend associa handlers aos tipos que alteram seu estado local.

### Reconexão

Em caso de fechamento ou erro, o cliente tenta novamente com backoff até o limite configurado. A reconexão restabelece apenas o canal de eventos; eventos perdidos durante a interrupção não são reproduzidos, e o estado é atualizado na próxima consulta ou recarregamento.

</details>

