## 1. Preparação E Contratos

- [x] 1.1 Confirmar os dois pontos de composição (`ItemModal` e `ItemDetailModalShell`) e os valores de altura atuais (`max-h-[95vh]`).
- [x] 1.2 Definir a classe utilitária de altura fixa com fallback de viewport dinâmica e o local de aplicação.
- [x] 1.3 Atualizar os testes de contrato para exigir altura fixa e rolagem restrita ao conteúdo nos dois componentes.

## 2. Implementação Da Altura Fixa

- [x] 2.1 Adicionar a classe de altura fixa em `apps/web/src/styles/globals.css`.
- [x] 2.2 Aplicar a classe ao `section` de `ItemModal`, removendo o teto variável.
- [x] 2.3 Aplicar a classe ao `section` de `ItemDetailModalShell`, removendo o teto variável.
- [x] 2.4 Revisar alturas internas (ex.: `min-h-[360px]` da área de atividade) para garantir rolagem sem expandir a modal.

## 3. Verificação

- [x] 3.1 Validar abertura, troca de áreas e modais filhas com altura estável.
- [x] 3.2 Validar que cabeçalho, abas e rodapé permanecem fixos e que somente o conteúdo rola.
- [x] 3.3 Validar viewport móvel (viewport dinâmica, teclado) sem rolagem horizontal.
- [x] 3.4 Executar `bun run check` e `bun run test:smoke`, corrigindo regressões antes de concluir.
