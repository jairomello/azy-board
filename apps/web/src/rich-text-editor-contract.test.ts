import { describe, expect, test } from 'bun:test'

async function source(path: string) {
  return fetch(new URL(path, import.meta.url)).then(response => response.text())
}

function contains(text: string, expected: string) {
  expect(text.includes(expected)).toBe(true)
}

describe('contrato do editor rich text', () => {
  // Regressão: sem @tailwindcss/typography as classes `prose` não geram estilo e o
  // reset do Tailwind zera títulos, listas e citação (bug reportado no card T5).
  test('habilita o plugin de tipografia que dá efeito visual ao conteúdo', async () => {
    const config = await source('../tailwind.config.ts')
    contains(config, "from '@tailwindcss/typography'")
    contains(config, 'plugins: [typography]')
  })

  test('editor usa prose e comandos de bloco do StarterKit', async () => {
    const editor = await source('./components/RichTextEditor.tsx')
    contains(editor, 'prose prose-sm dark:prose-invert')
    for (const command of ['toggleHeading', 'toggleBulletList', 'toggleOrderedList', 'toggleBlockquote']) {
      contains(editor, command)
    }
  })
})
