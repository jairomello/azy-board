---
title: Conhecer o Board
type: guide
order: 1
---

# Conhecer o Board

O Board é o ambiente operacional principal do projeto. Ele combina o fluxo Kanban com a hierarquia **Épico → História → Cards**, permitindo acompanhar o contexto funcional e a etapa de cada item executável.

## Onde encontrar

1. Acesse a página **Projetos**.
2. Selecione um projeto.
3. A aplicação abre o Board na visualização Kanban.

O breadcrumb do cabeçalho mostra **Projetos > Board · Nome do projeto**.

## Estrutura da tela

O Board é dividido em quatro áreas:

1. Cabeçalho global.
2. Toolbar de visualização, filtros e ações.
3. Lanes de épico e, no modo padrão, lanes de história aninhadas.
4. Colunas e cards dentro do agrupamento ativo.

## Cabeçalho

O cabeçalho permite:

- Retornar à lista de projetos.
- Confirmar o projeto atual.
- Alternar entre Kanban e árvore.
- Mudar idioma e tema.
- Abrir as configurações do projeto.
- Acessar a conta ou sair.

## Toolbar

A toolbar é organizada em zonas.

### Controles de visualização

- Mostrar ou ocultar subtasks.
- Alternar histórias entre lanes e cards.
- Expandir todas as lanes.
- Recolher todas as lanes.

### Filtros

- Squad.
- Módulo.
- Sprint.
- Responsável.
- Tipo de item.
- Tags.
- Ocultar épicos vazios.
- Ocultar histórias vazias no modo de lanes.

### Ações

- Consultar itens arquivados.
- Criar épico.
- Criar história.
- Criar task.
- Criar bug.

Os botões de criação aparecem na visualização Kanban. A Tree View concentra-se em consulta hierárquica.

## Lanes de épico e história

Cada épico forma uma faixa horizontal principal. Seu cabeçalho apresenta:

- Nome do épico.
- Quantidade de histórias e cards visíveis.
- Progresso dos cards descendentes.
- Controle para expandir ou recolher.
- Ação de edição do épico.

Por padrão, cada história forma uma segunda lane dentro do épico. A indentação, a linha hierárquica e a cor de apoio deixam explícito que ela pertence à lane principal. O cabeçalho da história apresenta título, quantidade de cards, progresso, accordion independente e ação de edição.

Cards com épico, mas sem história ancestral, são reunidos em **Sem história**. Tasks e bugs sem épico são agrupados em **Sem épico**.

O controle de histórias pode trocar essa representação pelo modo de cards. Nesse modo, histórias folha voltam a participar das colunas como cards móveis e histórias agregadoras aparecem como referências não arrastáveis, preservando o comportamento anterior.

## Colunas

As colunas representam etapas do fluxo. A mesma ordem é repetida em todas as lanes para permitir a comparação entre épicos e histórias.

O cabeçalho de uma coluna mostra:

- Nome da etapa.
- Quantidade de cards da lane naquela etapa.
- Área de arraste para reordenar a coluna.

Existe um espaço de respiro entre o cabeçalho da coluna e o primeiro card. Esse afastamento separa visualmente a identificação da etapa do conteúdo operacional.

## Cards

Um card pode apresentar:

- Breadcrumb.
- Título.
- Tags.
- Progresso de checklist.
- Tipo e prioridade.
- Pontos.
- Quantidade de filhos.
- Responsável humano ou agente de IA.
- Ações de arquivamento e exclusão.

O controle lateral do card indica se ele pode ser arrastado.

## Estados do Board

### Carregamento

Enquanto os dados do projeto são preparados, a aplicação apresenta um indicador central.

### Épico sem cards

Uma lane de épico pode continuar visível mesmo vazia. Isso ajuda a identificar épicos cadastrados que ainda não foram detalhados.

### História sem cards

No modo de lanes, uma história vazia continua visível e oferece as colunas para criação contextual. O filtro **Ocultar histórias vazias** pode removê-la temporariamente.

### Projeto sem itens

As colunas e os épicos existentes permanecem disponíveis para a criação dos primeiros cards.

## Permissões

| Ação | Admin | Membro | Visualizador |
|---|---:|---:|---:|
| Consultar Board | Sim | Sim | Sim |
| Usar filtros locais | Sim | Sim | Sim |
| Criar e editar itens | Sim | Sim | Não |
| Mover e ordenar cards | Sim | Sim | Não |
| Configurar colunas | Sim | Não | Não |

## Exemplo prático

No Board de **Portal do Cliente**, a pessoa expande o épico **Cobrança recorrente**, abre a história **Renovar assinatura**, verifica dois cards em **Fazendo** e um em **A Testar** e abre o card bloqueado para consultar seus detalhes.

## Funcionalidades relacionadas

- [[04 - Board e Visualizacoes/Swimlanes e Colunas|Swimlanes e colunas]]
- [[04 - Board e Visualizacoes/Criar Mover e Ordenar Cards|Criar, mover e ordenar cards]]
- [[04 - Board e Visualizacoes/Filtros do Board|Filtros do Board]]
- [[06 - Tasks Bugs e Subtasks/Tasks Bugs e Subtasks|Tasks, Bugs e Subtasks]]

<details>
<summary><strong>Como funciona tecnicamente</strong></summary>

### Carregamento

A página carrega em paralelo colunas, itens, módulos, tags, sprints, membros, versões, centros de custo, squads e dados do projeto. A interface deriva histórias, épicos, folhas, grupos e cards visíveis a partir desse estado.

### Agrupamento

O ancestry path de cada item permite localizar os ancestrais épico e história. O frontend utiliza essa informação para construir os dois níveis de lanes, o agrupamento **Sem história** e a lane **Sem épico**.

### Interação

O Board utiliza contextos de drag-and-drop para cards e colunas. Mutações bem-sucedidas são persistidas pela API e comunicadas aos participantes conectados.

</details>
