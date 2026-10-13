# Configurar o MCP do Azy Board

Roteiro para o agente do usuário configurar o servidor MCP do Azy Board no
cliente de code agent em uso (Claude Code, Codex, OpenCode e outros), a partir
de um pedido em linguagem natural. O agente deve conduzir o usuário passo a
passo e adaptar a configuração ao cliente, sem inventar caminhos ou credenciais.

Há **dois modos de transporte**, com a mesma API Key e o mesmo catálogo:

| Modo | Quando usar | Como o cliente se conecta |
|---|---|---|
| **stdio** (local) | Desenvolvimento ou máquina com o repositório/Bun instalado. | Processo local (`bun run apps/mcp/src/index.ts`). |
| **remoto** (Streamable HTTP) | Instalação hospedada; qualquer máquina, sem processo local. | URL do endpoint (`https://<instalação>/mcp`) + cabeçalho `Authorization`. |

Pergunte ao usuário qual modo deseja (ou infira: instalação hospedada → remoto;
repositório local com Bun → stdio) e siga a seção correspondente.

## Pré-requisitos

Confirme com o usuário antes de montar a configuração:

- acesso ao Azy Board e aos projetos que o agente vai operar;
- uma API Key criada no Azy Board (ver abaixo);
- URL base do backend do Azy Board (ex.: `http://localhost:3000` ou a URL da instalação);
- **modo stdio**: Bun instalado na máquina que executará o servidor MCP e o
  caminho local do repositório do Azy Board (ou do arquivo compilado `apps/mcp/dist/index.js`);
- **modo remoto**: apenas a URL pública da instalação (não exige Bun nem o
  repositório local).

## 1. Gerar a API Key

A API Key identifica um **Owner humano** e herda suas permissões; ela não cria
privilégios novos.

1. Na interface, acesse **Minha conta → Gerenciar API Keys**.
2. Crie uma chave descritiva por cliente/ambiente (ex.: "notebook-claude", "ci-opencode").
3. Copie o valor **uma única vez** (ele não é exibido de novo).

Nunca grave a chave em arquivo versionado. Prefira variável de ambiente ou o
cofre de segredos do cliente. Cada cliente e ambiente usa uma chave própria.
Se a chave for exposta, revogue em Minha conta e gere outra.

## 2. Montar a configuração do servidor

Registre um servidor MCP chamado `azy-board` no arquivo de configuração do
cliente. A estrutura muda conforme o transporte; preserve o formato do cliente
(nomes de chaves podem variar).

### Modo stdio (local)

```json
{
  "mcpServers": {
    "azy-board": {
      "command": "bun",
      "args": ["run", "/caminho/para/azyboard/apps/mcp/src/index.ts"],
      "env": {
        "EASYBOARD_API_KEY": "azb_sua_chave_aqui",
        "EASYBOARD_URL": "http://localhost:3000",
        "AZYBOARD_PROJECT_ID": "<uuid do projeto padrão>"
      }
    }
  }
}
```

Variáveis de ambiente lidas pelo servidor stdio:

| Variável | Obrigatória | Conteúdo |
|---|---:|---|
| `EASYBOARD_API_KEY` | Sim | Segredo integral da API Key. |
| `EASYBOARD_URL` | Não | URL base do backend; padrão `http://localhost:3000`. |
| `AZYBOARD_PROJECT_ID` | Não | Projeto padrão da codebase; quando definido, `projectId` torna-se opcional nas ferramentas. |

O nome técnico das variáveis mantém `EASYBOARD`, mas elas configuram o servidor
MCP do Azy Board.

### Modo remoto (Streamable HTTP)

Nenhum processo local: o cliente fala HTTP com a instalação. A URL é a da
instalação + `/mcp` (ex.: `https://azyboard.exemplo.com/mcp`) e a credencial vai
no cabeçalho `Authorization`. O formato muda conforme o cliente.

**OpenCode** (`opencode.json`) — bloco `mcp`:

```json
{
  "mcp": {
    "azy-board": {
      "type": "remote",
      "url": "https://<instalação>/mcp",
      "enabled": true,
      "oauth": false,
      "headers": { "Authorization": "Bearer azb_sua_chave_aqui" }
    }
  }
}
```

**Claude Code** (`.mcp.json` do projeto ou `~/.claude.json`) — bloco `mcpServers`:

```json
{
  "mcpServers": {
    "azy-board": {
      "type": "http",
      "url": "https://<instalação>/mcp",
      "headers": { "Authorization": "Bearer azb_sua_chave_aqui" }
    }
  }
}
```

Alternativa por CLI:
`claude mcp add --transport http azy-board https://<instalação>/mcp --header "Authorization: Bearer azb_sua_chave_aqui"`.

**OpenAI Codex** (`~/.codex/config.toml`) — seção `mcp_servers` (TOML):

```toml
[mcp_servers.azy-board]
url = "https://<instalação>/mcp"
http_headers = { "Authorization" = "Bearer azb_sua_chave_aqui" }
```

Alternativa por CLI: `codex mcp add azy-board --url https://<instalação>/mcp`
(o Codex também aceita `bearer_token_env_var` para não guardar o segredo no TOML).

Comum aos três:

- O projeto de contexto é opcional e vai no cabeçalho `X-Azyboard-Project-Id: <uuid>`
  (no mesmo bloco de headers); sem ele, informe `projectId` no argumento de cada
  ferramenta que o exige.
- Mutações aceitam `Idempotency-Key` para repetição segura.
- **Não existe** `AZYBOARD_PROJECT_ID` por ambiente no modo remoto: o projeto é
  sempre informado explicitamente (cabeçalho ou argumento), nunca derivado da
  credencial.

### Conexão assistida pelo agente (script)

Quando o usuário já sabe a URL do MCP e tem uma API Key, o agente conduz a
conexão com um script que **pergunta a chave no terminal** — o segredo não passa
pelo chat. O conector é cross-platform (**Windows, Linux e macOS**):
[`scripts/connect-mcp.mjs`](../scripts/connect-mcp.mjs) (Node 18+), com o wrapper
POSIX [`scripts/connect-mcp.sh`](../scripts/connect-mcp.sh).

Roteiro do agente:

1. Descubra o **sistema operacional** e o **cliente** (OpenCode, Claude Code ou
   Codex). Não invente a URL nem peça a chave no chat.
2. Entregue o comando para o usuário rodar **no terminal dele**, conforme o SO:

   ```bash
   # Linux / macOS (ou WSL/Git Bash)
   node /caminho/connect-mcp.mjs --client opencode --url https://<instalação>/mcp
   # sem informar o cliente, o script pergunta:
   node /caminho/connect-mcp.mjs --url https://<instalação>/mcp
   ```

   ```powershell
   # Windows (PowerShell)
   node C:\caminho\connect-mcp.mjs --client codex --url https://<instalação>/mcp
   ```

3. O script pede a **API Key com entrada oculta**, valida o handshake
   (`initialize` + `tools/list`) e grava a configuração do cliente (JSON para
   OpenCode/Claude; TOML para Codex), com backup do arquivo anterior.
4. Peça que o usuário execute e informe o resultado; depois verifique a conexão
   (recarregue o cliente / chame `list_modules`) e reporte o catálogo.

Flags:

| Flag | Efeito |
|---|---|
| `--client opencode\|claude\|codex\|generic` | Cliente alvo (padrão: pergunta). |
| `--url <url>` | URL do MCP (padrão: pergunta). |
| `--scope project\|user` | Escopo do arquivo (padrão: `project` p/ opencode/claude; `user` p/ codex). |
| `--config <arquivo>` | Caminho explícito do arquivo de configuração. |
| `--name <nome>` | Nome do servidor no cliente (padrão: `azy-board`). |
| `--project-id <uuid>` | Projeto de contexto (cabeçalho `X-Azyboard-Project-Id`). |
| `--print` | Só valida e imprime a configuração, sem gravar. |
| `--force` | Permite gravar em arquivo versionado (com aviso). |

Notas:

- `generic` (e clientes sem gravação automática) apenas imprime o bloco para colar.
- Exige **Node.js 18+** (ou o wrapper com Bun). Sem Node, use a configuração
  manual das seções acima.
- O script avisa se o arquivo de destino é **versionado no git**.

### Onde fica o arquivo de configuração por cliente e sistema

Caminhos comuns (confirme o do cliente; há escopo de projeto e de usuário):

| Cliente | Escopo | Linux | macOS | Windows |
|---|---|---|---|---|
| OpenCode | projeto | `./opencode.json` | `./opencode.json` | `.\opencode.json` |
| OpenCode | usuário | `~/.config/opencode/opencode.json` | `~/.config/opencode/opencode.json` | `%USERPROFILE%\.config\opencode\opencode.json` |
| Claude Code | projeto | `./.mcp.json` | `./.mcp.json` | `.\.mcp.json` |
| Claude Code | usuário | `~/.claude.json` | `~/.claude.json` | `%USERPROFILE%\.claude.json` |
| Codex | usuário | `~/.codex/config.toml` | `~/.codex/config.toml` | `%USERPROFILE%\.codex\config.toml` |

Observações:

- O OpenCode também aceita `opencode.jsonc` e as variáveis
  `OPENCODE_CONFIG`/`OPENCODE_CONFIG_DIR`.
- O `.mcp.json` do Claude Code pode ser versionado no projeto: não coloque a chave
  lá sem garantir que o arquivo esteja no `.gitignore` — prefira o escopo de
  usuário (`~/.claude.json`).
- O Codex usa TOML (`[mcp_servers.<nome>]`), diferente dos clientes JSON.
- No Windows, `%USERPROFILE%` é o diretório do usuário (ex.: `C:\Users\voce`); em
  PowerShell o caminho equivalente é `$env:USERPROFILE`.


### Projeto padrão da codebase (somente modo stdio)

No **modo stdio**, quando o repositório trabalha sempre com o mesmo projeto do
Azy Board, defina `AZYBOARD_PROJECT_ID`. Com isso o agente não descobre o projeto
a cada comando: `projectId` vira opcional e o servidor injeta o padrão. Informar
`projectId` explicitamente continua permitindo operar outros projetos acessíveis
à chave.

No **modo remoto** não há `AZYBOARD_PROJECT_ID`: informe `projectId` no argumento
da ferramenta ou, opcionalmente, no cabeçalho `X-Azyboard-Project-Id`. O projeto
nunca é derivado da credencial.

O ID aparece na URL das páginas do projeto, entre `/projects/` e a tela:

```text
/projects/01ABCDEF/board
          ^^^^^^^^ projectId
```

O `projectId` **não é segredo** e pode ficar versionado na configuração MCP do
repositório. A API Key **não pode**.

### Versão compilada (somente modo stdio)

Em ambientes estáveis, compile o servidor e aponte o cliente para
`apps/mcp/dist/index.js`, evitando recompilação a cada inicialização. O processo
continua usando Bun, transporte `stdio` e as mesmas variáveis.

## 3. Verificar a conexão

Modo stdio:

1. Inicie ou recarregue o cliente MCP.
2. Confirme que o servidor `azy-board` iniciou sem erro.
3. Verifique que a lista de ferramentas inclui `list_tasks` e `list_modules`.
4. Execute `list_modules` para um `projectId` permitido (ou omita-o se `AZYBOARD_PROJECT_ID` estiver definido).
5. Confirme que os módulos do projeto foram retornados.

Modo remoto:

1. Recarregue o cliente MCP apontando para a URL `/mcp`.
2. Confirme que o servidor iniciou sem erro e que a lista de ferramentas inclui
   `list_tasks` e `list_modules`.
3. Execute `list_modules` com um `projectId` permitido (ou com o cabeçalho de
   contexto de projeto).
4. Confirme que os módulos do projeto foram retornados; `401` indica credencial
   ausente/inválida e `403`/`404` indicam escopo ou membership insuficiente.

Essa verificação cobre inicialização, rede, autenticação e acesso ao projeto.

## Problemas comuns

| Sintoma | Verificação |
|---|---|
| `EASYBOARD_API_KEY não configurada` | Confirme a variável no processo do servidor MCP (modo stdio). |
| Erro `401` | Chave ausente, inválida ou revogada (nos dois modos). |
| Erro `401` no modo remoto com chave válida | Confirme o cabeçalho `Authorization: Bearer ...` literal. |
| Erro `403` | O papel do proprietário não permite a ação. |
| Erro `404` em um projeto | O proprietário não participa do projeto ou o ID está incorreto. |
| Erro `404` no `/mcp` | O endpoint remoto pode estar desabilitado (`AZYBOARD_MCP_HTTP_ENABLED=false`). |
| Falha de conexão (stdio) | Confirme `EASYBOARD_URL`, porta, protocolo e disponibilidade da API. |
| Falha de conexão (remoto) | Confirme a URL pública, o caminho `/mcp` e o proxy (sem buffering). |
| Ferramenta desconhecida | Recarregue o servidor e confira a versão configurada. |

## Segurança operacional

- Não grave a chave diretamente em arquivos versionados (garanta-a no `.gitignore` se necessário).
- Prefira variáveis de ambiente ou o cofre de segredos do cliente.
- Use uma chave por cliente e ambiente; revogue imediatamente uma credencial exposta.
- No modo remoto, a chave trafega no cabeçalho `Authorization`; use sempre HTTPS
  e não a inclua em URLs, logs ou histórico de shell.
- No modo remoto, o `projectId` é informado explicitamente (cabeçalho ou
  argumento) e nunca é derivado da credencial.
- Execute o servidor somente em uma máquina confiável.
- A skill e os roteiros usam apenas placeholders; nunca inclua uma chave real em resposta, arquivo versionado ou log.
