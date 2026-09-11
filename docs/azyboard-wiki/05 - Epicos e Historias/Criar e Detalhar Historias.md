---
title: Criar e Detalhar Histórias
type: guide
order: 2
---

# Criar e Detalhar Histórias

Uma história descreve uma necessidade funcional sob a perspectiva de quem recebe valor. Ela pertence a um épico e conecta o objetivo amplo às tasks e bugs de execução.

## Onde encontrar

Uma história pode ser criada:

- Pelo menu **Criar** na barra de comandos do Kanban ou da árvore.
- Diretamente pelo seletor de história pai ao criar uma task ou bug.

Para editar, use a ação no cabeçalho da lane de história, selecione seu card quando o modo de cards estiver ativo ou acesse a história pela hierarquia.

## Organizar a modal

Narrativa, critérios de aceitação e notas ficam em accordions independentes. A primeira seção começa aberta; **Expandir tudo** e **Recolher tudo** controlam todas as seções sem descartar alterações ou formatação rich text.

## Campos da história

| Campo | Obrigatório | Finalidade |
|---|---:|---|
| Título | Sim | Resumir a capacidade ou resultado. |
| Épico | Sim | Definir o objetivo ao qual a história pertence. |
| Versão | Não | Indicar a entrega planejada. |
| Como | Não | Identificar persona ou papel beneficiado. |
| Eu quero | Não | Descrever a ação ou capacidade desejada. |
| Para que | Não | Explicar o benefício ou resultado. |
| Critérios de aceitação | Não | Definir condições para considerar a história concluída. |
| Notas | Não | Registrar contexto e referências adicionais. |

## Como criar pela barra de comandos

1. Abra o Kanban.
2. Abra o menu **Criar** e selecione **História**.
3. Informe o título.
4. Escolha o épico pai.
5. Se necessário, associe uma versão.
6. Preencha a narrativa ágil.
7. Registre critérios de aceitação e notas.
8. Selecione **Salvar história**.

## Criar durante o cadastro de uma task

1. Abra uma task ou bug em criação.
2. Abra o seletor **História pai**.
3. Escolha a opção de criar uma história.
4. Informe o título e o épico.
5. Confirme.
6. A nova história já fica selecionada como pai do item.

Esse fluxo é indicado para criação rápida. O detalhamento completo pode ser realizado depois na janela da história.

## Construir a narrativa ágil

Uma narrativa completa segue a estrutura:

```text
Como [persona]
Eu quero [ação ou capacidade]
Para que [benefício esperado]
```

Exemplo:

```text
Como cliente com assinatura ativa
Eu quero atualizar meu cartão antes da renovação
Para que a assinatura não seja interrompida
```

Os campos são independentes. A equipe pode utilizá-los conforme sua prática de refinamento.

## Alterar o épico pai

1. Abra a história.
2. Escolha outro épico no campo **Épico**.
3. Salve.

A história e seus descendentes passam para a lane do novo épico, e os breadcrumbs são atualizados.

## História no Board

Por padrão, toda história aparece como uma lane horizontal dentro do épico. A lane:

- Contém as colunas e os cards descendentes.
- Pode ser expandida ou recolhida independentemente.
- Exibe quantidade de cards e progresso.
- Permite criar tasks e bugs já vinculados à história.
- Pode ser ocultada quando vazia pelo filtro correspondente.

No modo **Histórias como cards**, uma história sem filhos aparece como card móvel e pode avançar pelas colunas. Quando recebe sua primeira task ou bug, torna-se agregadora e aparece como referência não arrastável.

## Associar uma versão

O campo aparece quando existem versões no projeto. Use **Sem versão** para retirar uma associação anterior.

A versão da história pode ser diferente da versão do épico quando o planejamento de entrega exigir.

## Cancelar sem salvar

Selecione **Cancelar**, feche a janela ou pressione `Escape`. Alterações não confirmadas são descartadas.

## Regras e comportamentos

- Título e épico são obrigatórios.
- O épico pai deve pertencer ao mesmo projeto.
- Uma história não pode ser filha de outra história.
- Alterar o pai move toda a subárvore para outro contexto.
- Critérios e notas preservam formatação rich text.
- Histórias folha podem receber coluna e status no modo de cards.
- No modo padrão, histórias são lanes internas dos épicos.
- Histórias com filhos consolidam pontos e progresso.

## Permissões

`Admin` e `Membro` podem criar e editar histórias. `Visualizador` pode consultar seu conteúdo e posição na hierarquia.

## Funcionalidades relacionadas

- [[05 - Epicos e Historias/Criar e Gerenciar Epicos|Criar e gerenciar épicos]]
- [[05 - Epicos e Historias/Escrever Criterios de Aceitacao e Notas|Escrever critérios de aceitação e notas]]
- [[06 - Tasks Bugs e Subtasks/Criar e Editar Tasks e Bugs|Criar e editar tasks e bugs]]
- [[03 - Estrutura do Trabalho/Leaf Rule e Itens Agregadores|Leaf Rule e itens agregadores]]

<details>
<summary><strong>Como funciona tecnicamente</strong></summary>

### Tipo e hierarquia

A história é um item `STORY` cujo `parentId` referencia um épico. Campos de persona, objetivo, benefício, critérios e notas pertencem ao mesmo registro unificado.

### Rich text

Critérios e notas são editados como conteúdo estruturado e persistidos em HTML. A renderização aplica a mesma semântica nos acessos seguintes.

### Mudança de pai

O backend valida o novo épico, atualiza a relação e reconstrói o ancestry path da história e de seus descendentes.

</details>
