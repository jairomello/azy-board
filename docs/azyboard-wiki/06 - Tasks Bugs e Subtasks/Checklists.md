---
title: Checklists
type: guide
order: 5
---

# Checklists

Checklists registram passos verificáveis dentro de um item. Um card pode possuir várias listas independentes, cada uma com seu próprio nome e progresso.

## Onde encontrar

Abra um card existente e localize a seção **Checklists**. A seção não aparece durante a criação inicial, pois o item precisa existir antes de receber listas.

## Criar um checklist

1. Selecione **Novo checklist**.
2. Informe um nome.
3. Confirme em **Criar**.

Exemplos de nomes:

- Plano de execução.
- Critérios técnicos.
- Validação antes do deploy.
- Evidências de teste.

## Renomear

Edite o nome do checklist e confirme. A alteração não afeta seus itens nem o progresso.

## Adicionar um item

1. Na lista desejada, selecione **Adicionar item**.
2. Digite uma ação específica.
3. Pressione `Enter` ou use a ação de adição.
4. Continue inserindo outros itens ou encerre o formulário.

Use textos verificáveis, como **Executar testes de integração**, em vez de descrições genéricas como **Verificar tudo**.

## Marcar como concluído

Selecione a caixa ao lado do item. O texto recebe indicação de conclusão, e o progresso é recalculado.

Desmarcar devolve o item ao estado pendente.

## Excluir um item

Posicione o cursor sobre o item e use a ação de remoção. Somente aquele passo é excluído.

## Excluir um checklist

Use a ação de exclusão no cabeçalho da lista. O checklist e todos os seus itens são removidos.

> [!warning] Exclusão da lista
> Excluir um checklist é diferente de desmarcar seus itens. A lista completa deixa de existir.

## Acompanhar o progresso

Cada checklist apresenta:

- Quantidade concluída.
- Quantidade total.
- Barra percentual.
- Destaque quando todos os passos estão concluídos.

O card do Board consolida os itens de todos os checklists em um único indicador.

Exemplo:

```text
Plano de execução: 2/3
Validação: 1/2
Card no Board: 3/5
```

## Atualizações em tempo real

Marcar, desmarcar, adicionar ou remover itens atualiza o progresso para os participantes conectados. Agentes também podem operar checklists pelas ferramentas MCP.

## Regras e comportamentos

- O nome do checklist é obrigatório.
- O texto de cada item é obrigatório.
- Novos itens começam pendentes.
- Um card pode ter zero ou mais checklists.
- Uma lista vazia apresenta progresso zero sem ser considerada concluída.
- Excluir um card remove seus checklists.
- Checklists não alteram automaticamente o status do card.

## Permissões

`Admin` e `Membro` podem criar, editar, concluir e excluir. `Visualizador` pode consultar listas e progresso.

## Funcionalidades relacionadas

- [[06 - Tasks Bugs e Subtasks/Anatomia do Card|Anatomia do card]]
- [[06 - Tasks Bugs e Subtasks/Historico de Atividades e Tempo Trabalhado|Histórico de atividades e tempo trabalhado]]
- [[09 - Agentes e Integracoes/Agentes e Integracoes|Agentes e Integrações]]

<details>
<summary><strong>Como funciona tecnicamente</strong></summary>

### Estrutura

Checklists pertencem a um item e possuem nome e posição. Itens de checklist pertencem a uma lista e possuem texto, estado booleano e posição.

### Progresso

A API soma itens concluídos e totais de todas as listas do card. Sem itens, o resumo do Board é nulo. Alterações podem ser aplicadas de forma otimista e revertidas em caso de falha.

### Sincronização

Operações em itens emitem `CHECKLIST_UPDATED` com o novo resumo, permitindo atualizar o card sem recarregar toda a coleção.

</details>
