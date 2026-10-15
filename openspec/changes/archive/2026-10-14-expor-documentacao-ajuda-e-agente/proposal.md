# Proposal

Board ref: 35b480fa-9dc2-47e3-8400-954f472ff2ea (T65 — Azy Agent com acesso à documentação)

## Why

O Azy Board já tem um manual funcional completo em markdown
(`docs/azyboard-wiki/`, 63 páginas em PT-BR, com matriz de cobertura editorial
marcando tudo como "Concluído"), mas esse material não é acessível de dentro do
produto nem ao Azy Agent. Hoje o agente responde perguntas de uso apenas com um
pacote curado de 8 resumos de um parágrafo
(`apps/api/src/services/assistantKnowledge.ts`) que sequer está ligado ao caminho
de execução — então "como faço X?" depende do modelo, não da documentação. E o
usuário não tem menu de ajuda: precisa sair do produto para consultar o manual.
O card T65 pede que a documentação seja acessível ao Azy Agent e por um menu de
ajuda.

## What Changes

- Item **Ajuda** na navegação do `AppShell`, visível a todo usuário autenticado,
  abrindo a central de ajuda em `/help`.
- Central de ajuda: nova rota protegida com **navegação lateral de tópicos**
  derivada da estrutura da wiki (módulos → páginas, título e ordem vindos do
  frontmatter), leitura de página e resolução de wikilinks `[[...]]`, callouts
  `> [!info]` e links relativos para as demais páginas da ajuda.
- Conteúdo servido por **endpoint autenticado da API** a partir de um artefato
  derivado da wiki, gerado por script e verificado por `bun run check:docs`. O
  markdown não é publicado como asset estático, para que o login proteja o
  conteúdo de verdade.
- Escopo do conteúdo exposto: páginas **00–09** (manual funcional). As pastas
  internas `controle/`, `modelos/`, `.obsidian/` e os **blocos técnicos
  `<details>`** de cada guia ficam fora do site e fora do alcance do agente.
- Azy Agent: ferramenta **só do assistente** (mesmo padrão de `UI_TOOL_NAMES`,
  fora do catálogo MCP) para buscar e ler páginas da documentação, permitindo
  responder perguntas de uso com base no manual e **citando a página de origem**.
  Busca lexical, sem banco vetorial e sem chamadas externas.
- O pacote curado atual (`assistantKnowledge.ts`) é **preservado** — ele continua
  sendo a fonte que sustenta a orientação de configuração do MCP exigida hoje —
  e passa a ser **complementado** pelo índice derivado da documentação.
- Sem mudança de CSP (conteúdo de mesma origem), sem novo serviço e sem nova
  dependência de runtime.
- Sem mudanças incompatíveis (**BREAKING**: nenhuma).

## Capabilities

### New Capabilities

- `product-help-center`: central de ajuda autenticada dentro do produto — entrada
  de navegação no shell, índice de tópicos, rota de leitura, escopo de conteúdo
  exposto e contrato do endpoint autenticado que serve as páginas.

### Modified Capabilities

- `azy-agent-knowledge`: o agente passa a fundamentar respostas de uso na
  documentação do produto por consulta de páginas (busca + leitura), citando a
  fonte, além do pacote de resumos curado já existente.
- `documentation-integrity`: novo artefato derivado (índice e conteúdo de ajuda
  gerados da wiki) com regras de exclusão explícitas, verificado por `check:docs`
  junto dos demais artefatos gerados.
- `integrated-app-shell`: posição e visibilidade do item **Ajuda** na navegação
  da sidebar.

## Impact

- **Documentação**: `docs/azyboard-wiki/` é a fonte e não muda; o novo artefato
  gerado entra em `docs/generated/` e o índice em `docs/README.md`.
- **Scripts**: novo gerador do conteúdo de ajuda e atualização de
  `scripts/check-docs.ts` e `scripts/generate-docs.ts`.
- **API**: rota autenticada de ajuda; ferramenta de consulta do assistente e seu
  roteamento de tools; remoção/ajuste do pacote curado atual.
- **Web**: rota `/help`, página da central de ajuda, navegação lateral, render de
  markdown com wikilinks/callouts, item no `AppShell` e strings i18n em
  pt-BR/en/es.
- **Deploy**: embarcar o artefato gerado nas imagens (`Dockerfile` da API para a
  ferramenta do agente; web para a central).
- **Dependências**: nenhuma nova. Sem banco vetorial. Sem alteração de CSP.
