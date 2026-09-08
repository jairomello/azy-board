## Why

O shell atual separa header e sidebar em dois blocos empilhados: o header ocupa toda a largura, repete a marca AzyBoard e força a navegacao lateral a comecar abaixo dele. O rascunho conceitual mostra uma hierarquia mais clara e coesa, na qual a sidebar ocupa toda a altura do desktop, concentra a marca no canto superior esquerdo e o header contextual comeca ao lado dela.

## What Changes

- Reorganizar o `AppShell` desktop em duas colunas: sidebar de altura integral a esquerda e area principal a direita.
- Mover a identidade AzyBoard principal para o topo da sidebar e remover sua duplicacao no header desktop.
- Fazer o header contextual iniciar alinhado a coluna de conteudo, preservando breadcrumb, titulo, metadados, idiomas, tema e perfil.
- Refinar a uniao visual entre topo da sidebar e header com proporcoes, cantos, espacamento, bordas e sombras coerentes com o design atual, usando o rascunho como direcao e nao como copia literal.
- Preservar a sidebar compacta nos breakpoints intermediarios e o drawer/header mobile existentes, incluindo acesso a marca e botao de menu.
- Preservar os cinco presets do shell claro, o modo escuro, contraste acessivel e as areas opcionais `commandBar` e `statusRail`.
- Adicionar testes de contrato para a nova composicao do shell e seus comportamentos responsivos.

## Capabilities

### New Capabilities
- `integrated-app-shell`: Composicao responsiva que integra sidebar, marca e header contextual sem duplicacao visual no desktop.

### Modified Capabilities

Nenhuma capacidade existente tem seus requisitos alterados; os requisitos de tema e navegacao continuam validos e serao preservados pela nova composicao.

## Impact

- **Frontend**: `apps/web/src/components/AppShell.tsx` sera reorganizado estruturalmente.
- **Marca**: `BrandLogo` sera reutilizado em contextos desktop, compacto e mobile, sem trocar o ativo atual.
- **Estilos**: classes Tailwind do shell e, somente se necessario, tokens em `apps/web/src/styles/globals.css` serao ajustados sem criar nova dependencia.
- **Responsividade**: breakpoints `lg` e `1280px`, overlay mobile e alturas das areas de conteudo serao revisados.
- **Temas**: todos os presets claros e o modo escuro deverao manter contraste e continuidade visual.
- **Testes**: contratos estruturais do `AppShell` e verificacao de typecheck, lint, testes e build.
