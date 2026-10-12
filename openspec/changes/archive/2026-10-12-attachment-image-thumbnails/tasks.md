# Tasks

## 1. Componente de miniatura

- [x] 1.1 Criar `apps/web/src/components/AttachmentThumbnail.tsx` com detecção de imagem inline-safe (constante compartilhada), `<img>` com tamanho fixo, `loading="lazy"`, `decoding="async"`, skeleton durante o carregamento e fallback de ícone em erro ou formato não exibível; validar com teste de componente cobrindo carregamento→imagem, falha de carregamento e formato não inline.
- [x] 1.2 Adicionar as chaves de i18n do estado de carregamento/alt da miniatura em PT-BR, EN e ES; validar com `bun run check:i18n`.

## 2. Aba de anexos do card

- [x] 2.1 Substituir a miniatura inline de `AttachmentsArea` pelo `AttachmentThumbnail` com o tamanho maior, mantendo o clique para o lightbox existente; validar com teste cobrindo miniatura presente para imagem e ícone para formato não exibível.

## 3. Aba "Todos os anexos" do projeto

- [x] 3.1 Usar `AttachmentThumbnail` em `ProjectAttachmentsList` e adicionar um `Lightbox` do projeto navegando pelas imagens listadas; validar com teste cobrindo miniatura, nome/origem e abertura do lightbox no índice correto.

## 4. Documentação

- [x] 4.1 Atualizar a documentação de uso (anexos/planejamento do projeto) descrevendo as miniaturas de imagem nas listas e o clique para ampliar; validar com `bun run check:docs`.

## 5. Verificação de integração

- [x] 5.1 Executar `bun run check` (typecheck + lint + testes + build) e corrigir eventuais falhas.
- [x] 5.2 Executar `bun run test:smoke` e confirmar o fluxo web/API com as listas de anexos.

## Workflow follow-up

- Arquivar a change após a revisão.
