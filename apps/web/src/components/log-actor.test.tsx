import { screen } from '../test/setup'
import { describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import { LogActor, type LogActorLabels } from './LogActor'

// [B20] O painel de histórico precisa dizer QUEM fez a alteração. Antes, o
// adapter PostgreSQL devolvia `author: null` e o painel exibia o tipo do
// executor ("Humano") como se fosse o nome da pessoa.
const labels: LogActorLabels = {
  agent: 'Agente',
  human: 'Humano',
  system: 'Sistema',
  unknown: 'Desconhecido',
  unidentifiedAuthor: 'Autor não identificado',
}

describe('LogActor — identificação do autor do registro', () => {
  test('pessoa identificada aparece como menção e mantém o nome completo no tooltip', () => {
    render(
      <LogActor
        labels={labels}
        timestamp="11/11/2026, 16:01"
        entry={{ actorType: 'HUMAN', actorLabel: null, author: { id: 'u1', name: 'Camila C. A. Martins', avatarUrl: null } }}
      />,
    )

    expect(screen.getByText('@Camila Martins')).toBeInTheDocument()
    expect(screen.getByTitle('Camila C. A. Martins')).toBeInTheDocument()
    expect(screen.getByText('Humano')).toBeInTheDocument()
    expect(screen.getByText('11/11/2026, 16:01')).toBeInTheDocument()
  })

  test('nome longo segue a regra de duas partes com corte e tooltip (T76)', () => {
    render(
      <LogActor
        labels={labels}
        entry={{ actorType: 'HUMAN', author: { id: 'u1', name: 'Thiago Corrêa Simas de Melo Porto', avatarUrl: null } }}
      />,
    )

    expect(screen.getByText('@Thiago Porto')).toBeInTheDocument()
    expect(screen.getByTitle('Thiago Corrêa Simas de Melo Porto')).toBeInTheDocument()
  })

  test('humano sem autor resolvido mostra fallback explícito, nunca "Humano" como nome', () => {
    render(<LogActor labels={labels} entry={{ actorType: 'HUMAN', author: null }} />)

    expect(screen.getByText('Autor não identificado')).toBeInTheDocument()
    expect(screen.getByText('Humano')).toBeInTheDocument()
    expect(screen.queryByText('@Humano')).not.toBeInTheDocument()
  })

  test('registro de agente usa o rótulo da automação, sem menção de pessoa', () => {
    render(
      <LogActor
        labels={labels}
        entry={{ actorType: 'AGENT', actorLabel: 'Open Code', source: 'MCP', author: { id: 'u1', name: 'Lincoln Saturnino Siqueira', avatarUrl: null } }}
      />,
    )

    expect(screen.getByText('Open Code')).toBeInTheDocument()
    expect(screen.getByText('Agente')).toBeInTheDocument()
    expect(screen.queryByText('@Lincoln Siqueir…')).not.toBeInTheDocument()
  })

  test('registro de sistema não repete o rótulo como selo', () => {
    render(<LogActor labels={labels} entry={{ actorType: 'SYSTEM', source: 'SYSTEM', author: null }} />)

    expect(screen.getByText('Sistema')).toBeInTheDocument()
    expect(screen.queryByText('Humano')).not.toBeInTheDocument()
  })

  test('origem desconhecida não é atribuída a humano', () => {
    render(<LogActor labels={labels} entry={{ actorType: 'UNKNOWN', source: 'UNKNOWN', author: null }} />)

    expect(screen.getByText('Desconhecido')).toBeInTheDocument()
    expect(screen.getByText('Autor não identificado')).toBeInTheDocument()
    expect(screen.queryByText('Humano')).not.toBeInTheDocument()
  })
})
