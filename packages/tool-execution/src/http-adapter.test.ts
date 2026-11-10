import { describe, expect, test } from 'bun:test'
import { toolCreateColumn, type ApiCall } from './http-adapter'

function recordingApi(calls: Array<{ path: string; method: string; body?: unknown }>): ApiCall {
  return (async (path: string, method = 'GET', body?: unknown) => {
    calls.push({ path, method, body })
    return { id: 'column-1', name: 'Planejado', baseStatus: 'PLANNED' }
  }) as ApiCall
}

describe('create_column no adaptador HTTP', () => {
  // Regressão: o corpo da rota é estrito e rejeitava o projectId herdado dos
  // argumentos da ferramenta com INVALID_REQUEST.
  test('envia somente name e baseStatus no corpo, com o projeto apenas no path', async () => {
    const calls: Array<{ path: string; method: string; body?: unknown }> = []
    const args = { projectId: 'project-1', name: '  Planejado  ', baseStatus: 'PLANNED' }

    await toolCreateColumn(recordingApi(calls), 'project-1', args)

    expect(calls).toHaveLength(1)
    expect(calls[0]?.path).toBe('/projects/project-1/columns')
    expect(calls[0]?.method).toBe('POST')
    expect(calls[0]?.body).toEqual({ name: 'Planejado', baseStatus: 'PLANNED' })
  })

  test('exige nome e status base antes de chamar a API', async () => {
    const calls: Array<{ path: string; method: string; body?: unknown }> = []
    expect(() => toolCreateColumn(recordingApi(calls), 'project-1', { name: '   ', baseStatus: 'PLANNED' })).toThrow('name é obrigatório')
    expect(() => toolCreateColumn(recordingApi(calls), 'project-1', { name: 'Planejado', baseStatus: '' })).toThrow('baseStatus é obrigatório')
    expect(calls).toHaveLength(0)
  })
})
