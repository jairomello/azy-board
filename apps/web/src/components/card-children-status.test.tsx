import { screen } from '../test/setup'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import i18n from '../i18n'

import { CardChildrenSection } from './CardChildrenSection'

const fetchOriginal = globalThis.fetch

beforeEach(async () => {
  await i18n.changeLanguage('pt-BR')
  globalThis.fetch = (async () => new Response(JSON.stringify({
    data: [{
      id: 'filho-1',
      title: 'Card filho em homologação',
      type: 'TASK',
      priority: 'MEDIUM',
      status: 'IN_HOMOLOGATION',
      points: null,
      assigneeId: null,
    }],
    total: 1,
  }), { status: 200, headers: { 'Content-Type': 'application/json' } })) as typeof fetch
})

afterEach(() => { globalThis.fetch = fetchOriginal })

describe('CardChildrenSection — rótulo de status dos filhos', () => {
  test('usa o rótulo traduzido também para Em homologação', async () => {
    render(<CardChildrenSection itemId="i1" projectId="p1" onOpenChild={() => {}} />)
    expect(await screen.findByText('Card filho em homologação')).toBeInTheDocument()
    expect(screen.getByText('Em homologação')).toBeInTheDocument()
    expect(screen.queryByText('IN_HOMOLOGATION')).toBeNull()
  })
})
