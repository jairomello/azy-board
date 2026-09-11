---
title: Conhecer o Board
type: guide
order: 1
---

# Conhecer o Board

O Board é o ambiente operacional principal do projeto. Ele pode combinar o fluxo Kanban com a hierarquia **Épico → História → Cards** ou apresentar um fluxo simples com uma história fixa e cards de trabalho.

## Onde encontrar

1. Acesse a página **Projetos**.
2. Selecione um projeto.
3. A aplicação abre o Board na visualização Kanban.

O cabeçalho contextual mostra **Nome do projeto • Board**. A navegação entre áreas fica na barra lateral fixa.

## Estrutura da tela

O Board é dividido em cinco áreas:

1. Barra lateral de navegação (Projetos, Board, Dashboard, Configurações, Administração e Conta, conforme permissões).
2. Cabeçalho contextual com idioma, tema e menu do perfil.
3. Barra de comandos com visualização, filtros, opções e criação.
4. Lanes de épico e história no modo **Hierárquico**, ou uma lane única no modo **Simples**.
5. Colunas e cards dentro do agrupamento ativo.

## Navegação e cabeçalho

- A barra lateral mantém as áreas do projeto acessíveis a qualquer momento; em telas estreitas ela vira um menu de gaveta.
- O cabeçalho contextual confirma o projeto atual e reúne o seletor de idioma, o alternador de tema e o menu do perfil (conta, projetos ocultos e sair).
- O botão flutuante do Azy Agent fica disponível em todas as telas protegidas.

## Barra de comandos

A barra de comandos reúne os controles do Board.

### Visualização

- Alternância segmentada entre **Board** e **Árvore**.
- Seletor rápido de squad.
- Alternância de densidade (confortável ou compacta).
- Consulta de itens arquivados (botão de ícone).

### Filtros

- Painel suspenso **Filtros** com squad, módulo, sprint, responsável, tipo, tags, prioridade, status, versão e centro de custo.
- O botão exibe um contador de filtros ativos.

### Opções

- Painel suspenso **Opções** (disponível no modo hierárquico): mostrar ou ocultar subtasks, alternar histórias entre lanes e cards, ocultar épicos vazios e ocultar histórias vazias.

### Criar

- Menu suspenso **Criar** com **Módulo, Épico, História, Task e Bug**.
- Disponível na visualização Kanban e na Tree View.
- Na árvore, ações adicionais por linha permitem criar filhos no contexto do módulo, épico, história, task ou bug selecionado.

### Modo de exibição dos módulos

Em projetos hierárquicos, os módulos podem ser exibidos em **Hierarquia** (lanes aninhadas contínuas) ou em **Abas** (um módulo por vez). A escolha fica na barra de comandos e é persistida por projeto.

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

## Fluxo simples

No modo **Simples**, o Board exibe uma única história fixa e as colunas do projeto. Módulos, épicos e os controles de expandir/recolher swimlanes não aparecem. TASKs e BUGs vinculados à história fixa são exibidos diretamente no fluxo único; filtros de sprint, responsável, tipo e tags continuam disponíveis.

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

### Projeto simples sem itens

As colunas e a história fixa permanecem disponíveis para a criação dos primeiros cards.

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
