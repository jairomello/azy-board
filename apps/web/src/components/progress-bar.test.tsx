import { screen } from '../test/setup'
import { afterEach, describe, expect, test } from 'bun:test'
import { cleanup, render } from '@testing-library/react'
import { ProgressBar } from './ProgressBar'

afterEach(() => {
  cleanup()
  document.documentElement.classList.remove('dark')
})

describe('ProgressBar', () => {
  test('compact expõe valor, rótulo e texto acessível', () => {
    render(<ProgressBar value={42} label="Avanço no fluxo: 42%" />)

    const bar = screen.getByRole('progressbar')
    expect(bar.getAttribute('aria-valuemin')).toBe('0')
    expect(bar.getAttribute('aria-valuemax')).toBe('100')
    expect(bar.getAttribute('aria-valuenow')).toBe('42')
    expect(bar.getAttribute('aria-label')).toBe('Avanço no fluxo: 42%')
    expect(bar.getAttribute('aria-valuetext')).toBe('Avanço no fluxo: 42%')
    expect(document.querySelector('.progress-meter__labels')).toBeNull()
  })

  test('labeled mostra percentual e contagem', () => {
    render(
      <ProgressBar
        variant="labeled"
        value={73}
        label="Progresso do projeto"
        percentLabel="73% concluído"
        countLabel="8/12 entregas"
      />,
    )

    expect(screen.getByText('73% concluído')).toBeTruthy()
    expect(screen.getByText('8/12 entregas')).toBeTruthy()
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('73')
  })

  test('100% usa o estado de concluído', () => {
    render(<ProgressBar value={100} label="Concluído" />)
    expect(document.querySelector('.progress-meter')?.getAttribute('data-progress-state')).toBe('done')
    expect(document.querySelector('.progress-meter')?.classList.contains('progress-meter--done')).toBe(true)
  })

  test('limita valores fora do intervalo', () => {
    render(<ProgressBar value={140} label="Acima" />)
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('100')

    cleanup()
    render(<ProgressBar value={Number.NaN} label="Inválido" />)
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0')
  })

  test('não usa cores fixas no estilo inline', () => {
    render(<ProgressBar value={50} label="Tema" />)
    const fill = document.querySelector('.progress-meter__fill') as HTMLElement
    expect(fill.getAttribute('style')).toContain('--progress-value: 50%')
    expect(/(#[0-9a-f]{3,8}|rgb)/i.test(fill.getAttribute('style') ?? '')).toBe(false)
  })

  test('permanece renderizado no tema escuro', () => {
    document.documentElement.classList.add('dark')
    render(<ProgressBar value={25} label="Escuro" />)
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('25')
  })
})
