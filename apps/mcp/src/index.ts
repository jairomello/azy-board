/**
 * Servidor MCP do Azy Board — transporte stdio
 * Configure no Claude Code com:
 *   EASYBOARD_API_KEY=azb_xxx EASYBOARD_URL=http://localhost:3000 bun run apps/mcp/src/index.ts
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'

// [TENANT] API Key autentica o agente como o Owner humano vinculado — resolvido pelo middleware da API
const API_KEY = process.env.EASYBOARD_API_KEY
const API_URL = process.env.EASYBOARD_URL ?? 'http://localhost:3000'

if (!API_KEY) {
  console.error('EASYBOARD_API_KEY não configurada')
  process.exit(1)
}

async function apiCall(path: string, method = 'GET', body?: unknown) {
  const res = await fetch(`${API_URL}/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      // [TENANT] API Key identifica o agente e o tenant — resolvido pelo authMiddleware
      Authorization: `Bearer ${API_KEY}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`API error ${res.status}: ${err}`)
  }
  return res.json()
}

const server = new Server(
  { name: 'azy-board', version: '1.0.0' },
  { capabilities: { tools: {} } }
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'list_tasks',
      description: 'Lista tasks de um projeto. Por padrão retorna apenas tasks folha (sem subtasks).',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: { type: 'string', description: 'ID do projeto' },
          sprintId: { type: 'string', description: 'Filtrar por sprint (opcional)' },
          onlyLeaves: { type: 'boolean', description: 'Apenas tasks folha (padrão: true)' },
        },
        required: ['projectId'],
      },
    },
    {
      name: 'get_current_sprint',
      description: 'Retorna a sprint ativa de um projeto.',
      inputSchema: {
        type: 'object',
        properties: { projectId: { type: 'string' } },
        required: ['projectId'],
      },
    },
    {
      name: 'claim_task',
      description: 'Reivindica uma task para o agente, marcando como Em Progresso.',
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
      name: 'move_task',
      description: 'Move um card para outra coluna pelo nome da coluna.',
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
      description: 'Marca qualquer item como concluído (DONE). Para TASK/BUG folha move para a coluna DONE; para EPIC/STORY atualiza o status diretamente.',
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
      description: 'Cria um novo item no projeto. O tipo padrão é TASK; use type=STORY para histórias ou type=EPIC para épicos. Subtasks são criadas via parentId.',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          type: { type: 'string', enum: ['TASK', 'BUG', 'STORY', 'EPIC'], description: 'Tipo do item (padrão: TASK)' },
          priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
          parentId: { type: 'string', description: 'ID do item pai (para criar filhos de EPIC, STORY ou subtasks)' },
          moduleId: { type: 'string', description: 'ID do módulo (obrigatório para EPICs sem parentId)' },
          points: { type: 'number' },
        },
        required: ['projectId', 'title'],
      },
    },
    {
      name: 'list_checklists',
      description: 'Lista todos os checklists de um card com seus itens e progresso.',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: { type: 'string' },
          itemId: { type: 'string', description: 'ID do card' },
        },
        required: ['projectId', 'itemId'],
      },
    },
    {
      name: 'create_checklist',
      description: 'Cria um checklist nomeado dentro de um card. Use para declarar um plano de execução antes de iniciar o trabalho.',
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
      description: 'Adiciona um item (passo) a um checklist existente.',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: { type: 'string' },
          itemId: { type: 'string', description: 'ID do card' },
          checklistId: { type: 'string' },
          text: { type: 'string', description: 'Descrição do passo' },
        },
        required: ['projectId', 'itemId', 'checklistId', 'text'],
      },
    },
    {
      name: 'check_item',
      description: 'Marca um item de checklist como concluído ou não. O progresso atualiza em tempo real para todos os observadores do board.',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: { type: 'string' },
          itemId: { type: 'string', description: 'ID do card' },
          checklistId: { type: 'string' },
          checklistItemId: { type: 'string' },
          checked: { type: 'boolean' },
        },
        required: ['projectId', 'itemId', 'checklistId', 'checklistItemId', 'checked'],
      },
    },
  ],
}))

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  try {
    switch (name) {
      case 'list_tasks': {
        const { projectId, sprintId, onlyLeaves = true } = args as {
          projectId: string; sprintId?: string; onlyLeaves?: boolean
        }
        const params = new URLSearchParams({ leaf: String(onlyLeaves) })
        if (sprintId) params.set('sprintId', sprintId)
        const tasks = await apiCall(`/projects/${projectId}/items?${params}`)
        return { content: [{ type: 'text', text: JSON.stringify(tasks, null, 2) }] }
      }

      case 'get_current_sprint': {
        const { projectId } = args as { projectId: string }
        const sprint = await apiCall(`/projects/${projectId}/sprints/current`)
        return { content: [{ type: 'text', text: JSON.stringify(sprint, null, 2) }] }
      }

      case 'claim_task': {
        const { projectId, taskId } = args as { projectId: string; taskId: string }
        const result = await apiCall(`/projects/${projectId}/items/${taskId}/claim`, 'PATCH')
        return { content: [{ type: 'text', text: JSON.stringify(result) }] }
      }

      case 'move_task': {
        const { projectId, taskId, columnName } = args as {
          projectId: string; taskId: string; columnName: string
        }
        // Resolver ID da coluna pelo nome
        const cols = await apiCall(`/projects/${projectId}/columns`) as Array<{ id: string; name: string }>
        const col = cols.find(c => c.name === columnName)
        if (!col) throw new Error(`Coluna "${columnName}" não encontrada`)
        const result = await apiCall(`/projects/${projectId}/items/${taskId}/move`, 'PATCH', { columnId: col.id })
        return { content: [{ type: 'text', text: JSON.stringify(result) }] }
      }

      case 'complete_task': {
        const { projectId, taskId } = args as { projectId: string; taskId: string }
        // Para TASK/BUG folha: mover para coluna DONE (mantém columnId correto no board)
        // Para EPIC/STORY: atualizar status diretamente via PATCH
        const item = await apiCall(`/projects/${projectId}/items/${taskId}`) as { type: string; isLeaf: boolean }
        if (['TASK', 'BUG'].includes(item.type) && item.isLeaf) {
          const cols = await apiCall(`/projects/${projectId}/columns`) as Array<{ id: string; baseStatus: string }>
          const doneCol = cols.find(c => c.baseStatus === 'DONE')
          if (!doneCol) throw new Error('Nenhuma coluna mapeada para DONE no projeto')
          const result = await apiCall(`/projects/${projectId}/items/${taskId}/move`, 'PATCH', { columnId: doneCol.id })
          return { content: [{ type: 'text', text: JSON.stringify(result) }] }
        }
        const result = await apiCall(`/projects/${projectId}/items/${taskId}`, 'PATCH', { status: 'DONE' })
        return { content: [{ type: 'text', text: JSON.stringify(result) }] }
      }

      case 'create_task': {
        const { projectId, ...taskData } = args as { projectId: string; [key: string]: unknown }
        const result = await apiCall(`/projects/${projectId}/items`, 'POST', taskData)
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
      }

      case 'list_checklists': {
        const { projectId, itemId } = args as { projectId: string; itemId: string }
        const result = await apiCall(`/projects/${projectId}/items/${itemId}/checklists`)
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
      }

      case 'create_checklist': {
        const { projectId, itemId, name } = args as { projectId: string; itemId: string; name: string }
        const result = await apiCall(`/projects/${projectId}/items/${itemId}/checklists`, 'POST', { name })
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
      }

      case 'add_checklist_item': {
        const { projectId, itemId, checklistId, text } = args as {
          projectId: string; itemId: string; checklistId: string; text: string
        }
        const result = await apiCall(`/projects/${projectId}/items/${itemId}/checklists/${checklistId}/items`, 'POST', { text })
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
      }

      case 'check_item': {
        const { projectId, itemId, checklistId, checklistItemId, checked } = args as {
          projectId: string; itemId: string; checklistId: string; checklistItemId: string; checked: boolean
        }
        const result = await apiCall(
          `/projects/${projectId}/items/${itemId}/checklists/${checklistId}/items/${checklistItemId}`,
          'PATCH',
          { checked }
        )
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
      }

      default:
        throw new Error(`Ferramenta desconhecida: ${name}`)
    }
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Erro: ${error instanceof Error ? error.message : String(error)}` }],
      isError: true,
    }
  }
})

const transport = new StdioServerTransport()
await server.connect(transport)
