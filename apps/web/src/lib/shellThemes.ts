import type { LightShellTheme } from '@azy-board/ui-contracts'

// Metadados de amostra (sidebar/header/acento) da grade de Aparência.
// A ordem acompanha LIGHT_SHELL_THEMES em @azy-board/ui-contracts.
export const SHELL_THEMES: Array<{
  id: LightShellTheme
  sidebar: string
  header: string
  accent: string
}> = [
  { id: 'petroleum', sidebar: '#0B4651', header: '#0E4B56', accent: '#50E3C2' },
  { id: 'ocean', sidebar: '#123B67', header: '#164777', accent: '#67C7FF' },
  { id: 'emerald', sidebar: '#125244', header: '#146052', accent: '#69E0B5' },
  { id: 'graphite', sidebar: '#272B31', header: '#30353C', accent: '#A99FFF' },
  { id: 'classic', sidebar: '#FFFFFF', header: '#FFFFFF', accent: '#635BFF' },
  { id: 'ruby', sidebar: '#5B1620', header: '#6B1B27', accent: '#FF6B81' },
  { id: 'amber', sidebar: '#5A3410', header: '#6B3E13', accent: '#FFB15C' },
  { id: 'amethyst', sidebar: '#3F2A63', header: '#4A3174', accent: '#B592FF' },
  { id: 'rose', sidebar: '#5C1F3B', header: '#6C2547', accent: '#FF8FC0' },
  { id: 'silver', sidebar: '#CDD3DC', header: '#E2E6EC', accent: '#5B6675' },
]
