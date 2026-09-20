import type { Config } from 'tailwindcss'
import typography from '@tailwindcss/typography'

export default {
  // [DB-SWAP] darkMode via classe permite persistir tema no banco e aplicar server-side no futuro
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        canvas: 'hsl(var(--canvas))',
        surface: 'hsl(var(--surface))',
        'surface-raised': 'hsl(var(--surface-raised))',
        'surface-floating': 'hsl(var(--surface-floating) / <alpha-value>)',
        'shell-sidebar': 'var(--shell-sidebar)',
        'shell-header': 'var(--shell-header)',
        'shell-border': 'var(--shell-border)',
        'shell-foreground': 'var(--shell-foreground)',
        'shell-muted': 'var(--shell-muted)',
        'shell-active': 'var(--shell-active)',
        'shell-accent': 'var(--shell-accent)',
        'shell-accent-foreground': 'var(--shell-accent-foreground)',
        'status-progress': 'var(--status-progress)',
        'status-review': 'var(--status-review)',
        'status-done': 'var(--status-done)',
        'status-blocked': 'var(--status-blocked)',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [typography],
} satisfies Config
