# /azyboard-setup-mcp

O usuário quer configurar o servidor MCP do Azy Board no cliente de code agent em uso. Siga o roteiro em `references/mcp-setup.md` e conduza a configuração passo a passo:

1. Confirme os pré-requisitos (acesso ao Azy Board, Bun instalado e o caminho local do repositório ou do `apps/mcp/dist/index.js`).
2. Oriente a gerar a API Key em **Minha conta → Gerenciar API Keys**, uma por cliente/ambiente, copiada uma única vez.
3. Monte a configuração do servidor `azy-board` no arquivo do cliente (Claude Code, Codex, OpenCode ou outro), localizando o arquivo real em vez de assumir um caminho fixo. Use placeholders (`azb_sua_chave_aqui`) e nunca a chave real; mantenha `EASYBOARD_API_KEY`, `EASYBOARD_URL` e, quando o repositório for de um único projeto, `AZYBOARD_PROJECT_ID`.
4. Reforce a segurança: a chave vai em variável de ambiente ou cofre do cliente, nunca em arquivo versionado; o `projectId` não é segredo, a chave é.
5. Verifique a conexão recarregando o cliente e confirmando `list_tasks`/`list_modules`, então execute `list_modules` para um projeto acessível.
6. Se houver erro, use a tabela de problemas comuns do roteiro (401, 403, 404, falha de conexão).

Não execute shell nem edite arquivos do cliente sem ação explícita do usuário; seu papel é orientar e preparar a configuração. Não invente hosts, caminhos ou credenciais.
