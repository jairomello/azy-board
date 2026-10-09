# Tasks

## 1. Paleta temática e área de trabalho

- [x] 1.1 Definir tokens semânticos do Board para canvas, coluna, superfície/borda/brilho de card, sombras e estados em claro e escuro; conferir que os tokens `--shell-*` dos cinco presets claros continuam restritos ao shell.
- [x] 1.2 Alinhar barra de comandos, filtros ativos e contexto/progresso à composição do protótipo; conferir visualmente controles, filtros ausentes/ativos e progresso nos dois temas.
- [x] 1.3 Alinhar canvas e cabeçalhos de coluna, preservando 292 px por coluna, rolagem horizontal e estados de coluna vazia/destino de arraste; conferir em viewport largo e estreito.

## 2. Cards reais

- [x] 2.1 Aplicar ao elemento raiz do card os tokens, gradientes, bordas, cantos, sombra e estados do protótipo, incluindo classes semânticas para regiões quando necessário; conferir o resultado em uma coluna densa nos dois temas.
- [x] 2.2 Ajustar topo, alça, ícone, código, breadcrumb, título, tags/tipo, checklist e rodapé conforme as specs, conservando campos condicionais e hierarquia; conferir cards completos e com metadados ausentes.
- [x] 2.3 Integrar visualmente hover, foco, destaque, card não arrastável, ações rápidas e overlay de arraste; conferir que ações não iniciam drag nem abrem detalhes e que o foco é visível.

## 3. Densidade e compatibilidade

- [x] 3.1 Adaptar os estilos confortável e compacto aos novos tokens; conferir breadcrumb/título em cada modo, tooltip, checklist e metadados sem colisões.
- [x] 3.2 Conferir paridade visual nos modos SIMPLE e HIERARCHICAL, além da visualização em árvore; preservar comandos e filtros ao alternar visualizações.
- [x] 3.3 Conferir a área do Board em claro, escuro e nos presets claros do shell, em viewport desktop e estreito, com conteúdo cheio e vazio; registrar diferenças visuais restantes em relação ao protótipo.

## Workflow follow-up

- Executar `bun run check` e `bun run test:smoke` ao concluir a implementação, conforme as instruções do repositório.
