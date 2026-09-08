## Context

O `AppShell` atual usa um fluxo vertical: primeiro renderiza um header de largura total e, abaixo, uma linha flex com sidebar e conteudo. Essa estrutura obriga a sidebar desktop a iniciar depois do header e duplica `BrandLogo`, uma vez no header e outra no topo da navegacao lateral.

O rascunho de referencia propoe outra hierarquia: marca e navegacao formam uma coluna continua desde o topo, enquanto o header contextual pertence a coluna principal. O shell ja suporta sidebar compacta entre `lg` e `1280px`, sidebar completa a partir de `1280px`, drawer abaixo de `lg`, cinco presets claros, modo escuro, `commandBar`, conteudo rolavel e `statusRail`.

## Goals / Non-Goals

**Goals:**
- Construir no desktop uma moldura integrada em duas colunas, com sidebar ocupando toda a altura e header alinhado ao topo da area principal.
- Concentrar a marca no topo da sidebar desktop e evitar sua repeticao no header.
- Melhorar proporcao, espacamento, cantos, bordas e sombras do encontro superior esquerdo sem descaracterizar o Azy Board.
- Preservar os modos compacto, expandido e mobile, bem como temas, acessibilidade e slots opcionais do shell.
- Manter a mudanca centralizada no `AppShell`, sem alterar o contrato das paginas consumidoras.

**Non-Goals:**
- Redesenhar board, cards, command bar, dashboard ou paginas de configuracao.
- Trocar logo, tipografia global, paleta de produto ou presets de tema.
- Alterar rotas, permissoes, dados ou comportamento do Azy Agent.
- Tornar a largura da sidebar redimensionavel ou persistir uma preferencia de largura.

## Decisions

### 1. Composicao desktop por CSS Grid

**Decisao**: substituir o fluxo `header` seguido de `flex` por uma grade desktop com duas colunas e duas linhas. A sidebar ocupa as duas linhas; o header ocupa a primeira linha da coluna principal; workspace, command bar, conteudo e status rail ocupam a segunda.

As larguras existentes serao preservadas: `68px` entre `lg` e `1279px`, e `220px` a partir de `1280px`. A segunda coluna usa `minmax(0, 1fr)` e a linha de trabalho usa `minmax(0, 1fr)` para impedir overflow e manter o scroll atual.

**Alternativa considerada**: posicionar sidebar e header com `position: fixed`/`absolute`. Rejeitada porque aumenta acoplamento a offsets, dificulta slots opcionais e torna a responsividade mais fragil.

### 2. Silhueta superior integrada

**Decisao**: sidebar e header compartilham alinhamento, altura visual da faixa superior e um encontro interno controlado. Cantos externos permanecem arredondados; a emenda entre os dois blocos evita dois raios concorrentes e espaco que os faca parecer cards independentes. Borda e sombra devem formar uma unica leitura de shell, ainda permitindo que sidebar e header usem seus tokens proprios.

**Alternativa considerada**: manter um gutter completo entre sidebar e header. Rejeitada porque preservaria justamente a fragmentacao que o rascunho pretende corrigir.

### 3. Marca unica por contexto responsivo

**Decisao**: no desktop (`lg+`), a marca aparece somente no topo da sidebar. No mobile, como a sidebar vira drawer fechado, o header continua exibindo marca e botao de menu. No modo desktop compacto, a marca mostra apenas o simbolo centralizado; no modo expandido, mostra simbolo e wordmark.

**Racional**: evita duplicacao sem retirar orientacao de marca quando a navegacao lateral nao esta visivel.

### 4. Sidebar dividida em marca e navegacao

**Decisao**: separar semanticamente a faixa de marca do corpo rolavel/flexivel da sidebar. A faixa superior alinha-se ao header; abaixo ficam titulo Workspace, navegacao e rodape contextual. O mesmo conteudo de navegacao continua reutilizado pelo drawer mobile, com adaptacao visual propria.

### 5. Contrato do AppShell preservado

**Decisao**: manter inalteradas as props publicas de `AppShell`. `headerMeta`, `commandBar`, `statusRail`, `contentClassName` e `assistantSelectedItem` continuam nos mesmos papeis. A mudanca e exclusivamente de composicao interna.

### 6. Testabilidade estrutural

**Decisao**: identificar as regioes principais com semantica e/ou atributos estaveis (`data-shell-sidebar`, `data-shell-header`, `data-shell-workspace`) e adicionar teste de contrato baseado no fonte, seguindo o padrao atual da aplicacao.

**Racional**: o repositorio usa contratos estaticos para UI e nao possui infraestrutura de screenshot visual. Os atributos tambem facilitam testes visuais futuros sem acoplar o teste a classes Tailwind completas.

## Risks / Trade-offs

- **[Quebra de altura ou scroll em paginas com command bar/status rail]** -> Preservar `min-h-0`, `min-w-0`, `flex-1` e testar paginas com e sem os slots opcionais.
- **[Header apertado no breakpoint compacto]** -> Manter sidebar em `68px`, ocultar wordmark no compacto e permitir truncamento do contexto no header.
- **[Perda da marca no mobile]** -> Renderizar a marca no header apenas abaixo de `lg`; manter a copia do drawer para quando ele estiver aberto.
- **[Contraste inconsistente entre presets]** -> Reutilizar exclusivamente tokens `shell-*` e validar os cinco presets claros e o modo escuro.
- **[Cantos ou sombras criarem uma emenda artificial]** -> Tratar raio e sombra como uma unica silhueta no desktop e manter superficies independentes somente no mobile.
- **[Regressao de navegacao por teclado]** -> Preservar elementos semanticos, foco visivel, labels e ordem de tabulacao; a mudanca nao reposiciona controles via CSS visualmente fora da ordem do DOM.

## Migration Plan

1. Criar o teste de contrato para registrar a nova estrutura esperada.
2. Reorganizar o DOM do `AppShell` mantendo props e conteudos existentes.
3. Refinar classes responsivas, raios, bordas e sombras usando tokens atuais.
4. Validar desktop expandido, desktop compacto e mobile nos temas claro e escuro.
5. Executar typecheck, lint, testes e build.

Rollback: reverter a composicao interna do `AppShell`; nao ha migracao de dados, API ou estado persistido.

## Open Questions

Nenhuma questao bloqueante. A implementacao pode ajustar medidas finas em torno das larguras existentes (`68px` e `220px`) desde que preserve os comportamentos responsivos e a direcao visual aprovada.
