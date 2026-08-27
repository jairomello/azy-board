---
title: Usar as Ferramentas MCP
type: guide
order: 2
---

# Usar as Ferramentas MCP

As ferramentas MCP permitem que agentes consultem a estrutura, criem itens, assumam trabalho, movimentem cards e atualizem checklists usando contratos orientados a ações.

## Catálogo de ferramentas

| Ferramenta | Finalidade |
|---|---|
| `list_tasks` | Listar itens com filtros de tipo, sprint e folhas. |
| `list_modules` | Obter módulos e seus identificadores. |
| `get_current_sprint` | Consultar a sprint ativa. |
| `claim_task` | Reivindicar uma `TASK` ou `BUG`. |
| `move_task` | Mover um card folha pelo nome exato da coluna. |
| `complete_task` | Concluir um item usando o tratamento adequado ao tipo. |
| `create_task` | Criar `EPIC`, `STORY`, `TASK`, `BUG` ou subtask. |
| `list_checklists` | Consultar listas, itens e progresso de um card. |
| `create_checklist` | Criar uma lista nomeada. |
| `add_checklist_item` | Acrescentar um passo verificável. |
| `check_item` | Marcar ou reabrir um passo. |

## Navegar pela hierarquia

`list_tasks` recebe `projectId` e aceita:

- `type`: um tipo ou vários separados por vírgula, como `TASK,BUG`;
- `sprintId`: restringe o resultado a uma sprint;
- `onlyLeaves`: quando omitido, retorna apenas itens sem filhos.

Use `onlyLeaves: false` para procurar pais antes de criar uma hierarquia. Exemplos:

```text
list_tasks(projectId, type: "EPIC", onlyLeaves: false)
list_tasks(projectId, type: "STORY", onlyLeaves: false)
list_tasks(projectId, type: "TASK,BUG")
```

## Consultar módulos e sprint

Antes de criar um épico, use `list_modules`. Todo épico precisa de um `moduleId`; quando ele for omitido, o servidor tenta usar o primeiro módulo do projeto.

Use `get_current_sprint` para obter nome, datas, situação e identificador do ciclo ativo. Quando não existe sprint ativa, o retorno informa `status: "NONE"`.

## Criar itens

`create_task` exige `projectId` e `title`. Também aceita descrição, tipo, prioridade, pai, módulo e pontos.

Respeite a hierarquia:

```text
Módulo
└── EPIC
    └── STORY
        └── TASK ou BUG
            └── TASK ou BUG
```

Fluxo recomendado:

1. Consulte os módulos.
2. Crie o `EPIC` com `moduleId`.
3. Crie a `STORY` com `parentId` igual ao épico.
4. Crie `TASK` ou `BUG` com `parentId` igual à história.

Uma `TASK` ou `BUG` sem pai é válida e entra diretamente no fluxo do projeto. Uma história sem épico e uma task filha direta de épico são rejeitadas com orientação para corrigir a hierarquia.

## Reivindicar trabalho

1. Liste itens folha disponíveis.
2. Escolha uma `TASK` ou `BUG` sem responsável.
3. Execute `claim_task` com `projectId` e `taskId`.

O card passa para trabalho em andamento e registra o proprietário humano e a API Key do agente. Se já estiver atribuído, a ferramenta retorna conflito em vez de sobrescrever o responsável.

## Movimentar e concluir

`move_task` recebe o nome exato e diferencia maiúsculas e minúsculas. Se a coluna não existir, a resposta informa os nomes disponíveis.

Prefira `complete_task` para finalizar:

- `TASK` ou `BUG` folha é movido para a coluna cujo status base é `DONE`;
- itens agregadores, como `EPIC`, `STORY` ou `TASK`/`BUG` com filhos, têm seu status atualizado para `DONE` sem movimentação de card.

Se não existir coluna de conclusão, a ferramenta informa o problema para que o fluxo seja configurado.

## Trabalhar com checklists

1. Execute `list_checklists` para evitar duplicidade e obter identificadores.
2. Use `create_checklist` quando precisar de uma nova lista.
3. Acrescente passos com `add_checklist_item`.
4. Atualize cada passo com `check_item` e `checked: true` ou `false`.

Crie checklist para fases verificáveis da mesma unidade de trabalho. Crie subtasks quando as partes precisarem de responsável, estimativa ou movimentação independentes. Não registre passos triviais cujo controle custe mais do que sua execução.

## Fluxo completo de exemplo

```text
1. get_current_sprint(projectId)
2. list_tasks(projectId, type: "TASK,BUG", onlyLeaves: true)
3. claim_task(projectId, taskId)
4. create_checklist(projectId, taskId, "Plano de execução")
5. add_checklist_item(..., "Implementar a alteração")
6. add_checklist_item(..., "Executar os testes")
7. check_item(..., checked: true)
8. complete_task(projectId, taskId)
```

## Permissões

As ferramentas herdam o grupo global, tenant, membership e papel local do
proprietário da chave. Membros de Equipe e Gerentes só acessam projetos dos
quais participam; Admins e Root podem operar projetos do tenant conforme suas
permissões. Consultas exigem acesso ao projeto e mutações exigem papel
compatível. `projectScope` e `permissionScope` apenas restringem o acesso; uma
API Key nunca eleva o proprietário nem pode transformar um `VIEWER` em
`MEMBER` ou `ADMIN`.

## Funcionalidades relacionadas

- [[03 - Estrutura do Trabalho/Hierarquia dos Itens|Hierarquia dos itens]]
- [[03 - Estrutura do Trabalho/Leaf Rule e Itens Agregadores|Leaf Rule e itens agregadores]]
- [[06 - Tasks Bugs e Subtasks/Checklists|Checklists]]
- [[09 - Agentes e Integracoes/Configurar o Servidor MCP|Configurar o servidor MCP]]
- [[09 - Agentes e Integracoes/Entender a Sincronizacao e Auditoria|Entender a sincronização e auditoria]]

<details>
<summary><strong>Como funciona tecnicamente</strong></summary>

As ferramentas são adaptadores sobre endpoints REST. A API revalida o Owner,
grupo, tenant, estado da chave e autorização do recurso em cada chamada. O
servidor resolve nomes de coluna, pré-valida relações de pai, encontra o módulo
padrão e escolhe a estratégia de conclusão antes de chamar a API.

O contrato MCP declara schemas JSON para cada entrada. A suíte `bun run test:mcp` exercita o fluxo completo contra uma API em memória, incluindo hierarquia, claim, movimentação, conclusão e checklists.

</details>
