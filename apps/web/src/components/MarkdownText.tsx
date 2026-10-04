import { useMemo } from 'react'
import { markdownToHtml } from '../lib/richText'

interface MarkdownTextProps {
  content: string
  // Quando `true`, o texto herda a cor do elemento pai em vez de usar a paleta
  // fixa do plugin de tipografia. Necessário dentro de balões coloridos (ex.:
  // mensagens do Azy Agent), onde o `prose`/`dark:prose-invert` impõe cores que
  // independem do fundo e comprometem o contraste em um dos temas.
  inheritColor?: boolean
}

export function MarkdownText({ content, inheritColor = false }: MarkdownTextProps) {
  const html = useMemo(() => markdownToHtml(content), [content])
  return (
    <div
      className={`space-y-2 leading-relaxed prose prose-sm max-w-none ${inheritColor ? 'markdown-inherit' : 'dark:prose-invert'}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
