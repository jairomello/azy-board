---
title: Criar e Gerenciar Épicos
type: guide
order: 1
---

# Criar e Gerenciar Épicos

Um épico representa um objetivo amplo dentro de um módulo. No Board, cada épico organiza suas histórias em uma lane principal, formando a hierarquia visual **Épico → História → Cards**.

## Onde encontrar

Épicos podem ser criados pela ação **Épico** na toolbar do Kanban. Um épico existente pode ser editado pela ação de edição no cabeçalho de sua swimlane.

## Organizar a modal

Os dados principais e a descrição aparecem em accordions independentes. A primeira seção começa aberta e os controles **Expandir tudo** e **Recolher tudo** alteram apenas a visualização; salvar e cancelar mantêm o comportamento original.

## Campos do épico

| Campo | Obrigatório | Finalidade |
|---|---:|---|
| Título | Sim | Identificar o objetivo e nomear a swimlane. |
| Módulo | Sim | Posicionar o épico em uma área funcional. |
| Versão | Não | Relacionar o épico a uma entrega planejada. |
| Descrição | Não | Registrar contexto, escopo e resultado esperado. |

O campo **Versão** aparece quando o projeto possui versões cadastradas.

## Como criar

1. Abra o Kanban do projeto.
2. Selecione **Épico** na toolbar.
3. Informe um título.
4. Escolha o módulo.
5. Se necessário, associe uma versão.
6. Acrescente uma descrição.
7. Selecione **Salvar**.

Depois da criação, uma nova swimlane passa a representar o épico no Board.

## Como editar

1. Localize a swimlane do épico.
2. Selecione a ação de edição no cabeçalho.
3. Altere os campos necessários.
4. Salve.

Alterar o título atualiza a identificação da swimlane e o breadcrumb dos descendentes. Alterar o módulo muda o agrupamento do épico na estrutura do projeto.

## Escolher o módulo

Use módulos para dividir o produto ou a iniciativa em áreas compreensíveis. Um épico só pertence a um módulo por vez.

Exemplo:

```text
Módulo: Pagamentos
Épico: Cobrança recorrente
```

## Associar uma versão

A versão indica a entrega prevista para o épico. Selecione **Sem versão** quando ainda não houver compromisso de entrega.

Associar uma versão ao épico não associa automaticamente todos os descendentes. Histórias, tasks e bugs podem ter suas próprias versões quando o planejamento exigir maior precisão.

## Acompanhar no Board e na árvore

No Board, o épico:

- Nomeia a lane principal.
- Agrupa as lanes de histórias e os cards descendentes.
- Apresenta contagem de histórias, cards e progresso.
- Pode ser expandido ou recolhido.

Na Tree View, aparece abaixo do módulo e acima das histórias, com pontos e progresso consolidados.

## Épicos sem histórias

Um épico pode existir antes de ser detalhado. Sua swimlane permanece visível e vazia, a menos que o controle **Ocultar épicos vazios** esteja ativo.

## Arquivar um épico

O arquivamento é realizado pela Tree View. Como um épico é raiz de uma subárvore, a confirmação informa quantos itens descendentes também serão arquivados.

## Regras e comportamentos

- O título é obrigatório.
- O módulo precisa pertencer ao mesmo projeto.
- Um épico não pode possuir outro épico como pai.
- Épicos não são cards arrastáveis.
- O épico determina a lane principal; a história determina a lane interna no modo padrão.
- Renomear atualiza os breadcrumbs abaixo dele.
- Arquivar afeta toda a subárvore.

## Permissões

`Admin` e `Membro` podem criar e editar épicos. `Visualizador` pode consultar épicos e suas swimlanes. Somente `Admin` gerencia os módulos disponíveis.

## Exemplo prático

No módulo **Pagamentos**, a equipe cria o épico **Cobrança recorrente**, associa a versão **v2.0** e descreve o objetivo de automatizar renovações. Depois, detalha o escopo em histórias.

## Funcionalidades relacionadas

- [[05 - Epicos e Historias/Criar e Detalhar Historias|Criar e detalhar histórias]]
- [[03 - Estrutura do Trabalho/Hierarquia dos Itens|Hierarquia dos itens]]
- [[04 - Board e Visualizacoes/Swimlanes e Colunas|Swimlanes e colunas]]
- [[07 - Configuracoes do Projeto/Configuracoes do Projeto|Configurações do Projeto]]

<details>
<summary><strong>Como funciona tecnicamente</strong></summary>

### Tipo e vínculo

O épico é um item com tipo `EPIC`, sem `parentId` e com `moduleId` obrigatório. A versão é um vínculo opcional.

### Criação e atualização

A mesma API unificada de itens cria e atualiza o épico. O backend valida tenant, projeto, módulo e papel antes de persistir.

### Propagação

Mudanças de título atualizam o ancestry path dos descendentes. Eventos de item criado ou atualizado notificam as sessões conectadas ao projeto.

</details>
