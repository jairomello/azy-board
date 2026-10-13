# /azyboard-setup-mcp

O usuário quer configurar o servidor MCP do Azy Board no cliente de code agent em uso (OpenCode, Claude Code ou Codex), em Windows, Linux ou macOS. Siga o roteiro em `references/mcp-setup.md` e conduza a configuração passo a passo:

1. Descubra o **sistema operacional** e o **cliente**. Pergunte o **modo**: **stdio** (local, com Bun e o repositório) ou **remoto** (URL do MCP, sem processo local).
2. **Remoto**: peça apenas a URL do MCP (ex.: `https://<instalação>/mcp`). Se o usuário já tem a URL e uma API Key, ofereça a **conexão assistida por script** (`references/mcp-setup.md` → "Conexão assistida pelo agente"): entregue o comando do conector cross-platform para o **terminal do usuário** — `node <caminho>/connect-mcp.mjs --client <cliente> --url <url>` (Windows/PowerShell, Linux ou macOS). O script pergunta a API Key no terminal, valida o handshake e grava a configuração do cliente (JSON para OpenCode/Claude; TOML para Codex). Nunca peça a chave no chat.
3. **stdio**: confirme Bun instalado e o caminho do repositório (ou `apps/mcp/dist/index.js`); monte a configuração com `EASYBOARD_API_KEY`, `EASYBOARD_URL` e, quando o repositório for de um único projeto, `AZYBOARD_PROJECT_ID`.
4. Oriente a gerar a API Key em **Minha conta → Gerenciar API Keys**, uma por cliente/ambiente, copiada uma única vez. Em texto use placeholders (`azb_sua_chave_aqui`); a chave real vai em variável de ambiente, cofre do cliente ou no script de conexão.
5. **Remoto**: o projeto é informado explicitamente (argumento `projectId` ou cabeçalho `X-Azyboard-Project-Id`); não existe `AZYBOARD_PROJECT_ID` no modo remoto.
6. Reforce a segurança: a chave nunca em arquivo versionado, chat ou linha de comando; o `projectId` não é segredo, a chave é. Prefira arquivos ignorados pelo git (o script avisa se o destino for versionado).
7. Verifique recarregando o cliente e confirmando `list_tasks`/`list_modules`, então execute `list_modules` para um projeto acessível. Se você já tiver acesso MCP na sessão, faça a verificação você mesmo.
8. Se houver erro, use a tabela de problemas comuns do roteiro (401, 403, 404, falha de conexão).

A conexão remota pode ser feita pelo agente **com ação do usuário no terminal**: gere/oriente o comando, peça que ele o execute, e depois confirme a conexão. Não invente hosts, caminhos ou credenciais.
