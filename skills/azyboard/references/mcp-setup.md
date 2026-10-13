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

Nenhum processo local: o cliente fala HTTP com a instalação. Registre o endpoint
e a credencial no cabeçalho (o formato varia por cliente — alguns usam `url` +
`headers`, outros um bloco equivalente):

```json
{
  "mcpServers": {
    "azy-board": {
      "type": "streamable-http",
      "url": "https://<instalação>/mcp",
      "headers": {
        "Authorization": "Bearer azb_sua_chave_aqui"
      }
    }
  }
}
```

- A URL pública é a da instalação + `/mcp` (ex.: `https://azyboard.exemplo.com/mcp`).
- O projeto de contexto é opcional e pode ir no cabeçalho
  `X-Azyboard-Project-Id: <uuid>`; sem ele, informe `projectId` no argumento de
  cada ferramenta que o exige.
- Mutações aceitam `Idempotency-Key` para repetição segura.
- **Não existe** `AZYBOARD_PROJECT_ID` por ambiente no modo remoto: o projeto é
  sempre informado explicitamente (cabeçalho ou argumento), nunca derivado da
  credencial.

### Onde fica o arquivo de configuração

Localize o arquivo do cliente em uso em vez de assumir um caminho fixo:

- **Claude Code**: configuração de servidores MCP (ex.: `.mcp.json` do projeto ou o arquivo de settings do cliente).
- **OpenCode**: `opencode.json` (ou o arquivo de config indicado pelo cliente).
- **Codex**: arquivo de configuração de MCP do Codex.

Preserve a estrutura exigida pelo cliente (nomes de chaves podem variar: `env`
vs `environment`, `args` etc.). Em caso de dúvida, consulte a documentação do
próprio cliente.

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
