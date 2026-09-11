---
title: Gerenciar Módulos
type: guide
order: 6
---

# Gerenciar Módulos

Módulos são o primeiro agrupamento funcional dentro de um projeto. Eles organizam épicos por produto, domínio, frente ou componente e alimentam filtros e a hierarquia do trabalho.

## Onde encontrar

Na página **Configurações**, localize **Módulos**. A lista apresenta os módulos cadastrados, e a quantidade de épicos é exibida na confirmação de exclusão.

## Criar um módulo

1. Informe um nome representativo.
2. Selecione **Criar módulo**.

O módulo passa a aparecer na criação de épicos e no filtro de módulos do Board.

## Renomear

1. Selecione o ícone de edição.
2. Altere o nome.
3. Confirme ou pressione `Enter`.

A alteração é refletida nos épicos vinculados e nos filtros, sem modificar a hierarquia interna.

## Reordenar

A ordem dos módulos acompanha a sequência de criação e é usada nas listas e nos filtros do projeto.

## Relação com épicos

Todo épico pertence a um módulo. Ao criar um épico, escolha o módulo pai; quando o projeto ainda não possui módulos, a aplicação disponibiliza o módulo padrão **Geral**.

Use módulos para agrupamentos duradouros. Para classificações transversais e temporárias, prefira tags.

## Excluir um módulo vazio

Selecione o ícone de exclusão e confirme. Como não existem épicos vinculados, somente o módulo é removido.

## Excluir um módulo com épicos

A confirmação apresenta a quantidade de épicos afetados e oferece dois caminhos:

### Transferir para outro módulo

1. Selecione um módulo de destino.
2. Confirme a transferência e a exclusão.

Os épicos, histórias e itens descendentes são preservados. Apenas a associação dos épicos muda.

### Excluir em cascata

1. Mantenha a opção de exclusão definitiva.
2. Confira o impacto indicado.
3. Confirme.

O módulo, seus épicos e toda a hierarquia descendente são removidos. Use essa opção somente quando o conteúdo realmente não deve ser preservado.

> [!danger] Exclusão em cascata
> A ação afeta todos os itens abaixo dos épicos, incluindo histórias, tasks, bugs, subtasks e seus vínculos. Para reorganização, escolha a transferência.

## Permissões

| Ação | Admin | Membro | Visualizador |
|---|---:|---:|---:|
| Consultar e filtrar por módulo | Sim | Sim | Sim |
| Associar épicos em operações permitidas | Sim | Sim | Não |
| Criar, renomear, reordenar ou excluir | Sim | Não | Não |

## Funcionalidades relacionadas

- [[03 - Estrutura do Trabalho/Hierarquia dos Itens|Hierarquia dos itens]]
- [[05 - Epicos e Historias/Criar e Gerenciar Epicos|Criar e gerenciar épicos]]
- [[04 - Board e Visualizacoes/Filtros do Board|Filtros do Board]]

<details>
<summary><strong>Como funciona tecnicamente</strong></summary>

Módulos pertencem ao projeto e ao tenant e possuem posição. O épico guarda a referência obrigatória do módulo, enquanto seus descendentes são alcançados pela hierarquia de pais.

Ao excluir um módulo em uso, a API responde com a quantidade de épicos e exige uma decisão explícita. A transferência atualiza os épicos para um módulo de destino validado no mesmo projeto. A exclusão em cascata percorre os descendentes e remove suas associações em uma transação.

</details>

