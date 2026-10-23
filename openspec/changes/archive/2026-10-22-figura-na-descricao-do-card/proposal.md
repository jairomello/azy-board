# Proposal

## Why

A descrição do card é Markdown e **já renderiza imagens** nas visões de leitura (`safeMarkdownRenderer.image`, em `lib/richText.ts`), mas o editor de texto rico não representa nó de imagem. O resultado é uma perda silenciosa de dados, registrada no próprio código como limitação conhecida:

> *"nós que o StarterKit do TipTap não representa (tabelas, imagens) são renderizados nas visões de leitura, mas o editor preserva apenas o texto ao editar conteúdo que os contenha."*

Ou seja: quem escreve `![...](...)` na descrição (por MCP, por exemplo) vê a figura na leitura e a **perde ao editar o card**. E não existe caminho no produto para anexar uma figura ao texto: a figura precisa já estar nos anexos e ser citada à mão, com a URL montada por fora. Na prática, uma explicação que pede figura (ex.: "badge verde para sim, vermelho para não") obriga a descrever a imagem em palavras.

O caminho profissional para esse problema é conhecido e antigo em produtos maduros — **mídia anexada ao item + referência inline apresentada como miniatura, com ampliação no clique** (Jira/Confluence, Notion, Linear, Slack). É o que esta change adota.

## What Changes

- A toolbar do editor de texto rico ganha um **botão de inserir figura**, que abre um seletor com **duas origens**: arquivo do computador (upload) e **anexo que já está no card**.
- A figura é inserida **na posição do cursor**, como **imagem em bloco** (parágrafo próprio, sem texto contornando), citando o anexo pela rota autenticada de conteúdo.
- **Upload imediato na inserção**: a figura passa a existir na aba Anexos no mesmo instante — um único arquivo, uma única verdade, sem depósito paralelo de "imagens do texto".
- **Colar imagem (Ctrl+V)** da área de transferência sobe na hora e insere a miniatura no ponto do cursor.
- **Apresentação constrangida**: miniatura na largura da coluna de texto, altura limitada, proporção preservada, borda sutil e canto arredondado da mesma família do card.
- **Clique na figura abre o lightbox que já existe**, com as imagens do card (setas, contador, ESC) — a mesma experiência da aba Anexos, com o mesmo componente e o mesmo estado de foco por teclado.
- O editor passa a **representar imagens** (extensão de imagem, MIT): editar uma descrição que já contém figura **deixa de apagar a figura**. É a correção da perda de dados descrita no Why, e vem junto com o recurso.
- **Anexo citado e depois excluído**: a exclusão avisa que aquele anexo está citado na descrição e o texto passa a mostrar um estado de "imagem removida" — sem ícone quebrado e sem Markdown cru na tela.
- **Formato não exibível inline** (SVG, PDF e demais) citado no texto **nunca** é renderizado como imagem: aparece como cartão de arquivo, coerente com a regra de visualização segura já existente.
- **Escopo de superfície**: apenas a **descrição do card**. O editor recebe o contexto de anexos por prop opcional; épico, história, checklist, descrição de anexo e escopo do projeto continuam como estão.

**Fora do escopo:** legenda editável abaixo da figura, redimensionar/posicionar/duplicar figura, arrastar-e-soltar arquivo sobre o editor, citar anexo de **outro** card (a API ancora o anexo ao item), e qualquer forma de análise da imagem pela IA.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `story-rich-editor`: requisitos novos do editor — botão de inserir figura com as duas origens, colar imagem da área de transferência, e preservação da figura ao editar (round-trip Markdown ↔ editor).
- `file-attachments`: requisito novo da **figura citada na descrição** — a imagem no texto é o próprio anexo do card, com apresentação constrangida, clique abrindo o lightbox das imagens do card, formato não exibível inline sem render de imagem, e anexo excluído ainda citado gerando aviso na exclusão e estado no texto.

## Impact

- **Código:** `apps/web/src/components/RichTextEditorImpl.tsx` (extensão de imagem, botão, tratamento de colar, apresentação da figura no editor), um novo componente de seleção de figura, `apps/web/src/components/ItemModal.tsx` (passar contexto de anexo e papel), reaproveitamento do upload que hoje vive em `AttachmentsArea.tsx` (extraído para uso comum), `apps/web/src/lib/richText.ts` (garantir ida e volta da imagem) e os três locales de i18n.
- **Dependência nova:** `@tiptap/extension-image` (MIT, mesma família já instalada). Entra no chunk lazy `vendor-editor`, que tem orçamento de 115000 B gzip e uso atual de ~104 KB.
- **Sem mudança de API, banco ou migration:** reusa `POST /projects/:projectId/items/:itemId/attachments` (papel MEMBER), `GET .../attachments` (VIEWER) e `GET .../attachments/:attachmentId/download`, que já serve raster como `inline`.
- **Rascunho da descrição (localStorage):** continua guardando Markdown; como o upload acontece na inserção, não existe arquivo pendente nem rascunho apontando para imagem inexistente.
- **Draft, permissão e anexos desabilitados:** o botão de inserir figura respeita o papel (VIEWER não insere, porque o upload exige MEMBER) e a capacidade de anexos do tenant; a leitura da figura no texto segue a mesma autorização da aba Anexos.
- **Agente:** a figura continua invisível para a IA (`read_attachment` é só texto, sem visão nem OCR). Com imagem de verdade, ao menos a existência e o nome do arquivo ficam legíveis no Markdown, o que hoje não acontece com um marcador opaco.

- `Board ref: 0f950723-b955-4b57-a442-970a72d2abe0` (card **T87** no Azy Board).

Decisões de desenho confirmadas com o usuário estão registradas em `design.md`.
