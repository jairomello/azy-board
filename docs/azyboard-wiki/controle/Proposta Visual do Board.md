# Proposta Visual do Board

> [!info] Escopo
> Direção visual aprovada e aplicada à tela principal do AzyBoard. Os mockups originais permanecem como referência de intenção; esta página também registra os ajustes funcionais consolidados durante a implementação.

## Mockups

### Modo claro

![[board-redesign-light.svg]]

Arquivo: [[board-redesign-light.svg|Abrir proposta em modo claro]]

### Modo escuro

![[board-redesign-dark.svg]]

Arquivo: [[board-redesign-dark.svg|Abrir proposta em modo escuro]]

### Hierarquia de lanes implementada

![[novo.png]]

Arquivo: [[novo.png|Abrir comparação da hierarquia e do espaçamento das colunas]]

## Diagnóstico do visual atual

A tela atual é funcional e compacta, mas sua identidade visual deriva quase integralmente dos padrões básicos de Tailwind e shadcn: fundo uniforme, superfícies brancas ou azul-marinho, bordas discretas, `rounded` e um único `primary` azul. Isso torna a interface familiar, porém pouco reconhecível como AzyBoard.

Os principais pontos observados foram:

1. **Hierarquia por bordas, não por camadas.** Header, toolbar, swimlanes, colunas e cards usam materiais visualmente próximos. É preciso ler cada elemento para entender sua função.
2. **Duas barras superiores com peso semelhante.** Navegação, troca de visualização, preferências, filtros e criação competem na mesma faixa visual.
3. **Quatro ações primárias concorrentes.** Épico, História, Task e Bug aparecem como quatro botões coloridos equivalentes. As cores ajudam a classificar tipos, mas enfraquecem a ação principal.
4. **Contexto operacional pouco evidente.** Projeto, sprint ativa, progresso, pessoas online e estado de sincronização não formam um bloco de contexto imediatamente escaneável.
5. **Filtros sempre expostos.** A toolbar cresce horizontalmente e pode quebrar linha, alterando a altura do Board. A contagem de filtros existe, mas não é o principal mecanismo de entrada.
6. **Swimlanes, colunas e cards são próximos demais.** A estrutura hierárquica existe no conteúdo, mas ainda não é suficientemente forte no desenho.
7. **Modo escuro monocromático.** A base atual usa variações de azul profundo para background, card, popover, muted e border. O resultado é plano e excessivamente azulado.
8. **Inconsistência de iconografia.** A engrenagem literal convive com ícones Lucide e controles de texto.

## O que já está correto

- O usuário autenticado, avatar, tema e idioma já estão presentes.
- Board e Árvore já são tratados como visualizações do mesmo trabalho.
- Cards exibem tipo, prioridade, pontos, responsável, tags, checklist e hierarquia.
- Swimlanes por épico, colunas movíveis, drag and drop e criação contextual sustentam um fluxo operacional eficiente.
- A interface tem densidade adequada para um produto de gestão; não precisa virar uma composição editorial ou uma coleção de cards decorativos.

## Direção proposta

### 1. Navegação persistente

Uma sidebar flutuante reúne navegação global, favoritos, configurações, ajuda e identidade do usuário. Isso retira funções estruturais do header e cria um ponto de orientação estável.

### 2. Contexto antes de comandos

O header passa a identificar projeto, visualização e sprint ativa. Busca global, estado de sincronização, presença, notificações, tema e perfil ficam no mesmo plano funcional, sem competir com os filtros.

### 3. Toolbar flutuante e compacta

Board e Árvore usam um segmented control. Filtros entram por uma ação com contador e os filtros mais importantes permanecem como seletores rápidos. Os demais controles ficam em menus ou popovers.

### 4. Uma ação principal

O botão **Criar** abre as opções Épico, História, Task e Bug. As cores continuam classificando os tipos dentro do menu, nos cards e nos formulários, mas deixam de criar quatro chamadas primárias simultâneas.

### 5. Estrutura visual do Board

- A sprint aparece como contexto de trabalho, com progresso e presença.
- Cada épico tem uma lane principal sólida com total de histórias, cards e progresso.
- No modo padrão, cada história forma uma lane horizontal aninhada, com accordion independente, colunas e cards descendentes.
- O toggle de histórias alterna entre o modo de lanes e o comportamento anterior de histórias como cards.
- Cada coluna usa um fundo levemente distinto e mantém seu limite de WIP visível.
- O conteúdo da coluna começa com um respiro de 10 px abaixo do cabeçalho.
- Os cards são superfícies sólidas de raio curto, com borda de status, ID, tipo, título, metadados e responsável.
- O espaço vazio da coluna permanece silencioso para preservar a leitura do fluxo.

### 6. Glass com função

O efeito translúcido fica restrito à sidebar, ao header, à toolbar e à barra de status, isto é, às camadas de navegação e controle que flutuam acima do conteúdo. Swimlanes, colunas e cards usam materiais sólidos. Essa decisão evita perda de contraste e excesso decorativo.

### 7. Footer substituído por status rail

Um footer tradicional ocuparia espaço vertical sem contribuir para a tarefa. A proposta usa uma barra de status flutuante e discreta com tempo real, última atualização e quantidade de itens visíveis.

## Elementos fundamentais adicionados

| Elemento | Finalidade |
|---|---|
| Busca global e command palette | Encontrar itens, pessoas e comandos sem abandonar o Board |
| Sprint ativa e progresso | Reforçar o contexto temporal e o objetivo corrente |
| Estado de sincronização | Dar confiança sobre atualizações locais e remotas |
| Presença de colaboradores | Evidenciar colaboração em tempo real |
| Notificações | Tornar menções e eventos relevantes acessíveis |
| Contagem de filtros | Explicar rapidamente por que o Board está reduzido |
| Limite de WIP | Apoiar a gestão do fluxo, não apenas a organização visual |
| Densidade de visualização | Permitir alternância entre leitura confortável e alta densidade |
| Atividade recente | Dar acesso ao histórico operacional sem poluir o canvas |
| Estado de agentes AI | Tornar a atuação dos agentes visível e auditável |

## Paleta

### Modo claro

- Canvas: `#EEF2F6`
- Sidebar: `#0B4651` — petróleo profundo
- Header: `#0E4B56` — petróleo profundo, levemente mais claro
- Borda estrutural: `#1D6872`
- Superfície principal: `#FFFFFF`
- Texto: `#182134`
- Primary: `#635BFF`
- Em andamento: `#367BF5`
- Concluído: `#10B981`
- Revisão: `#8B5CF6`
- Alerta: `#F2B84B`
- Erro ou bloqueio: `#F06464`
- Complemento teal: `#39A0A8`

### Modo escuro

- Canvas: `#0E1013`
- Navegação: `#171A1F`
- Superfície elevada: `#20242A`
- Texto: `#F2F4F7`
- Primary: `#8B7CFF`
- Em andamento: `#64A0FF`
- Concluído: `#35D49A`
- Revisão: `#AE81FF`
- Alerta: `#F6C35C`
- Erro ou bloqueio: `#FF7979`

O modo escuro usa base grafite neutra, não azul-marinho. As cores semânticas têm luminância maior e ficam concentradas em indicadores, bordas, badges e ações.

## Notas técnicas para implementação

- Criar tokens para `canvas`, `surface`, `surface-raised`, `surface-floating`, `stroke`, `status-*` e `presence`, em vez de depender apenas de `background`, `card` e `muted`.
- Manter o raio dos cards em até `8px`; usar elevação principalmente nas barras flutuantes e no card em hover ou drag.
- Usar Lucide em toda a iconografia e tooltips nos controles apenas por ícone.
- Fazer sidebar, header e toolbar responsivos. Em largura reduzida, a sidebar deve recolher para ícones e os filtros devem migrar para um popover.
- Preservar atalhos de criação contextual nas colunas, mesmo com o botão global **Criar**.
- Em lanes de história, a criação contextual deve vincular o novo card à história correspondente.
- Persistir separadamente os estados recolhidos de épicos e histórias por projeto.
- Reservar cores saturadas para significado. Tags definidas pelo usuário precisam de contraste calculado para texto e borda.
- Tratar `prefers-reduced-motion`; movimentos devem explicar drag, mudança de estado e abertura de camadas, não funcionar como decoração.
- Validar desktop e mobile com screenshots, estados vazios, colunas com muitos cards, títulos longos e zoom de 200% antes de consolidar o design system.

## Referências de direção

- [Material 3 Expressive: pesquisa e princípios](https://design.google/library/expressive-material-design-google-research)
- [Apple Human Interface Guidelines: Materials](https://developer.apple.com/design/human-interface-guidelines/materials)
- [Fluent 2: Material](https://fluent2.microsoft.design/material)

As referências foram usadas como princípios, não como skins: expressão para destacar hierarquia e ações, material translúcido apenas em camadas funcionais e superfícies sólidas para o conteúdo operacional.
