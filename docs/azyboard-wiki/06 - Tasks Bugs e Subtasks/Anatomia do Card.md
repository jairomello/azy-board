---
title: Anatomia do Card
type: guide
order: 1
---

# Anatomia do Card

O card resume um item de trabalho no Board. Sua composição permite reconhecer contexto, classificação, execução e responsabilidade sem abrir a janela de detalhes.

## Alça de movimentação

A faixa lateral contém a alça usada para arrastar o card.

- Cursor de arraste: o item pode ser movido.
- Cursor bloqueado: o item possui filhos ou não participa do fluxo como card móvel.

Use a alça para evitar abrir os detalhes acidentalmente durante uma movimentação.

## Indicador de status

A borda lateral utiliza cor para reforçar o estado:

| Estado | Indicação visual |
|---|---|
| Não iniciada | Neutra |
| Em andamento | Azul |
| Bloqueada | Vermelha |
| Concluída | Verde |
| Cancelada | Neutra e atenuada |

Itens arquivados deixam de aparecer no Board ativo.

## Breadcrumb

O breadcrumb mostra os ancestrais do item. Ele permite identificar módulo, épico, história e pais intermediários.

Quando o texto é longo:

- O caminho é abreviado no card.
- Posicionar o cursor revela o caminho completo.

## Título

O título ocupa a área principal e pode usar até duas linhas. Ele pode ser editado inline sem abrir a modal completa.

- Clique para abrir os detalhes.
- Duplo clique no título para editar.
- `Enter` ou perda de foco confirma.
- `Escape` cancela.

## Tags

Tags aparecem como chips coloridos abaixo do título. Elas comunicam classificações importantes e também podem ser usadas como filtros.

## Progresso de checklist

Quando existem checklists, o card apresenta:

- Quantidade concluída e total.
- Barra de progresso.
- Destaque verde quando todos os itens estão concluídos.

O indicador consolida todos os checklists do card.

## Rodapé

O rodapé pode apresentar:

- Badge de tipo: `Story`, `Task` ou `Bug`.
- Prioridade.
- Pontos.
- Quantidade de filhos diretos.
- Avatar do responsável.
- Identificação de IA quando o responsável é um agente.

## Ações no hover

Ao posicionar o cursor sobre o card, aparecem ações para:

- Arquivar.
- Excluir.

Excluir exige confirmação. Arquivar um item com descendentes também exige confirmação do efeito em cascata.

## Card com filhos

Um card agregador recebe aparência atenuada e não pode ser arrastado. O indicador de ramificação mostra quantos filhos diretos existem.

Abra os detalhes para consultar e navegar pelos filhos.

## Responsável humano e agente

Um responsável humano é apresentado por avatar ou iniciais. Quando a atribuição está vinculada a uma API Key, o avatar recebe uma identificação de IA e pode mostrar o modelo configurado.

## Regras e comportamentos

- O card é um resumo; campos completos ficam na modal.
- A cor da prioridade é diferente da cor de status.
- Somente itens móveis apresentam alça ativa.
- Ações destrutivas não são executadas pelo clique no corpo.
- Tags e checklist atualizam o resumo depois do salvamento ou evento em tempo real.

## Funcionalidades relacionadas

- [[06 - Tasks Bugs e Subtasks/Criar e Editar Tasks e Bugs|Criar e editar tasks e bugs]]
- [[06 - Tasks Bugs e Subtasks/Tags|Tags]]
- [[06 - Tasks Bugs e Subtasks/Checklists|Checklists]]
- [[04 - Board e Visualizacoes/Criar Mover e Ordenar Cards|Criar, mover e ordenar cards]]

<details>
<summary><strong>Como funciona tecnicamente</strong></summary>

### Contrato visual

O card recebe um adaptador comum com tipo, título, status, prioridade, pontos, ancestry path, tags, responsável, condição de folha, filhos e progresso de checklist.

### Drag e clique

A alça concentra os listeners de drag. A área de conteúdo abre detalhes, enquanto o título controla a edição inline e evita conflito entre clique simples e duplo.

### Identidade de IA

Além do usuário responsável, o payload pode incluir a API Key de atribuição e o nome do modelo, permitindo diferenciar trabalho humano e automatizado.

</details>

