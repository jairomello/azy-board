## 1. Contrato do shell

- [x] 1.1 Criar teste de contrato para as regioes `data-shell-sidebar`, `data-shell-header` e `data-shell-workspace` e para a grade desktop integrada
- [x] 1.2 Cobrir no contrato a marca exclusiva na sidebar desktop e a marca preservada no header mobile
- [x] 1.3 Cobrir no contrato as larguras responsivas de sidebar compacta (`68px`) e expandida (`220px`)

## 2. Estrutura responsiva do AppShell

- [x] 2.1 Reorganizar o container raiz de `AppShell.tsx` em grade desktop de duas colunas e duas linhas, mantendo o fluxo mobile
- [x] 2.2 Posicionar a sidebar desktop na primeira coluna ocupando header e workspace, com altura integral e sem alterar os links ou permissoes
- [x] 2.3 Posicionar o header contextual na primeira linha da coluna principal e remover dele a marca apenas em desktop
- [x] 2.4 Manter no header mobile o botao de menu, a marca, o contexto da pagina e os controles globais
- [x] 2.5 Manter `commandBar`, conteudo e `statusRail` na segunda linha da coluna principal com `min-h-0`, `min-w-0` e scroll correto

## 3. Refinamento visual e acessibilidade

- [x] 3.1 Alinhar a faixa de marca da sidebar com a altura e o ritmo visual do header
- [x] 3.2 Refinar emenda, raios, bordas, espacamentos e sombras para formar uma silhueta superior integrada no desktop
- [x] 3.3 Preservar simbolo centralizado na sidebar compacta e simbolo com wordmark na sidebar expandida
- [x] 3.4 Preservar drawer, overlay, fechamento por navegacao e offsets corretos abaixo de `lg`
- [x] 3.5 Validar contraste e estados de foco usando tokens `shell-*` nos cinco presets claros e no modo escuro

## 4. Verificacao

- [x] 4.1 Executar os testes de contrato do frontend e corrigir regressoes do `AppShell`
- [x] 4.2 Validar visualmente os breakpoints mobile, desktop compacto e desktop expandido, com e sem `commandBar`/`statusRail`
- [x] 4.3 Executar `bun run typecheck`, `bun run lint`, `bun test` e `bun run build`
