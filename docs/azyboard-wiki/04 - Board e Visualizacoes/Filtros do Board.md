---
title: Filtros do Board
type: guide
order: 4
---

# Filtros do Board

Os filtros reduzem o conteúdo visível sem alterar os itens do projeto. Eles podem ser combinados para responder perguntas específicas sobre o trabalho.

## Filtro por squad

Apresenta itens atribuídos a integrantes do squad selecionado. Itens sem responsável ou atribuídos a pessoas de outros squads são ocultados.

Para facilitar a leitura, épicos sem cards do squad também são ocultados.

## Filtro por módulo

Apresenta cards cujo épico pertence ao módulo selecionado. Itens sem épico não participam de um módulo e deixam de aparecer durante esse filtro.

## Filtro por sprint

Apresenta itens associados à sprint selecionada. O nome de cada sprint disponível aparece no seletor.

## Filtro por responsável

Apresenta somente itens atribuídos à pessoa selecionada. A atribuição pode ser humana ou realizada por meio das integrações do projeto.

## Filtro por tipo

Os controles **Tarefa** e **Bug** podem ser ativados individualmente ou em conjunto.

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

Quando existe ao menos um filtro, a toolbar apresenta a ação **Limpar** acompanhada da quantidade de critérios ativos. Tags e tipos selecionados também recebem destaque visual.

## Limpar filtros

1. Localize **Limpar** na toolbar.
2. Confira a quantidade de filtros ativos.
3. Selecione a ação.

São removidos squad, módulo, sprint, responsável, tipos, tags e as ocultações de épicos e histórias vazias. O modo de histórias e o controle de subtasks são preservados.

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
- Ocultar histórias vazias só participa da contagem no modo de lanes.
- Limpar filtros não redefine o modo de histórias nem o controle de subtasks.

## Permissões

Filtros são controles locais de consulta e estão disponíveis para `Admin`, `Membro` e `Visualizador`.

## Funcionalidades relacionadas

- [[04 - Board e Visualizacoes/Conhecer o Board|Conhecer o Board]]
- [[04 - Board e Visualizacoes/Controles de Visualizacao do Board|Controles de visualização do Board]]
- [[04 - Board e Visualizacoes/Visualizacao em Arvore|Visualização em árvore]]

<details>
<summary><strong>Como funciona tecnicamente</strong></summary>

### Aplicação dos filtros

O frontend combina os critérios sobre os itens carregados e deriva a lista exibida. Filtros que dependem de relações específicas, como sprint, podem ser resolvidos pelo contrato de consulta correspondente.

### Squad e módulo

O filtro de squad cria um conjunto de usuários do grupo e compara o responsável do item. O filtro de módulo identifica o épico ancestral e verifica seu módulo.

### Persistência

O estado completo é serializado por projeto no armazenamento local. Valores ausentes ou inválidos são combinados com os padrões, evitando impedir a abertura do Board.

</details>
