## 1. Contrato e componente

- [x] 1.1 Mapear filtros simples, múltiplos e valores de catálogo exibidos pelo Board.
- [x] 1.2 Criar normalizador tipado de filtros ativos com fallback para catálogos ainda não carregados.
- [x] 1.3 Criar componente `ActiveFilterChips` responsivo, compacto e acessível.

## 2. Integração

- [x] 2.1 Inserir a linha entre a barra de controles e o conteúdo do Board sem alterar o layout quando vazia.
- [x] 2.2 Conectar remoção individual ao estado existente sem limpar filtros irmãos ou opções visuais.
- [x] 2.3 Garantir que a remoção seja persistida por projeto e restaurada corretamente ao retornar.
- [x] 2.4 Adicionar traduções PT-BR, EN e ES para rótulos, valores e ações de remoção.

## 3. Qualidade

- [x] 3.1 Testar estado sem filtros, um filtro, múltiplos filtros, arrays e catálogo ausente.
- [x] 3.2 Testar remoção do primeiro, intermediário e último chip, troca de projeto e persistência.
- [x] 3.3 Testar teclado, foco, ARIA, responsividade e contraste.
- [x] 3.4 Executar typecheck, lint, testes e build frontend.

## 4. Documentação

- [x] 4.1 Documentar a linha de filtros ativos e a remoção individual no guia do Board.
