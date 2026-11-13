import type { LightShellTheme } from '@azy-board/ui-contracts'

// Metadados de amostra (sidebar/header/acento) da grade de Aparência, nos dois
// modos. A ordem acompanha LIGHT_SHELL_THEMES em @azy-board/ui-contracts.
// Os valores escuros espelham os tokens `--shell-*` de `:root.dark[...]` em
// globals.css; as âncoras de Grafite e Ameixa vêm dos protótipos.
export const SHELL_THEMES: Array<{
  id: LightShellTheme
  sidebar: string
  header: string
  accent: string
  darkSidebar: string
  darkHeader: string
  darkAccent: string
}> = [
  { id: 'petroleum', sidebar: '#0B4651', header: '#0E4B56', accent: '#50E3C2', darkSidebar: 'hsl(187 16% 9%)', darkHeader: 'hsl(187 13% 14%)', darkAccent: 'hsl(166 72% 60%)' },
  { id: 'ocean', sidebar: '#123B67', header: '#164777', accent: '#67C7FF', darkSidebar: 'hsl(207 16% 9%)', darkHeader: 'hsl(207 16% 14%)', darkAccent: '#67C7FF' },
  { id: 'emerald', sidebar: '#125244', header: '#146052', accent: '#69E0B5', darkSidebar: 'hsl(162 14% 9%)', darkHeader: 'hsl(162 14% 14%)', darkAccent: '#69E0B5' },
  { id: 'graphite', sidebar: '#272B31', header: '#30353C', accent: '#A99FFF', darkSidebar: '#15161A', darkHeader: '#1A1B20', darkAccent: '#DADAD6' },
  { id: 'classic', sidebar: '#FFFFFF', header: '#FFFFFF', accent: '#635BFF', darkSidebar: 'hsl(244 10% 9%)', darkHeader: 'hsl(244 10% 14%)', darkAccent: '#635BFF' },
  { id: 'ruby', sidebar: '#5B1620', header: '#6B1B27', accent: '#FF6B81', darkSidebar: 'hsl(352 16% 9%)', darkHeader: 'hsl(352 16% 14%)', darkAccent: '#FF6B81' },
  { id: 'amber', sidebar: '#5A3410', header: '#6B3E13', accent: '#FFB15C', darkSidebar: 'hsl(30 15% 9%)', darkHeader: 'hsl(30 15% 14%)', darkAccent: '#FFB15C' },
  { id: 'amethyst', sidebar: '#3F2A63', header: '#4A3174', accent: '#B592FF', darkSidebar: '#19151F', darkHeader: '#211B29', darkAccent: '#C6A0F5' },
  { id: 'rose', sidebar: '#5C1F3B', header: '#6C2547', accent: '#FF8FC0', darkSidebar: 'hsl(334 16% 9%)', darkHeader: 'hsl(334 16% 14%)', darkAccent: '#FF8FC0' },
  { id: 'silver', sidebar: '#CDD3DC', header: '#E2E6EC', accent: '#5B6675', darkSidebar: 'hsl(215 8% 9%)', darkHeader: 'hsl(215 8% 14%)', darkAccent: '#B9C4D1' },
]
