# Design

Board ref: 35b480fa-9dc2-47e3-8400-954f472ff2ea (T65 — Azy Agent com acesso à documentação)

## Context

Ver `proposal.md` para motivação. Estado atual e restrições que moldam a solução:

- A wiki vive em `docs/azyboard-wiki/` (63 páginas no escopo 00–09, ~253 KB) com
  frontmatter (`title`, `type: home|module|guide|map|internal`, `order`), 357
  wikilinks `[[alvo|rótulo]]`, 19 callouts (`info`, `tip`, `warning`, `danger`),
  51 blocos `<details>` com a seção técnica e 3 blocos `mermaid`.
- `docs/README.md` já define o papel de cada fonte e lista os artefatos gerados;
  `bun run generate:docs` / `bun run check:docs` mantêm os contratos voláteis
  (`apps/mcp/README.md`, `docs/generated/openapi.json`,
  `docs/generated/assistant-limits.md`).
- Existe precedente direto para servir conteúdo versionado de forma autenticada:
  `apps/api/src/services/skillArchive.ts` resolve um diretório embarcado
  (`AZYBOARD_SKILL_DIR` + candidatos relativos ao cwd) e
  `apps/api/src/routes/skills.ts` entrega com `authMiddleware` e
  `Cache-Control: private, no-store`. O `Dockerfile` da API já embarca
  `skills/azyboard` na imagem.
- O web já tem `marked` com sanitização em `apps/web/src/lib/richText.ts`, mas a
  configuração é aplicada no singleton global do `marked`.
- Ferramentas só-do-assistente têm padrão estabelecido em
  `apps/api/src/services/assistantUiTools.ts`: fora de `SHARED_TOOL_NAMES`
  (portanto fora do catálogo MCP), sempre anexadas por `toolsForModel` e
  interceptadas no harness antes de `executeTool`.
- `apps/api/src/services/assistantKnowledge.ts` é um pacote curado, lexical e
  hoje não ligado ao runtime; sustenta o requisito vigente de orientação de
  configuração do MCP.
- Restrições: CSP `default-src 'self'` (sem mudança necessária), orçamento de
  bundle (`web-bundle-budget`), cliente HTTP único (`web-api-client`), i18n com
  paridade pt-BR/en/es, licenças MIT/Apache/BSD/ISC/Public Domain.

## Goals / Non-Goals

**Goals:**

- Uma única fonte de conteúdo (a wiki versionada) alimentando **a central de
  ajuda e o Azy Agent**, sem cópia paralela.
- Conteúdo acessível apenas com sessão autenticada, sem expor material interno.
- Zero dependência nova de runtime, zero banco vetorial, zero chamada externa.
- Manter intactos os contratos existentes: CSP, orçamento de bundle, cliente HTTP
  do web, paridade de i18n e o catálogo MCP.

**Non-Goals:**

- Traduzir a wiki para EN/ES (o conteúdo permanece PT-BR; só o chrome da UI é
  internacionalizado).
- Busca em texto completo na interface da ajuda (a navegação é pelo índice de
  tópicos; a busca existe apenas como ferramenta do agente).
- Renderizar diagramas `mermaid` (3 páginas exibem o bloco como código).
- Publicar a documentação fora do login ou em domínio separado.
- Alterar a spec do MCP/catálogo de ferramentas com as tools de documentação.
- Usar a página aberta na ajuda como contexto do agente (contexto de tela).

## Decisions

### D1. Conteúdo servido da wiki embarcada, lida em runtime — não artefato gerado, não asset público

`apps/api/src/services/helpContent.ts` resolve o diretório da documentação
(`AZYBOARD_HELP_DIR` ou candidatos relativos ao cwd, no mesmo espírito de
`resolveSkillDir`), lê os `.md` do escopo, transforma e mantém o índice em
memória (leitura única, sem IO por requisição). O `Dockerfile` da API passa a
embarcar `docs/azyboard-wiki` em `/app/help`.

Alternativas consideradas:

- **Artefato gerado (JSON/TS) importado pela API** — duplicaria ~250 KB de
  documentação escrita à mão e criaria a obrigação de regenerar a cada edição da
  wiki. Diferente de OpenAPI e do catálogo MCP, a wiki **não é derivada do
  runtime**; gerar um artefato a partir dela não traz o mesmo benefício e ainda
  arrisca inferência de tipo gigante no `tsc` ou falha na build isolada do
  `check-api-boundary` (que copia apenas `apps/api/src`).
- **Copiar o markdown para `apps/web/public`** — viraria asset estático público,
  furando o requisito de acesso autenticado.

### D2. Endpoint autenticado na API, privado e sem cache público

Novo `apps/api/src/routes/help.ts` montado em `/api/help`, com `authMiddleware`
(mesmo padrão de `routes/skills.ts`):

- `GET /api/help/index` — módulos e páginas (slug, título, ordem, origem).
- `GET /api/help/pages/:slug` — conteúdo da página com origem, `sha256` e versão.
- Respostas com `Cache-Control: private, no-store`.
- Erros pelo envelope único: `HELP_UNAVAILABLE` (500) quando a documentação não
  está na instalação e `HELP_PAGE_NOT_FOUND` (404) para slug fora do escopo, sem
  revelar conteúdo interno.

Não há escopo por tenant: documentação de produto é igual para todos; a exigência
é apenas sessão autenticada.

### D3. Transformação e escopo em um único serviço

Responsabilidades de `helpContent.ts`:

- **Escopo**: incluir os módulos 00–09; excluir `controle/`, `modelos/` e
  `.obsidian/`.
- **Seções técnicas**: remover blocos `<details>…</details>` de cada página.
- **Índice**: derivar módulos → páginas de `type`/`order` do frontmatter e da
  estrutura de diretórios.
- **Slug**: derivado do caminho, estável e legível, em um único segmento de URL
  (sem `/`), para que a rota da API e a do web sejam parâmetros simples —
  `04 - Board e Visualizacoes/Conhecer o Board.md` → `04-conhecer-o-board`;
  a página de módulo `04 - …/Board e Visualizacoes.md` → `04-board-e-visualizacoes`;
  `Home.md` → `home`.
- **Wikilinks**: resolver para o slug interno; alvo fora do escopo vira texto
  simples (não há página para abrir).
- **Proveniência**: `sha256` por página e versão do conjunto.
- **Busca do agente**: granularidade por página (a documentação é pequena),
  reutilizando a normalização lexical de termos já usada em
  `assistantKnowledge.retrieveKnowledge` — sem embeddings. Essa normalização vive
  em `services/termNormalization.ts`, um módulo neutro: importar
  `assistantKnowledge.ts` a partir de um serviço de runtime puxaria para o bundle
  da API os caminhos citados no texto curado e quebraria `check:api-boundary`.

### D4. Ferramentas de documentação como ferramentas só-do-assistente

Novo `apps/api/src/services/assistantDocs.ts` com `DOC_TOOL_NAMES`,
`getDocToolModels()` e `isDocTool()`:

- `search_docs(query)` → páginas ranqueadas com título, slug e trecho.
- `read_doc(slug)` → conteúdo completo da página no escopo exposto.

Integração:

- `toolsForModel` (harness) passa a anexar `getDocToolModels()` junto de
  `getUiToolModels()` — sempre disponíveis, fora da allowlist e fora do catálogo
  MCP, sem exigir política de papel.
- O harness intercepta os nomes antes de `executeTool` (mesmo ponto de
  `isVisibilityTool`) e resolve no servidor por um novo callback
  `HarnessOptions.readDocs`, registrando `riskLevel: 'READ'`, sem aprovação.
- Prompt do sistema ganha uma instrução curta: para perguntas de uso, consultar a
  documentação e citar a página de origem; sem correspondência, dizer que não
  encontrou em vez de inventar.
- O pacote curado atual (`assistantKnowledge.ts`) **permanece**: ele sustenta o
  requisito vigente de orientação de configuração do MCP, cujo roteiro inclui
  variáveis de ambiente que ficam no bloco técnico (fora do escopo exposto).

### D5. Renderização no web com instância dedicada do `marked`

- `marked.use` é global; para não alterar a renderização das descrições de cards,
  a ajuda usa uma instância própria (`new Marked(...)`).
- As regras de sanitização do `richText.ts` (escapar HTML cru, filtrar protocolos
  de link/imagem) são extraídas para um export compartilhado
  (`safeMarkdownOptions`) e reusadas nas duas instâncias — uma única fonte da
  regra de segurança.
- Pré-processamento da sintaxe da wiki antes do `marked`: os wikilinks já chegam
  resolvidos em `/help/<slug>` pelo servidor (D3), então a instância da ajuda
  trata o que resta do cofre — callouts `> [!info|tip|warning|danger]` viram
  destaque com classe por tipo, blocos `mermaid` permanecem como código e
  qualquer wikilink remanescente é neutralizado como texto simples.
- Links internos são interceptados no contêiner da ajuda e roteados pelo
  react-router, preservando `href` real (abrir em nova aba continua funcionando).

### D6. Rota `/help` dentro do `AppShell`, com painel de tópicos secundário

- Rota protegida `/help` e `/help/:slug` renderizadas dentro do `AppShell`,
  mantendo navegação, tema, idioma e perfil; o índice de tópicos é um painel
  lateral na área de conteúdo.
- Item `Ajuda` na sidebar entre `Conta` e `Admin` (spec `integrated-app-shell`),
  com rótulo internacionalizado.
- Cada página é buscada sob demanda; nenhuma biblioteca nova entra no bundle,
  preservando o orçamento de bundle.
- Todo HTTP passa por `apps/web/src/lib/api.ts` (contrato `web-api-client`).
- **Base path**: em deploy path-based (ex.: `/azyboard/`) o `BrowserRouter` usa
  `basename`, então a navegação interna já resolve sozinha — mas o `href` real
  dos links da ajuda precisa do prefixo, senão abrir em nova aba ou copiar o
  endereço aponta para a raiz do domínio. O prefixo vem de `appBasePath()`
  (`lib/appUrl.ts`, fonte única do `window.__BASE_PATH__`) e é validado antes de
  entrar no HTML renderizado.

### D7. i18n apenas do chrome da ajuda

Entram nos namespaces (`pt-BR`, `en`, `es`) somente as strings de produto: rótulo
do item, título da página, estados de carregamento/erro e ação de tentar
novamente. O conteúdo da wiki é PT-BR e é tratado como conteúdo, coerente com o
cenário "Conteúdo de usuário não é traduzido" da spec `i18n`.

## Risks / Trade-offs

- **[A wiki passa a ser lida pelo usuário final e pode vazar material de
  bastidores]** → o escopo fica definido em um único ponto e há verificação
  automatizada que falha se `controle/`, `modelos/`, `.obsidian/` ou blocos
  `<details>` entrarem no conteúdo servido (spec `documentation-integrity`).
- **[Wikilinks quebrados na ajuda]** → 51 dos 357 wikilinks apontam para páginas
  fora do escopo; viram texto simples. A verificação de links internos do
  `check:docs` continua valendo sobre o markdown original.
- **[Mermaid sem renderização]** → 3 páginas mostram o diagrama como bloco de
  código. Adicionar mermaid é dependência pesada e afetaria o orçamento de
  bundle; fica como evolução futura.
- **[Imagem da API cresce]** → ~260 KB de markdown embarcado, estático e
  versionado; sem IO por requisição (índice em memória após a primeira leitura).
- **[Ferramenta de docs consome passos do harness]** → busca limitada a poucos
  resultados e leitura de uma página por vez, dentro dos limites de passos e
  tool calls já aplicados.
- **[Resposta do agente desatualizada em relação à wiki]** → ajuda e agente usam
  o mesmo índice; se a documentação não estiver na instalação, o agente informa
  indisponibilidade em vez de inventar.
- **[CSP]** → sem mudança: todo o conteúdo é de mesma origem.

## Migration Plan

- **Deploy**: o `Dockerfile` da API passa a copiar `docs/azyboard-wiki` para
  `/app/help` e a definir `AZYBOARD_HELP_DIR`. Sem migration de banco, sem
  mudança de schema e sem novo serviço.
- **Dev**: sem passo extra — os candidatos relativos ao cwd encontram
  `docs/azyboard-wiki` no repositório.
- **Rollback**: reverter a imagem. Nenhum dado persistido é afetado; as rotas
  novas desaparecem com a imagem anterior e nenhuma tela existente muda de
  contrato.
