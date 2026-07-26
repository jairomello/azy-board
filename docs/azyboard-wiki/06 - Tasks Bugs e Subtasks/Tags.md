---
title: Tags
type: guide
order: 4
---

# Tags

Tags são marcadores coloridos do projeto. Elas classificam itens, facilitam a leitura dos cards e permitem filtrar trabalho por temas que atravessam módulos e épicos.

## Onde encontrar

O seletor de tags aparece na janela de tasks e bugs. Tags associadas também aparecem diretamente no card e na toolbar de filtros.

## Selecionar tags existentes

1. Abra uma task ou bug.
2. Selecione o campo **Tags**.
3. Procure pelo nome ou percorra a lista.
4. Selecione uma ou mais tags.
5. Salve o item.

Tags selecionadas aparecem como chips. Selecione novamente ou use a ação de remoção para desassociá-las.

## Criar uma tag

1. Abra o seletor.
2. Digite um nome ainda não utilizado.
3. Escolha a opção de criação.
4. Selecione uma cor da paleta.
5. Confirme.

A tag passa a pertencer ao projeto e já fica selecionada no item atual.

## Escolher uma cor

Use cores para formar uma linguagem consistente. Exemplos:

| Cor ou grupo | Uso possível |
|---|---|
| Vermelho | Urgência ou incidente. |
| Azul | Área técnica ou backend. |
| Verde | Melhoria validada. |
| Amarelo | Dependência ou atenção. |
| Roxo | Pesquisa ou experiência. |

A cor não possui efeito automático sobre prioridade ou status.

## Editar uma tag

1. No seletor, escolha uma tag já selecionada.
2. Ative a edição.
3. Altere nome, cor ou ambos.
4. Confirme com `Enter` ou ao sair do campo.

Como a tag é compartilhada, a mudança aparece em todos os itens associados.

## Excluir uma tag

Administradores podem remover uma tag do projeto. A exclusão retira sua associação de todos os itens, sem excluir os próprios itens.

Antes de excluir uma tag amplamente utilizada, verifique se outra classificação deve substituí-la.

## Tags no card

Cada associação é apresentada como um chip com nome e cor. Várias tags podem aparecer no mesmo card e quebrar em mais de uma linha quando necessário.

## Filtrar por tags

Na toolbar, selecione uma ou mais tags. Um card é apresentado quando possui pelo menos uma das tags selecionadas e atende aos demais filtros ativos.

## Boas práticas

- Use nomes curtos e inequívocos.
- Evite criar variações como `Urgente`, `urgente` e `Urgência`.
- Defina uma convenção de cores para a equipe.
- Prefira tags para classificações transversais.
- Use módulos, versões e centros de custo para seus propósitos próprios.

## Regras e comportamentos

- Tags pertencem a um projeto.
- Um item pode possuir várias tags.
- Uma tag pode estar em vários itens.
- Editar nome ou cor atualiza todas as ocorrências.
- Remover do card não exclui a tag do projeto.
- Excluir a tag remove suas associações.
- O seletor permanece acima dos demais campos da modal.

## Permissões

| Ação | Admin | Membro | Visualizador |
|---|---:|---:|---:|
| Consultar tags | Sim | Sim | Sim |
| Associar, criar e editar | Sim | Sim | Não |
| Excluir do projeto | Sim | Não | Não |

## Funcionalidades relacionadas

- [[06 - Tasks Bugs e Subtasks/Criar e Editar Tasks e Bugs|Criar e editar tasks e bugs]]
- [[04 - Board e Visualizacoes/Filtros do Board|Filtros do Board]]
- [[09 - Agentes e Integracoes/Agentes e Integracoes|Agentes e Integrações]]

<details>
<summary><strong>Como funciona tecnicamente</strong></summary>

### Modelo

Tags pertencem ao projeto e possuem nome e cor. A relação entre item e tag é muitos para muitos.

### Salvamento

Ao salvar o item, o frontend envia a coleção final de identificadores. O backend sincroniza as associações, mantendo a tag disponível para outros itens.

### Dropdown

O seletor calcula sua posição e é renderizado em uma camada global para não ser cortado pelo scroll ou pela hierarquia de z-index da modal.

</details>

