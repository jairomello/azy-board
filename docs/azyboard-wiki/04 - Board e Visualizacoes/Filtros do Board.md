---
title: Filtros do Board
type: guide
order: 4
---

# Filtros do Board

Os filtros reduzem o conteúdo visível sem alterar os itens do projeto. Eles podem ser combinados para responder perguntas específicas sobre o trabalho.

Os controles ficam no painel suspenso **Filtros**, na barra de comandos do Board. O botão exibe um contador com a quantidade de critérios ativos.

## Filtro por squad

Apresenta itens atribuídos a integrantes do squad selecionado. Itens sem responsável ou atribuídos a pessoas de outros squads são ocultados.

Para facilitar a leitura, épicos sem cards do squad também são ocultados.

## Filtro por módulo

Apresenta cards cujo épico pertence ao módulo selecionado. Itens sem épico não participam de um módulo e deixam de aparecer durante esse filtro.

## Filtro por sprint

Apresenta itens associados à sprint selecionada. O seletor permanece visível mesmo sem sprints e lista `PROPOSED`, `OPEN` e `CLOSED`, permitindo consultar o histórico de ciclos fechados.

## Filtro por responsável

Apresenta somente itens atribuídos à pessoa selecionada. A atribuição pode ser humana ou realizada por meio das integrações do projeto.

## Filtros por autor, versão, prioridade e status

Autor identifica quem criou o item. Versão usa o vínculo opcional `items.version_id` e lista apenas versões do projeto atual. Prioridade oferece Baixa, Média, Alta e Crítica; status oferece Não iniciada, Em andamento, Bloqueada, Concluída e Cancelada.

O controle **Versão** permanece visível mesmo quando o projeto ainda não possui versões. Nesse caso, ele fica em **Sem versão** e informa **Nenhuma versão cadastrada**; as versões podem ser criadas em **Configurações do projeto > Versões**.

Esses filtros continuam disponíveis no modo `SIMPLE`. Itens sem autor ou versão não correspondem quando o critério respectivo está ativo.

## Filtro por centro de custo

O seletor **Centro de Custo** lista os centros cadastrados no projeto atual, exibindo código e descrição. **Todos os centros** deixa o filtro vazio e inclui também itens sem centro de custo. Quando não houver centros cadastrados, o controle continua visível e informa **Nenhum centro de custo cadastrado**.

Ao selecionar um centro, somente itens cujo `costCenterId` corresponde ao centro são exibidos. A seleção é aplicada em memória, combina-se com os demais filtros por AND e funciona nos modos `SIMPLE` e `HIERARCHICAL`. A preferência é persistida separadamente por projeto; se o centro for removido, a seleção é limpa sem alterar os demais filtros.

## Filtro por tipo

Os controles **Tarefa** e **Bug**, dentro do painel **Filtros**, podem ser ativados individualmente ou em conjunto.

- Somente **Tarefa**: oculta bugs.
- Somente **Bug**: oculta tasks.
- Ambos: apresenta tasks e bugs.
- Nenhum: não restringe por tipo.

A representação de histórias é controlada separadamente pelo toggle que alterna entre **Histórias como lanes** e **Histórias como cards**. O filtro de tipo continua restrito a tasks e bugs.

## Filtro por tags

Selecione uma ou mais tags coloridas. Quando várias tags estão selecionadas, um item é aceito se possuir ao menos uma delas.

## Ocultar épicos vazios

Esse controle remove épicos que não possuem cards depois da aplicação dos demais filtros. Assim, “vazio” significa sem conteúdo no resultado atual, e não necessariamente sem itens cadastrados.

## Ocultar histórias vazias

Esse controle aparece somente quando histórias são exibidas como lanes. Ao ativá-lo, histórias sem cards no resultado atual são removidas temporariamente. O épico continua visível quando as regras de ocultação de épicos permitirem.

## Combinar filtros

Filtros de categorias diferentes são combinados. Um card precisa atender a todos os critérios ativos.

Exemplo:

```text
Squad Plataforma
E Módulo Pagamentos
E Sprint 12
E Responsável Ana
E Tipo Bug
E Tag Urgente
```

Somente bugs urgentes de Pagamentos, na Sprint 12, atribuídos a Ana e pertencentes ao Squad Plataforma serão apresentados.

## Identificar filtros ativos

O botão **Filtros** exibe um contador com a quantidade de critérios ativos. Logo abaixo da barra de comandos, uma linha de filtros ativos mostra cada seleção em uma tag compacta, usando nomes dos catálogos quando disponíveis. O botão **x** de cada tag remove somente aquele filtro ou valor; tipos e tags removem apenas o valor selecionado.

## Limpar filtros

1. Abra o painel **Filtros**.
2. Confira a quantidade de filtros ativos.
3. Selecione **Limpar** dentro do painel.

São removidos squad, módulo, sprint, responsável, autor, centro de custo, versão, prioridade, status, tipos, tags e as ocultações de épicos e histórias vazias. O modo de histórias, o controle de subtasks e o modo de exibição dos módulos (hierarquia ou abas) são preservados.

## Persistência por projeto

O Azy Board lembra os filtros separadamente para cada projeto. Ao retornar, a última combinação é restaurada.

Se o navegador não permitir armazenamento local, o Board continua funcionando, mas inicia com os valores padrão em cada visita.

## Filtros na árvore

Módulo, sprint, responsável e ocultação de épicos vazios também influenciam a Tree View. A hierarquia necessária para contextualizar os resultados é preservada.

## Regras e comportamentos

- Filtrar não altera dados.
- Filtros são aplicados ao conteúdo ativo e não incluem arquivados.
- Categorias diferentes usam uma combinação restritiva.
- Tags selecionadas usam correspondência por pelo menos uma tag.
- O estado é independente por projeto.
- Centro de custo vazio significa todos os centros, inclusive itens sem associação.
- Ocultar histórias vazias só participa da contagem no modo de lanes.
- Limpar filtros não redefine o modo de histórias, o controle de subtasks nem o modo de exibição dos módulos.

## Permissões

Filtros são controles locais de consulta e estão disponíveis para `Admin`, `Membro` e `Visualizador`.

## Funcionalidades relacionadas

- [[04 - Board e Visualizacoes/Conhecer o Board|Conhecer o Board]]
- [[04 - Board e Visualizacoes/Controles de Visualizacao do Board|Controles de visualização do Board]]
- [[04 - Board e Visualizacoes/Visualizacao em Arvore|Visualização em árvore]]

<details>
<summary><strong>Como funciona tecnicamente</strong></summary>

### Aplicação dos filtros

O frontend combina os critérios sobre os itens carregados e deriva a lista exibida, sem nova consulta ao alterar controles. Dimensões diferentes usam AND; tags selecionadas usam OR.

### Squad e módulo

O filtro de squad cria um conjunto de usuários do grupo e compara o responsável do item. O filtro de módulo identifica o épico ancestral e verifica seu módulo.

### Persistência

O estado completo é serializado por projeto no armazenamento local. Valores ausentes ou inválidos são combinados com os padrões, evitando impedir a abertura do Board.

</details>
