# Tasks

## 1. Imagem no editor (preservar ao editar)

- [x] 1.1 Adicionar `@tiptap/extension-image` ao `RichTextEditorImpl` com imagem em bloco (`inline: false`) e apresentação constrangida no editor (largura da coluna, altura de 160 px, `object-fit: contain`, borda sutil e canto arredondado) — verificado por teste de ida e volta (Markdown → HTML do editor → Markdown) que preserva `![nome](url)` e por `bun run --cwd apps/web typecheck`
- [x] 1.2 Garantir a volta de `<img>` para Markdown de imagem no `htmlToMarkdown` (regra explícita se a do core do turndown não bastar) — verificado pelo mesmo teste de ida e volta, com mais de uma figura entre parágrafos
- [x] 1.3 Garantir que editar outro trecho do texto não remove, reordena nem altera figuras existentes — verificado por teste de componente que carrega descrição com figura, altera o texto e confere o Markdown salvo

## 2. Inserir figura (toolbar, seletor e colagem)

- [x] 2.1 Extrair o upload e a listagem de anexos de `AttachmentsArea.tsx` para um módulo comum, sem mudar comportamento — verificado por `bun test apps/web/src/components/attachments-area-thumbnails.test.tsx` e `bun run --cwd apps/web typecheck`
- [x] 2.2 Criar prop opcional de contexto de anexos no `RichTextEditor` (`projectId`, `itemId`, `canEdit`) e a ação de inserir figura na toolbar, oferecida apenas com contexto e permissão — verificado por teste de componente: com contexto aparece, sem contexto não aparece, e com papel somente leitura não aparece
- [x] 2.3 Implementar o seletor de figura com duas origens (arquivo do computador e anexo de imagem já existente no card), inserindo na posição do cursor e enviando o arquivo no momento da inserção — verificado por teste de componente das duas origens, incluindo falha no envio que não insere nada e não deixa marcação inválida
- [x] 2.4 Tratar colagem de imagem da área de transferência por `editorProps.handlePaste`, subindo o arquivo e inserindo a figura, recusando tipo/tamanho inválidos — verificado por teste de componente que simula `paste` com arquivo de imagem e confirma que o Markdown referencia o anexo, sem `data:` em base64
- [x] 2.5 Fornecer o contexto de anexos e a guarda de papel na `ItemModal`, mantendo os outros cinco usos do editor inalterados — verificado por teste de componente da modal com papel somente leitura e por conferência no board em execução

## 3. Figura citada (lightbox, formatos e anexo removido)

- [x] 3.1 Clique na figura abre o lightbox com as imagens do card, carregando a lista de anexos no primeiro clique e reaproveitando `Lightbox` e `resolveAppUrl` — verificado no board em execução (abre na imagem acionada, navega entre as imagens do card, fecha com ESC) e por teste de componente do caminho sem lista disponível
- [x] 3.2 Formato não exibível inline (SVG, PDF e demais) nunca é renderizado como imagem: vira cartão de arquivo — verificado por teste de componente com anexo SVG citado
- [x] 3.3 Estado de imagem indisponível (anexo excluído, sem autorização ou storage fora) no lugar da imagem, com o nome do arquivo e sem ícone quebrado, mantendo o Markdown da citação intacto — verificado por teste de componente de falha de carregamento
- [x] 3.4 Avisar na exclusão quando o anexo está citado na descrição, detectando o id do anexo no texto que a `ItemModal` já mantém em estado — verificado por teste de componente (anexo citado avisa, anexo não citado não avisa) e por conferência no board em execução

## 4. Verificação integrada

- [x] 4.1 Percorrer o fluxo completo no board em execução, nos temas claro e escuro: inserir do computador, inserir anexo já existente, colar captura, ver a figura entre parágrafos, ampliar no clique e conferir o estado após excluir o anexo citado
- [x] 4.2 Rodar `bun run check`, `bun run check:bundle` (orçamento do `vendor-editor`), `bun run check:i18n`, `bun run check:frontend-tests` e `bun run test:e2e`
- [x] 4.3 Conferir o Markdown persistido depois de inserir, colar e salvar (citação de imagem apontando para o anexo do card, com o nome do arquivo como texto alternativo) e que o editor reabre a descrição exibindo a figura — verificado por requisição ao item no stack descartável e por screenshot do editor com a figura entre parágrafos

## Workflow follow-up

- Esta change ainda não tem card no Azy Board: ao iniciar a implementação, vincular o card correspondente, registrar `Board ref: <itemId>` na proposal e no design, mover o card para `Fazendo` e reivindicá-lo (`claim_task`) se estiver sem responsável.
- Lembrete de processo (card **T86**): o CI roda portas que **não** estão no `bun run check` — `check:frontend-tests`, `check:i18n`, `check:docs`, `test:smoke`, `test:visual`. Rodá-las antes do push evita descobrir o furo só no pipeline.
- Fechar o card com `complete_task` e confirmar no board real que ele está em coluna com `baseStatus = DONE` — encerrar a change não encerra o card; registrar também os tokens de IA consumidos.
- Arquivar a change após sincronizar as deltas para `openspec/specs/story-rich-editor/` e `openspec/specs/file-attachments/` e conferir o resultado em `openspec/changes/archive/`.
