import { useMemo } from 'react'
import { markdownToHtml } from '../lib/richText'

export function MarkdownText({ content }: { content: string }) {
  const html = useMemo(() => markdownToHtml(content), [content])
  return (
    <div
      className="space-y-2 leading-relaxed prose prose-sm dark:prose-invert max-w-none"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
