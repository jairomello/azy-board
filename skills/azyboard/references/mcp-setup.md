# Configurar o MCP do Azy Board

Roteiro para o agente do usuário configurar o servidor MCP do Azy Board no
cliente de code agent em uso (Claude Code, Codex, OpenCode e outros), a partir
de um pedido em linguagem natural. O agente deve conduzir o usuário passo a
passo e adaptar a configuração ao cliente, sem inventar caminhos ou credenciais.

Há **três formas de conexão**, com o mesmo catálogo:

| Forma | Status | Como o cliente se conecta |
|---|---|---|
| **remoto com OAuth** (Streamable HTTP) | **Recomendado** (padrão). | Só a URL do MCP (`https://<instalação>/mcp` ou `https://<instalação>/mcp/projects/<projectId>`); o cliente conduz a autorização no navegador. |
| **remoto com API Key** | Depreciado. | URL do MCP + cabeçalho `Authorization: Bearer azb_...`. |
| **stdio** (local) | Depreciado. | Processo local (`bun run apps/mcp/src/index.ts`) com `EASYBOARD_API_KEY`. |

Use **OAuth remoto** por padrão. Ofereça API Key remota ou stdio somente quando
o cliente do usuário não suportar OAuth no MCP (ou para desenvolvimento local do
próprio Azy Board) e informe que ambos estão **depreciados**: continuam
funcionando, mas serão substituídos pelo OAuth.

## Pré-requisitos

Confirme com o usuário antes de montar a configuração:

- acesso ao Azy Board e aos projetos que o agente vai operar;
- **OAuth (padrão)**: apenas a URL pública do MCP da instalação e um navegador
  com sessão no Azy Board (login local, Microsoft ou Google). Não há segredo
  para copiar;
- **API Key remota ou stdio (depreciados)**: uma API Key criada no Azy Board
  (ver "Gerar a API Key") e, no stdio, Bun instalado, o caminho local do
  repositório (ou do arquivo compilado `apps/mcp/dist/index.js`) e a URL base do
  backend (ex.: `http://localhost:3000`).

A URL do MCP é a URL pública da instalação (com o base path, se houver) +
`/mcp`. Para fixar um projeto, use `/mcp/projects/<projectId>`.

## 1. Conectar por OAuth (recomendado)

Registre um servidor MCP chamado `azy-board` apontando **só para a URL**, sem
cabeçalho de credencial. Ao conectar, o cliente recebe `401` com
`WWW-Authenticate`, descobre o servidor de autorização do Azy Board, abre o
navegador e o usuário aprova a conexão na tela de consentimento (app, conta,
projeto e escopos). Nenhum segredo é copiado nem gravado em arquivo.

**Claude Code** (`.mcp.json` do projeto ou `~/.claude.json`):

```json
{
  "mcpServers": {
    "azy-board": {
      "type": "http",
      "url": "https://<instalação>/mcp"
    }
  }
}
```

Alternativa por CLI: `claude mcp add --transport http azy-board https://<instalação>/mcp`.
Depois, na sessão, rode `/mcp`, escolha `azy-board` e autentique.

**OpenCode** (`opencode.json`):

```json
{
  "mcp": {
    "azy-board": {
      "type": "remote",
      "url": "https://<instalação>/mcp",
      "enabled": true
    }
  }
}
```

Não defina `"oauth": false` nem `headers`. O OpenCode inicia a autorização
ao usar o servidor; também é possível rodar `opencode mcp auth azy-board`.

**OpenAI Codex** (`~/.codex/config.toml`):

```toml
[mcp_servers.azy-board]
url = "https://<instalação>/mcp"
```

Depois rode `codex mcp login azy-board` para autorizar no navegador.

**Projeto fixado pela URL:** para trabalhar sempre no mesmo projeto, use a URL
do MCP do projeto, `https://<instalação>/mcp/projects/<projectId>`. O token
emitido para essa URL só vale para aquele projeto, `projectId` pode ser omitido
nas ferramentas e um `projectId` diferente é recusado. Sem a URL de projeto,
informe `projectId` no argumento de cada ferramenta que o exige.

**Escopos:** o consentimento concede `read` e `write` por padrão; `admin` e
`delete` só quando o cliente os pede. O papel da pessoa em cada projeto
continua sendo aplicado em toda chamada.

**Revogar:** para desconectar um code agent, acesse **Minha conta → Conexões
MCP** e revogue a conexão. Os tokens daquela conexão deixam de valer na próxima
requisição.

### Conexão assistida pelo agente (script)

Quando o usuário já sabe a URL do MCP, o agente pode conduzir a conexão com um
script que grava a configuração do cliente. No modo padrão (OAuth) o script
grava só a URL, sem segredo; no modo API Key (depreciado, `--api-key`) ele
**pergunta a chave no terminal** — o segredo não passa pelo chat. O conector é
cross-platform (**Windows, Linux e macOS**):
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
   # MCP de um projeto (URL /mcp/projects/<projectId>):
   node /caminho/connect-mcp.mjs --client claude --url https://<instalação>/mcp --project-id <projectId>
   ```

   ```powershell
   # Windows (PowerShell)
   node C:\caminho\connect-mcp.mjs --client codex --url https://<instalação>/mcp
   ```

3. No modo OAuth, o script confirma que o servidor responde `401` com
   `WWW-Authenticate` (servidor OAuth pronto) e grava a configuração sem
   cabeçalho (JSON para OpenCode/Claude; TOML para Codex), com backup do arquivo
   anterior. Em seguida, o usuário autoriza no cliente: `/mcp` no Claude Code,
   `codex mcp login azy-board` no Codex ou `opencode mcp auth azy-board` no
   OpenCode, aprovando no navegador logado no Azy Board.
4. No modo `--api-key` (depreciado), o script avisa da depreciação, pede a
   **API Key com entrada oculta**, valida o handshake (`initialize` +
   `tools/list`) e grava a configuração com o cabeçalho `Authorization`.
5. Peça que o usuário execute e informe o resultado; depois verifique a conexão
   (recarregue o cliente / chame `list_modules`) e reporte o catálogo.

Flags:

| Flag | Efeito |
|---|---|
| `--client opencode\|claude\|codex\|generic` | Cliente alvo (padrão: pergunta). |
| `--url <url>` | URL do MCP (padrão: pergunta). |
| `--scope project\|user` | Escopo do arquivo (padrão: `project` p/ opencode/claude; `user` p/ codex). |
| `--config <arquivo>` | Caminho explícito do arquivo de configuração. |
| `--name <nome>` | Nome do servidor no cliente (padrão: `azy-board`). |
| `--project-id <uuid>` | Fixa o projeto: no OAuth vira a URL `<url>/projects/<uuid>`; no modo API Key, o cabeçalho `X-Azyboard-Project-Id`. |
| `--api-key` | **Depreciado.** Autentica com API Key (pedida no terminal) em vez de OAuth. |
| `--print` | Só valida e imprime a configuração, sem gravar. |
| `--force` | Permite gravar a API Key em arquivo versionado (com aviso). |

Notas:

- `generic` (e clientes sem gravação automática) apenas imprime o bloco para colar.
- Exige **Node.js 18+** (ou o wrapper com Bun). Sem Node, use a configuração
  manual das seções acima.
- No modo API Key, o script avisa (e bloqueia sem `--force`) se o arquivo de
  destino é **versionado no git**. No OAuth não há segredo no arquivo.

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
- O `.mcp.json` do Claude Code pode ser versionado no projeto. Com OAuth ele só
  contém a URL; com API Key, não coloque a chave lá sem garantir que o arquivo
  esteja no `.gitignore` — prefira o escopo de usuário (`~/.claude.json`).
- O Codex usa TOML (`[mcp_servers.<nome>]`), diferente dos clientes JSON.
- No Windows, `%USERPROFILE%` é o diretório do usuário (ex.: `C:\Users\voce`); em
  PowerShell o caminho equivalente é `$env:USERPROFILE`.

## 2. Alternativas depreciadas (API Key remota e stdio)

Use somente quando o cliente não suportar OAuth no MCP. Avise o usuário de que
API Key no MCP e o modo stdio estão **depreciados**.

### Gerar a API Key

A API Key identifica um **Owner humano** e herda suas permissões; ela não cria
privilégios novos.

1. Na interface, acesse **Minha conta → Gerenciar API Keys**.
2. Crie uma chave descritiva por cliente/ambiente (ex.: "notebook-claude", "ci-opencode").
3. Copie o valor **uma única vez** (ele não é exibido de novo).

Nunca grave a chave em arquivo versionado. Prefira variável de ambiente ou o
cofre de segredos do cliente. Cada cliente e ambiente usa uma chave própria.
Se a chave for exposta, revogue em Minha conta e gere outra.

Registre o servidor `azy-board` no arquivo de configuração do cliente. A
estrutura muda conforme o transporte; preserve o formato do cliente (nomes de
chaves podem variar).

### Modo stdio (local, depreciado)

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

### Modo remoto com API Key (depreciado)

Nenhum processo local: o cliente fala HTTP com a instalação. A URL é a da
instalação + `/mcp` (ex.: `https://azyboard.exemplo.com/mcp`) e a credencial vai
no cabeçalho `Authorization`. As respostas trazem os cabeçalhos `Deprecation`
e `Link` indicando a migração para OAuth. O formato muda conforme o cliente.

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
  (no mesmo bloco de headers) ou na URL `/mcp/projects/<projectId>`; sem eles,
  informe `projectId` no argumento de cada ferramenta que o exige.
- Mutações aceitam `Idempotency-Key` para repetição segura.
- **Não existe** `AZYBOARD_PROJECT_ID` por ambiente no modo remoto: o projeto é
  sempre informado explicitamente (URL do projeto, cabeçalho ou argumento), nunca
  derivado da credencial.

### Projeto padrão da codebase (somente modo stdio)

No **modo stdio**, quando o repositório trabalha sempre com o mesmo projeto do
Azy Board, defina `AZYBOARD_PROJECT_ID`. Com isso o agente não descobre o projeto
a cada comando: `projectId` vira opcional e o servidor injeta o padrão. Informar
`projectId` explicitamente continua permitindo operar outros projetos acessíveis
à chave.

No **modo remoto** não há `AZYBOARD_PROJECT_ID`: use a URL do MCP do projeto
(`/mcp/projects/<projectId>`), informe `projectId` no argumento da ferramenta ou,
com API Key, o cabeçalho `X-Azyboard-Project-Id`. O projeto nunca é derivado da
credencial.

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

Modo remoto (OAuth ou API Key):

1. Recarregue o cliente MCP apontando para a URL `/mcp` (ou `/mcp/projects/<projectId>`).
2. No OAuth, conclua a autorização no navegador quando o cliente pedir.
3. Confirme que o servidor iniciou sem erro e que a lista de ferramentas inclui
   `list_tasks` e `list_modules`.
4. Execute `list_modules` com um `projectId` permitido (ou omita-o na URL de
   projeto ou com o cabeçalho de contexto de projeto).
5. Confirme que os módulos do projeto foram retornados; `401` indica credencial
   ausente/inválida/revogada e `403`/`404` indicam escopo ou membership insuficiente.

Essa verificação cobre inicialização, rede, autenticação e acesso ao projeto.

## Problemas comuns

| Sintoma | Verificação |
|---|---|
| `EASYBOARD_API_KEY não configurada` | Confirme a variável no processo do servidor MCP (modo stdio). |
| Erro `401` com OAuth | Conexão não autorizada, expirada ou revogada: refaça a autorização no cliente (`/mcp`, `codex mcp login`, `opencode mcp auth`). |
| Cliente não abre o navegador / não oferece OAuth | O cliente não suporta OAuth no MCP: use a API Key remota ou o stdio (depreciados). |
| Erro `401` com API Key | Chave ausente, inválida ou revogada (remoto ou stdio). |
| Erro `401` no modo remoto com chave válida | Confirme o cabeçalho `Authorization: Bearer ...` literal. |
| Erro `403` | O papel do proprietário não permite a ação. |
| Erro `404` em um projeto | O proprietário não participa do projeto ou o ID está incorreto (vale também para `/mcp/projects/<projectId>`). |
| Erro `404` no `/mcp` | O endpoint remoto pode estar desabilitado (`AZYBOARD_MCP_HTTP_ENABLED=false`). |
| Falha de conexão (stdio) | Confirme `EASYBOARD_URL`, porta, protocolo e disponibilidade da API. |
| Falha de conexão (remoto) | Confirme a URL pública, o caminho `/mcp` e o proxy (sem buffering). |
| Autorização OAuth não inicia em instalação com base path | O proxy da raiz do host precisa encaminhar `/.well-known/oauth-protected-resource/<base>/mcp` e `/.well-known/oauth-authorization-server/<base>` à API (ver o guia da wiki). |
| Ferramenta desconhecida | Recarregue o servidor e confira a versão configurada. |

## Segurança operacional

- Com OAuth nenhum segredo é copiado: a configuração contém só a URL e o
  cliente guarda os tokens. Revogue conexões em **Minha conta → Conexões MCP**.
- Não grave a chave diretamente em arquivos versionados (garanta-a no `.gitignore` se necessário).
- Prefira variáveis de ambiente ou o cofre de segredos do cliente.
- Use uma chave por cliente e ambiente; revogue imediatamente uma credencial exposta.
- No modo remoto, a chave trafega no cabeçalho `Authorization`; use sempre HTTPS
  e não a inclua em URLs, logs ou histórico de shell.
- No modo remoto, o `projectId` é informado explicitamente (URL do MCP do
  projeto, cabeçalho ou argumento) e nunca é derivado da credencial.
- Execute o servidor somente em uma máquina confiável.
- A skill e os roteiros usam apenas placeholders; nunca inclua uma chave real em resposta, arquivo versionado ou log.
