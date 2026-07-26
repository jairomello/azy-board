---
title: Gerenciar Centros de Custo
type: guide
order: 5
---

# Gerenciar Centros de Custo

Centros de custo classificam o trabalho conforme a unidade financeira ou orçamentária responsável. Cada registro possui um código curto e uma descrição.

## Onde encontrar

Na página **Configurações**, localize **Centros de Custo**. Todos os participantes podem consultar a lista; administradores também visualizam as ações de manutenção.

## Criar um centro de custo

1. Informe um código de até 20 caracteres.
2. Acrescente uma descrição de até 200 caracteres.
3. Selecione **Adicionar**.

O código deve ser único dentro do projeto. Use uma convenção reconhecida pela organização, como `CC-100`, `PRODUTO` ou `OPERACOES`.

## Editar

1. Selecione o ícone de edição.
2. Altere o código, a descrição ou ambos.
3. Confirme a alteração.

Como o centro de custo é compartilhado, o novo conteúdo passa a ser exibido em todos os itens vinculados.

## Usar nos itens

Quando o projeto possui centros de custo, as modais dos itens elegíveis apresentam o campo **Centro de Custo**. É possível:

- manter a opção atribuída automaticamente;
- escolher outro centro de custo;
- selecionar **Nenhum**, pois o campo é opcional.

Na criação, a aplicação sugere automaticamente o primeiro centro de custo da ordem configurada. A mesma regra vale para criações feitas por integrações.

## Quando o campo não aparece

Se o projeto não possui centros de custo cadastrados, o campo é ocultado nas modais. Isso mantém o formulário enxuto e não impede a criação de itens.

## Excluir um centro de custo

1. Verifique se ainda existem itens associados.
2. Selecione o ícone de exclusão.
3. Confirme a ação.

Um centro de custo em uso não pode ser excluído. Reatribua ou limpe o campo dos itens indicados e repita a operação. Essa proteção evita a perda silenciosa da classificação financeira.

## Boas práticas

- Use códigos estáveis; coloque detalhes mutáveis na descrição.
- Evite duplicar códigos com grafias diferentes.
- Defina qual centro deve ocupar a primeira posição para a atribuição automática.
- Revise itens antes de desativar uma classificação.

## Permissões

| Ação | Admin | Membro | Visualizador |
|---|---:|---:|---:|
| Consultar centros de custo | Sim | Sim | Sim |
| Escolher o centro em um item editável | Sim | Sim | Não |
| Criar, editar ou excluir | Sim | Não | Não |

## Funcionalidades relacionadas

- [[06 - Tasks Bugs e Subtasks/Criar e Editar Tasks e Bugs|Criar e editar tasks e bugs]]
- [[05 - Epicos e Historias/Criar e Detalhar Historias|Criar e detalhar histórias]]
- [[09 - Agentes e Integracoes/Agentes e Integracoes|Agentes e integrações]]

<details>
<summary><strong>Como funciona tecnicamente</strong></summary>

O centro de custo pertence ao projeto e ao tenant e possui código único no contexto do projeto, descrição e posição de ordenação. Os itens mantêm uma referência opcional para esse registro.

Na criação de um item elegível, o backend aplica a atribuição padrão para garantir comportamento igual entre interface, API e MCP. A exclusão consulta associações existentes e responde com conflito quando o registro ainda está em uso.

</details>

