# Proposal

## Why

As listas de anexos não exploram o fato de muitas evidências serem imagens. Na
aba do card já existe uma miniatura pequena (40px), mas discreta; na aba "Todos
os anexos" do projeto não há miniatura alguma — só texto. Isso torna difícil
reconhecer rapidamente prints e capturas anexadas, tanto no card quanto no
planejamento do projeto.

## What Changes

- Introduzir uma **miniatura de imagem** padronizada nas listas de anexos, maior
  que a atual (~64–80px), para anexos de imagem raster permitidos inline.
- Mostrar a miniatura em **duas telas**: a aba de anexos do card
  (`AttachmentsArea`) e a aba "Todos os anexos" da modal de planejamento do
  projeto (`ProjectPlanningModal`), que hoje não exibe imagem.
- **Carregamento assíncrono por miniatura**: a lista renderiza imediatamente e
  cada miniatura aparece quando termina de carregar, com *skeleton* individual
  (sem travar a tela e sem baixar todas de uma vez).
- **Clique abre lightbox**: na aba do card, como já ocorre; na aba do projeto,
  um novo lightbox navega pelas imagens do projeto.
- Miniatura reutiliza o **arquivo original** pela rota autenticada de download,
  reduzido via CSS — **sem** geração de imagem no servidor nem novo endpoint.
- Apenas imagens raster aprovadas para exibição inline ganham miniatura; SVG e
  demais formatos continuam como ícone de arquivo (sem execução na origem).

## Capabilities

### New Capabilities
<!-- Nenhuma capability nova: o comportamento pertence a capacidades existentes. -->

### Modified Capabilities
- `file-attachments`: a lista de anexos do card passa a exibir miniatura de
  imagem com carregamento assíncrono por item, mantendo o lightbox.
- `project-planning-modal`: a aba "Todos os anexos" do projeto passa a exibir
  miniaturas das imagens, com carregamento assíncrono e lightbox do projeto.

## Impact

- **Frontend**: novo componente de miniatura reutilizável; ajustes em
  `AttachmentsArea` e `ProjectPlanningModal` (`ProjectAttachmentsList`); lightbox
  no escopo do projeto.
- **i18n**: novas chaves de acessibilidade/estado de carregamento (PT-BR, EN, ES).
- **Backend**: nenhum — sem novos endpoints, sem geração de thumbnail, sem
  mudança de schema.
- **Performance/rede**: as miniaturas são o arquivo original; o carregamento
  assíncrono e o `loading="lazy"` limitam o custo em listas grandes.
