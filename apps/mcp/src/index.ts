/**
 * Servidor MCP do Azy Board — transporte stdio
 * Configure no Claude Code com:
 *   EASYBOARD_API_KEY=azb_xxx EASYBOARD_URL=http://localhost:3000 bun run apps/mcp/src/index.ts
 *
 * HIERARQUIA DE ITENS (obrigatória):
 *   EPIC  → pai: nenhum (moduleId obrigatório). Representa uma iniciativa ou épico de produto.
 *   STORY → pai: EPIC. Representa uma história de usuário dentro de um épico.
 *   TASK  → pai: STORY, TASK ou BUG. Representa trabalho técnico concreto.
 *   BUG   → pai: STORY, TASK ou BUG. Representa uma correção de defeito.
 *   TASK/BUG sem parentId → item órfão, vai direto para o Backlog (válido).
 *
 * ERROS COMUNS A EVITAR:
 *   ✗ Criar TASK/BUG com parentId de EPIC (viola a hierarquia)
 *   ✗ Criar STORY sem parentId
 *   ✗ Criar EPIC sem moduleId
 *   ✓ Use list_modules para obter moduleId antes de criar EPIC
 *   ✓ Use list_tasks com type=EPIC ou type=STORY para navegar a hierarquia
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import {
  toolListTasks,
  toolListModules,
  toolGetCurrentSprint,
  toolClaimTask,
  toolMoveTask,
  toolCompleteTask,
  toolCreateTask,
  toolListChecklists,
  toolCreateChecklist,
  toolAddChecklistItem,
  toolCheckItem,
} from './tools.js'

// [TENANT] API Key autentica o agente como o Owner humano vinculado — resolvido pelo middleware da API
const API_KEY = process.env.EASYBOARD_API_KEY
const API_URL = process.env.EASYBOARD_URL ?? 'http://localhost:3000'

if (!API_KEY) {
  console.error('EASYBOARD_API_KEY não configurada')
  process.exit(1)
}

export async function makeApiCall(apiUrl: string, apiKey: string) {
  return async function apiCall(path: string, method = 'GET', body?: unknown) {
    const res = await fetch(`${apiUrl}/api${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        // [TENANT] API Key identifica o agente e o tenant — resolvido pelo authMiddleware
        Authorization: `Bearer ${apiKey}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`API error ${res.status}: ${err}`)
    }
    return res.json()
  }
}

const apiCall = await makeApiCall(API_URL, API_KEY)

const server = new Server(
  { name: 'azy-board', version: '1.0.0' },
  { capabilities: { tools: {} } }
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'list_tasks',
      description: `Lista itens de um projeto com filtros opcionais.

USE ESTE TOOL PARA NAVEGAR A HIERARQUIA antes de criar itens:
  - type=EPIC   → lista todos os épicos (para obter parentId ao criar STORYs)
  - type=STORY  → lista todas as histórias (para obter parentId ao criar TASKs/BUGs)
  - type=TASK   → lista tarefas técnicas
  - Múltiplos tipos: type=TASK,BUG

Por padrão (onlyLeaves=true) retorna apenas itens sem filhos — útil para encontrar
trabalho disponível. Para navegar a hierarquia, passe onlyLeaves=false.

Campos retornados: id, title, type, status, priority, parentId, moduleId, assigneeId, columnId.`,
      inputSchema: {
        type: 'object',
        properties: {
          projectId: { type: 'string', description: 'ID do projeto' },
          type: {
            type: 'string',
            description: 'Filtrar por tipo: EPIC, STORY, TASK, BUG ou combinações separadas por vírgula (ex: TASK,BUG). Omitir retorna todos.',
          },
          sprintId: { type: 'string', description: 'Filtrar por sprint (opcional)' },
          onlyLeaves: {
            type: 'boolean',
            description: 'Apenas itens sem filhos (padrão: true). Passe false para ver todos os níveis.',
          },
        },
        required: ['projectId'],
      },
    },
    {
      name: 'list_modules',
      description: `Lista os módulos de um projeto.

OBRIGATÓRIO antes de criar um EPIC: o campo moduleId deve apontar para um módulo existente.
Todo projeto tem pelo menos um módulo padrão ("Geral") criado automaticamente.

Exemplo de uso:
  1. list_modules(projectId) → obtém [{id: "mod-123", name: "Geral"}, ...]
  2. create_task(projectId, title, type=EPIC, moduleId="mod-123")`,
      inputSchema: {
        type: 'object',
        properties: {
          projectId: { type: 'string', description: 'ID do projeto' },
        },
        required: ['projectId'],
      },
    },
    {
      name: 'get_current_sprint',
      description: `Retorna a sprint ativa de um projeto.

Retorna {status: "NONE"} se não houver sprint ativa.
Campos retornados: id, name, startDate, endDate, status.
Use o id retornado em list_tasks(sprintId=...) para filtrar tarefas da sprint atual.`,
      inputSchema: {
        type: 'object',
        properties: { projectId: { type: 'string' } },
        required: ['projectId'],
      },
    },
    {
      name: 'claim_task',
      description: `Reivindica uma TASK ou BUG para o agente, marcando como Em Progresso e atribuindo ao agente.

Retorna erro 409 se o item já está atribuído a outro usuário.
Só funciona em itens de tipo TASK ou BUG — não use em EPIC ou STORY.
Após reivindicar, use move_task para mover entre colunas conforme o progresso.`,
      inputSchema: {
        type: 'object',
        properties: {
          projectId: { type: 'string' },
          taskId: { type: 'string', description: 'ID da TASK ou BUG a ser reivindicada' },
        },
        required: ['projectId', 'taskId'],
      },
    },
    {
      name: 'move_task',
      description: `Move uma TASK ou BUG folha para outra coluna do board Kanban.

Colunas típicas: "Backlog", "Em Implementação", "Bloqueada", "Concluídas".
O nome da coluna deve ser exato (case-sensitive).
Só funciona em TASK/BUG sem filhos (itens folha).
Para concluir um item, prefira complete_task.`,
      inputSchema: {
        type: 'object',
        properties: {
          projectId: { type: 'string' },
          taskId: { type: 'string' },
          columnName: { type: 'string', description: 'Nome exato da coluna destino' },
        },
        required: ['projectId', 'taskId', 'columnName'],
      },
    },
    {
      name: 'complete_task',
      description: `Marca qualquer item como concluído (DONE).

Comportamento por tipo:
  - TASK/BUG folha → move para a coluna mapeada como DONE no board
  - EPIC/STORY → atualiza o campo status para DONE diretamente (não aparece no Kanban)

Use este tool ao finalizar trabalho em vez de move_task para garantir o mapeamento correto.`,
      inputSchema: {
        type: 'object',
        properties: {
          projectId: { type: 'string' },
          taskId: { type: 'string' },
        },
        required: ['projectId', 'taskId'],
      },
    },
    {
      name: 'create_task',
      description: `Cria um novo item no projeto respeitando a hierarquia obrigatória.

HIERARQUIA (respeite sempre):
  EPIC  → sem parentId, moduleId obrigatório (use list_modules para obter)
  STORY → parentId deve ser o ID de um EPIC (use list_tasks com type=EPIC)
  TASK  → parentId deve ser ID de STORY, TASK ou BUG — ou sem parentId (vai para Backlog)
  BUG   → mesmas regras de TASK

FLUXO CORRETO para criar trabalho sob um épico:
  1. list_modules(projectId) → pegar moduleId
  2. create_task(projectId, "Meu Épico", type=EPIC, moduleId=...) → pegar epicId
  3. create_task(projectId, "Minha História", type=STORY, parentId=epicId) → pegar storyId
  4. create_task(projectId, "Minha Tarefa", type=TASK, parentId=storyId)

ATALHO — task rápida sem hierarquia:
  create_task(projectId, "Tarefa rápida") → cria TASK órfã no Backlog (sem parentId)

ERROS COMUNS:
  ✗ parentId de EPIC para criar TASK/BUG → use storyId como parentId
  ✗ STORY sem parentId → STORYs precisam de um EPIC pai
  ✗ EPIC sem moduleId → use list_modules primeiro (este tool resolve automaticamente se omitido)

CHECKLIST vs SUBTAREFA vs NADA — decisão importante:
Antes de criar subtarefas ou checklists, avalie qual faz mais sentido:

  Use CHECKLIST (create_checklist + add_checklist_item) quando:
  • Os passos são fases sequenciais de uma mesma unidade de trabalho (ex: "analisar → implementar → testar → revisar")
  • Você quer registrar seu plano de execução de forma visível no card antes de começar
  • Os passos não precisam de status independente no Kanban nem de atribuição separada
  • O trabalho cabe em uma única sessão ou responsável
  Bom para: planos de execução de IA, critérios de aceite, passos de verificação

  Use SUBTAREFA (create_task com parentId) quando:
  • O trabalho é substancial o suficiente para ter vida própria no board (>30 min, estimativa própria)
  • Pode ser feito em paralelo ou por outro agente/pessoa
  • Precisa de rastreamento individual no Kanban (Backlog → Em Implementação → Concluído)
  • Tem dependências ou pode ser bloqueado independentemente
  Bom para: componentes de feature, partes atribuíveis a membros diferentes

  Não registre nada quando:
  • Você está no meio da implementação e o passo é trivial ou instantâneo (<5 min)
  • É um detalhe interno de como você vai fazer algo, não o quê você vai entregar
  • Criar o card custaria mais tempo que executar o trabalho em si
  Exemplos: ajustar um import, renomear uma variável, rodar um lint`,
      inputSchema: {
        type: 'object',
        properties: {
          projectId: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          type: {
            type: 'string',
            enum: ['TASK', 'BUG', 'STORY', 'EPIC'],
            description: 'Tipo do item (padrão: TASK). Ver hierarquia na descrição.',
          },
          priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
          parentId: {
            type: 'string',
            description: 'ID do item pai. STORY→EPIC, TASK/BUG→STORY/TASK/BUG. Omitir para TASK/BUG órfão.',
          },
          moduleId: {
            type: 'string',
            description: 'ID do módulo — obrigatório para EPIC. Se omitido em EPIC, o primeiro módulo do projeto é usado automaticamente.',
          },
          points: { type: 'number', description: 'Story points (estimativa)' },
        },
        required: ['projectId', 'title'],
      },
    },
    {
      name: 'list_checklists',
      description: `Lista todos os checklists de um card com seus itens e progresso.

Retorna: [{id, name, items: [{id, text, checked}]}]
Use antes de add_checklist_item para verificar se um checklist já existe e obter seu id.

Quando usar: sempre que for adicionar itens a um checklist existente, ou para conferir
o progresso antes de marcar a task como concluída.`,
      inputSchema: {
        type: 'object',
        properties: {
          projectId: { type: 'string' },
          itemId: { type: 'string', description: 'ID do card (TASK ou BUG)' },
        },
        required: ['projectId', 'itemId'],
      },
    },
    {
      name: 'create_checklist',
      description: `Cria um checklist nomeado dentro de um card TASK ou BUG. USO OPCIONAL — avalie antes de usar.

QUANDO VALE A PENA criar um checklist:
  ✓ Você vai registrar seu plano de execução antes de começar (transparência para o time)
  ✓ A task tem fases distintas que valem ser rastreadas (analisar, implementar, testar, revisar)
  ✓ Existem critérios de aceite que precisam ser verificados um a um
  ✓ O trabalho vai durar mais de uma sessão e você quer retomar sabendo onde parou

QUANDO NÃO criar checklist:
  ✗ Você está no meio da implementação e o trabalho é muito imediato para justificar
  ✗ Os "passos" são óbvios demais para registrar (ex: "abrir o arquivo", "salvar")
  ✗ A task já é simples o suficiente para ser descrita só pelo título

Nomes sugeridos: "Plano de execução", "Critérios de aceite", "Passos de verificação"
Após criar, use add_checklist_item para adicionar os passos e check_item para marcar progresso.`,
      inputSchema: {
        type: 'object',
        properties: {
          projectId: { type: 'string' },
          itemId: { type: 'string', description: 'ID do card' },
          name: { type: 'string', description: 'Nome do checklist (ex: "Plano de execução")' },
        },
        required: ['projectId', 'itemId', 'name'],
      },
    },
    {
      name: 'add_checklist_item',
      description: `Adiciona um passo a um checklist existente. USO OPCIONAL — veja orientações em create_checklist.

Use list_checklists para obter o checklistId antes de chamar este tool.
Cada item deve representar um passo concreto e verificável — algo que outra pessoa
consiga confirmar como "feito" ou "não feito" ao olhar o board.

Evite passos vagos ("trabalhar na feature") ou granularidade excessiva ("abrir o editor").`,
      inputSchema: {
        type: 'object',
        properties: {
          projectId: { type: 'string' },
          itemId: { type: 'string', description: 'ID do card' },
          checklistId: { type: 'string', description: 'ID do checklist (obtido via list_checklists)' },
          text: { type: 'string', description: 'Descrição do passo (seja específico e verificável)' },
        },
        required: ['projectId', 'itemId', 'checklistId', 'text'],
      },
    },
    {
      name: 'check_item',
      description: `Marca um item de checklist como concluído (checked=true) ou pendente (checked=false).

O progresso do checklist atualiza em tempo real para todos os observadores do board.
Use checked=true ao completar um passo, checked=false para reverter.`,
      inputSchema: {
        type: 'object',
        properties: {
          projectId: { type: 'string' },
          itemId: { type: 'string', description: 'ID do card' },
          checklistId: { type: 'string' },
          checklistItemId: { type: 'string' },
          checked: { type: 'boolean', description: 'true = concluído, false = pendente' },
        },
        required: ['projectId', 'itemId', 'checklistId', 'checklistItemId', 'checked'],
      },
    },
  ],
}))

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  function ok(data: unknown) {
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
  }

  try {
    switch (name) {
      case 'list_tasks':
        return ok(await toolListTasks(apiCall, args as Parameters<typeof toolListTasks>[1]))

      case 'list_modules':
        return ok(await toolListModules(apiCall, (args as { projectId: string }).projectId))

      case 'get_current_sprint':
        return ok(await toolGetCurrentSprint(apiCall, (args as { projectId: string }).projectId))

      case 'claim_task': {
        const { projectId, taskId } = args as { projectId: string; taskId: string }
        return ok(await toolClaimTask(apiCall, projectId, taskId))
      }

      case 'move_task': {
        const { projectId, taskId, columnName } = args as { projectId: string; taskId: string; columnName: string }
        return ok(await toolMoveTask(apiCall, projectId, taskId, columnName))
      }

      case 'complete_task': {
        const { projectId, taskId } = args as { projectId: string; taskId: string }
        return ok(await toolCompleteTask(apiCall, projectId, taskId))
      }

      case 'create_task':
        return ok(await toolCreateTask(apiCall, args as Parameters<typeof toolCreateTask>[1]))

      case 'list_checklists': {
        const { projectId, itemId } = args as { projectId: string; itemId: string }
        return ok(await toolListChecklists(apiCall, projectId, itemId))
      }

      case 'create_checklist': {
        const { projectId, itemId, name } = args as { projectId: string; itemId: string; name: string }
        return ok(await toolCreateChecklist(apiCall, projectId, itemId, name))
      }

      case 'add_checklist_item': {
        const { projectId, itemId, checklistId, text } = args as { projectId: string; itemId: string; checklistId: string; text: string }
        return ok(await toolAddChecklistItem(apiCall, projectId, itemId, checklistId, text))
      }

      case 'check_item': {
        const { projectId, itemId, checklistId, checklistItemId, checked } = args as { projectId: string; itemId: string; checklistId: string; checklistItemId: string; checked: boolean }
        return ok(await toolCheckItem(apiCall, projectId, itemId, checklistId, checklistItemId, checked))
      }

      default:
        throw new Error(`Ferramenta desconhecida: ${name}`)
    }
  } catch (error) {
    return {
      content: [{ type: 'text' as const, text: `Erro: ${error instanceof Error ? error.message : String(error)}` }],
      isError: true,
    }
  }
})

const transport = new StdioServerTransport()
await server.connect(transport)
