// [SECURITY] Formatos de imagem raster aprovados para exibição inline na mesma
// origem. SVG e demais formatos ativos nunca são renderizados inline.
export const INLINE_IMAGE_TYPES: ReadonlySet<string> = new Set([
  'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif', 'image/bmp',
])

export function isInlineImage(mimeType: string): boolean {
  return INLINE_IMAGE_TYPES.has(mimeType)
}
