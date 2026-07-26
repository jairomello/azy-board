---
title: Organizar Subtasks e Navegar entre Filhos
type: guide
order: 3
---

# Organizar Subtasks e Navegar entre Filhos

Subtasks dividem uma task ou bug em partes menores. A janela do item permite criar filhos diretos e navegar por vários níveis sem perder o contexto.

## Criar uma subtask

1. Abra uma task ou bug folha.
2. Localize a seção **Subtasks**.
3. Selecione **Adicionar subtask**.
4. Informe o título.
5. Escolha task ou bug.
6. Confirme.

A nova subtask recebe o item atual como pai.

## Efeito sobre o item pai

Ao receber o primeiro filho, o item pai:

- Deixa de ser folha.
- Passa a exibir contador de filhos.
- Deixa de poder ser arrastado.
- Consolida pontos e progresso.
- Passa a depender do andamento das subtasks.

## Seção de filhos diretos

No final da modal, a seção **Subtasks** lista somente o nível imediatamente abaixo.

Cada filho apresenta:

- Título.
- Tipo.
- Prioridade.
- Coluna ou status.
- Responsável.
- Indicadores de prioridade relevante.

Netos não aparecem nessa lista. Para chegar a eles, abra primeiro o filho correspondente.

## Navegar para um filho

1. Na seção de subtasks, selecione um filho.
2. Uma nova modal é aberta sobre a atual.
3. Consulte ou edite o filho.
4. Selecione **Voltar** ou pressione `Escape` para retornar ao pai.

A modal pai permanece aberta e mantém seu contexto.

## Fechar toda a pilha

Use o controle de fechamento no cabeçalho para sair de toda a navegação contextual. O botão **Voltar** fecha somente o nível atual.

## Limite de profundidade visual

A pilha mantém até cinco níveis de navegação. Ao tentar abrir um nível adicional, a modal do topo é substituída, preservando os níveis anteriores.

Esse limite controla a interface, não impede que a hierarquia do projeto seja consultada pela Tree View.

## Item sem filhos

Quando não existem filhos, a seção informa **Nenhuma subtask criada**. O formulário de criação continua disponível enquanto o item for folha.

## Mostrar subtasks no Board

Depois de criar subtasks, ative **Mostrar subtasks** para exibir itens folha no Kanban. Com o controle desativado, o Board privilegia o primeiro nível abaixo das histórias.

## Pontos e progresso

Estime os itens folha. O pai passa a mostrar:

- Soma dos pontos descendentes.
- Percentual de folhas concluídas.

Concluir um filho atualiza a cadeia de ancestrais.

## Regras e comportamentos

- Subtask é uma task ou bug com outro item operacional como pai.
- A seção da modal lista somente filhos diretos.
- A Tree View apresenta toda a profundidade.
- Excluir ou arquivar o pai afeta descendentes em cascata.
- Restaurar um descendente recupera ancestrais necessários.
- Renomear o pai atualiza breadcrumbs dos filhos.

## Permissões

`Admin` e `Membro` podem criar e editar subtasks. `Visualizador` pode navegar pela hierarquia e consultar filhos.

## Exemplo prático

A task **Integrar gateway** é dividida em **Criar cliente HTTP**, **Mapear erros** e **Adicionar retentativas**. A equipe estima e movimenta as três subtasks, enquanto a task pai consolida o progresso.

## Funcionalidades relacionadas

- [[03 - Estrutura do Trabalho/Leaf Rule e Itens Agregadores|Leaf Rule e itens agregadores]]
- [[03 - Estrutura do Trabalho/Pontos e Progresso|Pontos e progresso]]
- [[04 - Board e Visualizacoes/Controles de Visualizacao do Board|Controles de visualização do Board]]

<details>
<summary><strong>Como funciona tecnicamente</strong></summary>

### Relação

Uma subtask utiliza `parentId` para referenciar uma task ou bug. A API valida tenant, projeto e tipo do pai e calcula seu ancestry path.

### Filhos diretos

A modal consulta um endpoint específico que retorna somente registros cujo pai é o item aberto, incluindo dados mínimos para os cards de navegação.

### Pilha de modais

O frontend mantém uma pilha de identificadores e dados carregados. Cada nível recebe camada visual superior e callbacks distintos para voltar ou fechar tudo.

</details>

