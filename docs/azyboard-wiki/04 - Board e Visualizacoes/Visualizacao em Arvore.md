---
title: Visualização em Árvore
type: guide
order: 6
---

# Visualização em Árvore

A Tree View apresenta toda a estrutura do projeto em uma tabela hierárquica. Ela é indicada para compreender dependências, comparar níveis e acompanhar progresso consolidado.

## Como abrir

1. Abra o Board de um projeto.
2. No cabeçalho, selecione **Árvore**.
3. Aguarde o carregamento da hierarquia.

Para retornar, selecione **Kanban**. Os filtros permanecem ativos.

## Estrutura apresentada

A raiz da árvore contém módulos. A expansão segue esta ordem:

```text
Módulo
└── Épico
    └── História
        └── Task ou Bug
            └── Subtask
```

Cada tipo de item possui um indicador próprio para facilitar a leitura.

## Colunas da tabela

| Coluna | Conteúdo |
|---|---|
| Nome | Título com recuo hierárquico e indicador de tipo. |
| Status | Estado atual do item. |
| Responsável | Pessoa ou agente atribuído. |
| Pontos | Estimativa da folha ou soma do item pai. |
| Progresso | Percentual e barra dos itens agregadores. |
| Início | Data planejada de início. |
| Fim | Data planejada de conclusão. |

## Expandir um nó

1. Localize o indicador ao lado do nome.
2. Selecione-o para exibir os filhos.
3. Selecione novamente para ocultá-los.

O estado de outros ramos permanece inalterado.

## Expandir ou recolher toda a árvore

- **Expandir tudo** apresenta todos os níveis simultaneamente.
- **Recolher tudo** mantém apenas os módulos visíveis.

## Editar o título inline

1. Selecione o título de um item editável.
2. Altere o texto diretamente na linha.
3. Confirme a edição.

O novo título é propagado aos breadcrumbs dos descendentes.

## Alterar o responsável inline

1. Selecione a célula de responsável.
2. Escolha um membro do projeto ou deixe o item sem responsável.
3. Confirme.

Essa ação evita abrir a modal completa quando a única alteração é a atribuição.

## Aplicação dos filtros

A árvore respeita os filtros do Board, especialmente:

- Módulo.
- Sprint.
- Responsável.
- Tags.
- Ocultar épicos vazios.

Os ancestrais necessários continuam visíveis para que um resultado nunca apareça sem contexto.

## Arquivar pela árvore

A ação de arquivamento aparece na linha do item. Módulos não podem ser arquivados, mas épicos, histórias, tasks e bugs podem.

Itens com descendentes exigem confirmação antes do arquivamento em cascata.

## Estado vazio

Quando não existem itens ou nenhum resultado atende aos filtros, a tabela apresenta uma mensagem de ausência de itens.

## Permissões

| Ação | Admin | Membro | Visualizador |
|---|---:|---:|---:|
| Consultar e expandir | Sim | Sim | Sim |
| Editar título e responsável | Sim | Sim | Não |
| Arquivar | Sim | Sim | Não |

## Exemplo prático

Uma liderança expande o módulo **Pagamentos**, compara pontos e progresso dos épicos e filtra pelo responsável **Ana**. A árvore mantém módulos e épicos necessários para contextualizar as tasks atribuídas a ela.

## Funcionalidades relacionadas

- [[03 - Estrutura do Trabalho/Hierarquia dos Itens|Hierarquia dos itens]]
- [[03 - Estrutura do Trabalho/Pontos e Progresso|Pontos e progresso]]
- [[04 - Board e Visualizacoes/Filtros do Board|Filtros do Board]]
- [[04 - Board e Visualizacoes/Arquivar Restaurar e Excluir Itens|Arquivar, restaurar e excluir itens]]

<details>
<summary><strong>Como funciona tecnicamente</strong></summary>

### Consulta recursiva

A Tree View consome uma representação hierárquica que começa nos módulos e inclui itens não arquivados ordenados por posição. Filtros são enviados como parâmetros da consulta.

### Preservação do contexto

O serviço filtra folhas que não atendem aos critérios e reconstrói os ancestrais necessários. A ocultação de épicos vazios é aplicada depois da formação da árvore visível.

### Edição

Edições inline utilizam a mesma atualização de item da modal completa. Mudanças relevantes geram eventos para manter outras sessões sincronizadas.

</details>

