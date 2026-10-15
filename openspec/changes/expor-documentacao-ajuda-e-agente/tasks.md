# Tasks

Board ref: 35b480fa-9dc2-47e3-8400-954f472ff2ea (T65 — Azy Agent com acesso à documentação)

## 1. Conteúdo da ajuda no servidor

- [x] 1.1 Definir o escopo da ajuda em um único ponto (módulos 00–09 incluídos; exclusão de `controle/`, `modelos/`, `.obsidian/` e dos blocos `<details>`) e registrar no índice de documentação (`docs/README.md`) o papel da wiki como fonte da central de ajuda e do Azy Agent; verificar que o índice cita a wiki nesse papel e que o escopo está declarado em um único lugar
- [x] 1.2 Implementar `apps/api/src/services/helpContent.ts`: resolver o diretório (`AZYBOARD_HELP_DIR` + candidatos relativos ao cwd, no padrão de `resolveSkillDir`), ler os `.md` do escopo, extrair frontmatter (`title`, `type`, `order`), remover blocos `<details>…</details>`, derivar slug estável (`04 - Board e Visualizacoes/Conhecer o Board.md` → `04/conhecer-o-board`, `Home.md` → `home`), montar o índice de módulos → páginas, calcular `sha256` por página e resolver wikilinks para slugs internos; verificar com `bun test apps/api/src/services/helpContent.test.ts`
- [x] 1.3 Cobrir o escopo com teste automatizado: falha se documento de `controle/` ou `modelos/`, arquivo de `.obsidian/` ou seção técnica recolhível passar a integrar o conteúdo servido; verificar executando o teste
- [x] 1.4 Implementar a busca lexical por página usada pelo agente sobre o índice, reutilizando a normalização de termos de `assistantKnowledge.retrieveKnowledge` (sem embeddings e sem chamada externa); verificar com teste de ranqueamento, de limite de resultados e de consulta sem correspondência
- [x] 1.5 Tratar indisponibilidade da documentação: quando o diretório não existe ou está vazio, a leitura devolve um resultado explícito de indisponibilidade em vez de lançar; verificar com teste

## 2. Endpoint autenticado da ajuda

- [x] 2.1 Implementar `apps/api/src/routes/help.ts` com `authMiddleware` (padrão de `routes/skills.ts`), `GET /api/help/index` e `GET /api/help/pages/:slug`, respostas com `Cache-Control: private, no-store` e erros pelo envelope único (`HELP_UNAVAILABLE` 500, `HELP_PAGE_NOT_FOUND` 404); montar o router em `/api` no `apps/api/src/index.ts`; verificar com teste de rota
- [x] 2.2 Verificar que sem sessão válida a resposta é de não autorizado e nenhum conteúdo de página é retornado, e que um slug fora do escopo responde 404 sem revelar conteúdo interno; verificar com teste
- [x] 2.3 Verificar que a página retornada traz origem (`path`), `sha256` e o índice vem ordenado por módulo e página conforme o frontmatter; verificar com teste
- [x] 2.4 Confirmar que nenhum schema de validação novo foi introduzido (o `docs/generated/openapi.json` não muda) rodando `bun run check:docs`

## 3. Ferramentas de documentação do Azy Agent

- [x] 3.1 Implementar `apps/api/src/services/assistantDocs.ts` com `DOC_TOOL_NAMES`, `getDocToolModels()` (modelos `strict` para `search_docs` e `read_doc`) e `isDocTool()`, além da resolução server-side que usa o índice da ajuda; verificar com teste unitário
- [x] 3.2 Anexar `getDocToolModels()` em `toolsForModel` no harness e interceptar os nomes antes de `executeTool` (mesmo ponto de `isVisibilityTool`), com `riskLevel: 'READ'`, sem aprovação e via novo callback `HarnessOptions.readDocs`; verificar com teste do harness
- [x] 3.3 Conectar o callback `readDocs` em `apps/api/src/routes/assistant.ts` e acrescentar ao prompt do sistema a instrução de consultar a documentação para perguntas de uso, citando a página de origem e admitindo ausência de correspondência; verificar com teste de que uma pergunta de uso resulta em consulta à documentação e citação da fonte
- [x] 3.4 Verificar que as ferramentas de documentação não entram no catálogo MCP nem exigem política de papel: `bun run test:mcp-catalog` verde e teste do harness confirmando que `search_docs`/`read_doc` não passam por `executeTool`
- [x] 3.5 Verificar que o escopo acessível ao agente é o mesmo da ajuda (sem documentos internos nem seções técnicas) e que o pacote curado de configuração do MCP continua respondendo; verificar com teste

## 4. Renderização da ajuda no web

- [x] 4.1 Extrair as opções de sanitização de `apps/web/src/lib/richText.ts` para um export compartilhado e reusá-las na instância padrão; verificar que `bun test apps/web/src/richText.test.ts` e os testes de contrato de rich text continuam passando
- [x] 4.2 Implementar `apps/web/src/lib/helpMarkdown.ts` com instância própria do `marked` (sem alterar o singleton global), convertendo `[[alvo|rótulo]]` em rota interna `/help/<slug>`, callouts `[!info|tip|warning|danger]` em destaque por tipo e mantendo `mermaid` como bloco de código, com HTML cru escapado; verificar com teste unitário cobrindo wikilink, alvo fora do escopo, callout e tentativa de HTML/`javascript:`
- [x] 4.3 Adicionar os métodos de ajuda em `apps/web/src/lib/api.ts` (índice e página) usando o cliente HTTP existente; verificar com teste de contrato e com o guarda de `fetch` direto verde

## 5. Central de ajuda na interface

- [x] 5.1 Implementar `apps/web/src/pages/HelpPage.tsx` com painel lateral de tópicos, painel de conteúdo, estados de carregamento e de erro recuperável e intercepção de links internos para o react-router; registrar as rotas `/help` e `/help/:slug` em `apps/web/src/App.tsx`; verificar com teste de componente
- [x] 5.2 Adicionar o item `Ajuda` na sidebar do `AppShell` entre `Conta` e `Admin`, visível a todo usuário autenticado; verificar com teste de contrato da sidebar (ordem, visibilidade por grupo e `Admin` como último item)
- [x] 5.3 Adicionar as strings da ajuda (rótulo, título, estados e ação de tentar novamente) nos locales `pt-BR`, `en` e `es`; verificar com `bun run check:i18n`

## 6. Deploy e verificação integrada

- [x] 6.1 Embarcar `docs/azyboard-wiki` na imagem da API e definir `AZYBOARD_HELP_DIR` no `Dockerfile`; verificar com teste unitário de resolução de diretório apontando para o destino da imagem e com `bun run check:deploy-versions`
- [x] 6.2 Documentar em `DEPLOY.md` o diretório embarcado e a variável, e garantir que a documentação de deploy segue íntegra rodando `bun run check:docs`
- [ ] 6.3 Verificação integrada: `bun run check` e `bun run test:smoke` verdes; com sessão autenticada, confirmar na interface a navegação por tópicos, a leitura de uma página e o item `Ajuda`, e no chat confirmar uma resposta de uso com citação da página de origem

## Workflow follow-up

- Implementar a change com `/opsx-apply`.
- Encerrar o card T65 no Azy Board com `complete_task` e confirmar `status: DONE` no board real (encerrar a change não encerra o card).
- Arquivar a change após a revisão do projeto.
