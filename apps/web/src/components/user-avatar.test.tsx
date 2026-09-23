import { screen } from '../test/setup'
import { describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import { resolveAppUrl } from '../lib/appUrl'
import { UserAvatar } from './UserAvatar'

describe('UserAvatar', () => {
  test('usa a imagem resolvida pelo base path quando há foto', () => {
    render(<UserAvatar user={{ name: 'Ana Souza', avatarUrl: '/api/users/1/avatar' }} />)

    const imagem = screen.getByRole('img', { name: 'Ana Souza' })
    expect(imagem).toHaveAttribute('src', resolveAppUrl('/api/users/1/avatar'))
  })

  test('cai para as iniciais quando não há foto', () => {
    render(<UserAvatar user={{ name: 'Bruno Lima' }} />)

    expect(screen.queryByRole('img')).toBeNull()
    expect(screen.getByText('BL')).toBeInTheDocument()
  })

  test('aplica o tamanho grande usado na página de conta', () => {
    render(<UserAvatar user={{ name: 'Carla Dias' }} size="lg" />)

    expect(screen.getByText('CD').className).toContain('w-12 h-12 text-lg')
  })

  test('exibe o badge de IA apenas quando solicitado e com modelo', () => {
    const { rerender } = render(<UserAvatar user={{ name: 'Agente', aiModelName: 'gpt-4o' }} />)
    expect(screen.queryByTitle('Agente IA: gpt-4o')).toBeNull()

    rerender(<UserAvatar user={{ name: 'Agente', aiModelName: 'gpt-4o' }} showAiBadge />)
    expect(screen.getByTitle('Agente IA: gpt-4o')).toBeInTheDocument()
  })
})
