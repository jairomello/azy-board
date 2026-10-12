# Design — attachment-image-thumbnails

## Context

Ver `proposal.md`. Estado atual relevante:

- `AttachmentsArea` (aba de anexos do card) já renderiza uma miniatura 40×40 para
  `INLINE_IMAGE_TYPES` (png/jpeg/gif/webp/avif/bmp), com clique abrindo
  `yet-another-react-lightbox` sobre `imageAttachments`; demais imagens usam
  ícone `ImageIcon`, e outros formatos usam `FileText`.
- `ProjectPlanningModal` → `ProjectAttachmentsList` (aba "Todos os anexos") lista
  nome, data e origem, **sem** miniatura e sem lightbox.
- A API só expõe o arquivo original pela rota autenticada
  `.../attachments/:id/download` (`serializeAttachment` retorna `url` e
  `isImage`); não há endpoint de miniatura. `sharp` existe na API, mas não será
  usado nesta change.

## Goals / Non-Goals

- **Goals**: miniatura de imagem nas duas listas; carregamento assíncrono por
  item (skeleton individual); clique abre lightbox; sem backend novo.
- **Non-Goals**: gerar/armazenar thumbnails no servidor; alterar o schema, a
  allowlist de MIME ou o contrato da API; mudar a regra de exibição inline
  segura (SVG nunca é executado).

## Decisions

### D1 — Componente único `AttachmentThumbnail`

Criar `apps/web/src/components/AttachmentThumbnail.tsx`, usado por
`AttachmentsArea` e por `ProjectAttachmentsList`, para padronizar markup,
formato e estados. Props: `url`, `name`, `mimeType`, `size` (classe), `onOpen?`
(quando ausente, não é clicável) e `className`. O componente encapsula:

- detecção de imagem inline-safe (constante compartilhada, não duplicada);
- renderização da `<img>` com `object-cover` e dimensão fixa (~64px);
- fallback para ícone de arquivo/imagem quando não é inline-safe.

Alternativa considerada: manter markup duplicado nas duas telas — rejeitado por
divergir comportamento e dificultar a mudança de tamanho.

### D2 — Carregamento assíncrono e independente por item

Cada `AttachmentThumbnail` tem seu próprio estado local (`loading`/`error`),
inicializado como carregando e resolvido no `onLoad`/`onError` da própria
`<img>`. A lista não espera as imagens: renderiza todos os itens de imediato e
cada miniatura aparece quando fica pronta, exibindo um *skeleton* (fundo muted +
spinner) enquanto carrega. Usar `loading="lazy"` e `decoding="async"` para não
disputar banda com o conteúdo visível.

Alternativa considerada: carregar todas as URLs antes de renderizar a lista —
rejeitada porque atrasa a tela e concentra o peso (contraria o pedido).

### D3 — Formatos com miniatura

Só recebem miniatura os formatos raster aprovados para exibição inline
(png/jpeg/gif/webp/avif/bmp), espelhando `INLINE_IMAGE_TYPES`/`INLINE_SAFE_MIME_TYPES`.
SVG e demais formatos mostram ícone, mantendo a política de não executar
conteúdo ativo na origem. A constante passa a ser compartilhada entre as telas.

### D4 — Lightbox

- **Card**: mantém o comportamento atual (lista de imagens do card), apenas
  movendo o disparo para o componente de miniatura.
- **Projeto**: `ProjectAttachmentsList` passa a montar uma lista de imagens do
  projeto (na ordem exibida) e um `Lightbox` próprio; o clique na miniatura abre
  no índice correspondente, permitindo navegar pelas imagens do projeto.

Alternativa considerada: reutilizar o lightbox do card — inviável, pois o
escopo é outro (todas as imagens do projeto, com origens distintas).

### D5 — Sem backend, sem cache novo

A miniatura usa `resolveAppUrl(attachment.url)` (rota autenticada de download).
Não há novo endpoint, geração de imagem, cache ou migração. A URL já embute
tenant/projeto/item e a autorização existente.

## Risks / Trade-offs

- [Banda: cada miniatura é o arquivo original] → `loading="lazy"`,
  `decoding="async"` e skeleton por item; thumbnails no servidor ficam como
  otimização futura se listas com fotos grandes pesarem.
- [Imagem quebrada/formato inesperado] → `onError` cai para ícone, sem quebrar a
  lista.
- [SVG/ativos] → nunca renderizados inline; permanecem como ícone.
- [Consistência entre telas] → componente único com a mesma constante de tipos.

## Migration Plan

Sem migração de banco. Apenas frontend. Rollback = reverter o commit.
`bun run check` e `bun run test:smoke` cobrem typecheck, testes e fluxo web/API.

## Open Questions

Nenhuma pendente que altere specs, abordagem ou tarefas.
