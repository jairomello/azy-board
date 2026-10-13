# Design

## Context

Ver `proposal.md - Why`. Estado atual relevante (inspeção read-only):

- A seção de API Keys vive em `apps/web/src/components/ApiKeysSection.tsx` (dentro de um card em `apps/web/src/pages/AccountPage.tsx`, após Perfil e Aparência; `AccountPage.tsx:172`), com listar/gerar/revogar e um Dialog de cópia do segredo recém-criado (`navigator.clipboard` + feedback `Check`/`Copy`).
- O frontend já possui `apps/web/src/lib/clipboard.ts` (`copyTextToClipboard()`), que nunca lança e cobre Clipboard API + fallback (textarea + `execCommand`) para contexto não seguro; é protegido pelo gate `card-copy-reference-contract.test.ts`.
- O MCP remoto é servido na rota `/mcp` da API (`apps/api/src/routes/mcp.ts`), no mesmo host público da web nos deploys documentados (labapps atrás de NPM; Vultr atrás de Caddy/nginx).
- O frontend já resolve o base path por `window.__BASE_PATH__` (ex.: `/azyboard`), normalizado sem barra final (`apps/web/src/main.tsx`, `apps/web/src/lib/appUrl.ts`).
- i18n por namespaces em `apps/web/src/i18n/locales/{pt-BR,en,es}/settings.json`; o gate `check:i18n` exige paridade de chaves e uso correto no AST.
- O proxy do Vite cobre `/api`, `/uploads` e `/ws`, mas **não** `/mcp`.

## Goals / Non-Goals

**Goals:**
- Deixar claro, na conta, que a API Key conecta o code agent ao MCP, e expor a URL do MCP com cópia confiável e acessível.
- Derivação da URL robusta a publicação na raiz e sob base path, sem nova superfície de backend.
- Textos nos três idiomas e sem expor o valor da chave.

**Non-Goals:**
- Não alterar rotas/contratos da API, o fluxo de chaves ou permissões.
- Não embutir/instalar a skill nem executar comandos no agente: a UI apenas entrega a URL/instrução para o usuário.
- Não detectar se o endpoint MCP está habilitado na instalação (ver Assumptions).

## Decisions

### D1. Derivar a URL do MCP no cliente (sem endpoint novo)
`resolveMcpUrl()` monta `window.location.origin + basePath + '/mcp'`, com `basePath` vindo de `window.__BASE_PATH__` (sem barra final). Alternativa considerada: endpoint público de configuração expondo a URL do MCP — rejeitado nesta mudança por ampliar superfície/escopo de backend para algo derivável no cliente nas instalações documentadas (mesma origem web/API). Centralizar num helper permite, no futuro, trocar a origem sem tocar nos componentes.

Custo reconhecido: este é o oitavo ponto do frontend que lê `window.__BASE_PATH__` (`main.tsx`, `lib/api.ts`, `lib/appUrl.ts`, `useWebSocket`, `LoginPage`, `BrandLogo`, `AzyAgentDrawer`). O helper concentra a regra do MCP; extrair um `getBasePath()` compartilhado para os demais pontos fica fora do escopo desta mudança (refatoração transversal, sem comportamento novo observável).

### D2. Exibir como painel no topo da seção de API Keys
A orientação entra como um painel no início da seção de API Keys (dentro do card existente), mantendo chave e URL no mesmo contexto. Alternativa: card separado na página — rejeitado para não fragmentar a leitura.

### D3. Helper testável e tolerante a ambiente
`resolveMcpUrl()` fica em `apps/web/src/lib/` e retorna a URL; quando `window.location` não existe (testes/SSR), cai para `''`/valor seguro. Facilita teste unitário sem montar a página.

### D4. Copiar com o helper de clipboard já existente, com acessibilidade
Os botões reutilizam `copyTextToClipboard()` (`apps/web/src/lib/clipboard.ts`), que já cobre Clipboard API e fallback (textarea + `execCommand`) e nunca lança; a confirmação visual segue o padrão temporário `Check`/`Copy`, com rótulo acessível e anúncio do resultado. Quando o helper retorna `false`, a orientação mantém o texto visível/selecionável e comunica a falha, sem quebrar a tela. Alternativa: repetir `navigator.clipboard.writeText` dentro do componente — rejeitada por duplicar o fallback já existente e testado.

### D5. Instrução pronta baseada em i18n com interpolação da URL
O texto copiado é uma chave i18n interpolada com a URL (`{{url}}`), sem incluir a chave. Alternativa: texto fixo PT-BR — rejeitado por quebrar o i18n.

### D6. Novas chaves no namespace `settings`, nos três idiomas
Chaves novas (explicação, rótulo da URL, rótulos de cópia, confirmação, instrução) em `settings.json` de pt-BR, en e es. O gate `check:i18n` valida paridade e uso.

### D7. Incluir `/mcp` no proxy do Vite (dev)
Adicionar `'/mcp': { target: apiTarget, changeOrigin: true }` ao `server.proxy`, para a URL exibida funcionar em desenvolvimento (sem isso, `/mcp` cairia no SPA). A instalação usada pelo agente continua externa.

## Assumptions

- Web e API compartilham a mesma origem pública (caso das instalações documentadas: labapps, Vultr). Se a instalação separar as origens, a URL derivada aponta para o host da web.
- O caminho do MCP é `/mcp` na raiz do host (fora de `/api`).
- Se a instalação desabilitou o endpoint (`AZYBOARD_MCP_HTTP_ENABLED=false`), a URL ainda é exibida e o agente recebe 401/404; não há sinal no cliente para ocultá-la — mudança futura fora de escopo.

## Risks / Trade-offs

- **URL incorreta quando as origens divergem** → derivação centralizada em `resolveMcpUrl()`; documentar a suposição e permitir troca futura por config.
- **Multiplicação da leitura de `__BASE_PATH__`** → nova leitura isolada em `resolveMcpUrl()`; refatorar para um `getBasePath()` único fica registrado como dívida fora de escopo.
- **Instalação com MCP desabilitado** exibindo URL inoperante → registrar como limitação conhecida; o erro é acionável no agente (401/404).
- **Clipboard indisponível** (contexto não seguro/permissão) → `copyTextToClipboard()` já degrada para fallback e nunca lança; quando ainda assim retorna `false`, a orientação mantém o texto visível/selecionável e comunica a falha.
- **Divergência de i18n** → `check:i18n` no CV impede merge sem paridade.

## Migration Plan

Sem migração de dados. Deploy normal da imagem web (sem mudança de API/schema). Rollback: reverter o commit; nada persiste estado novo.

## Open Questions

Nenhuma que altere specs, abordagem ou tarefas.
