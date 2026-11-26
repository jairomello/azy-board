---
title: Configurar o Servidor MCP
type: guide
order: 1
---

# Configurar o Servidor MCP

O MCP do Azy Board é acessado remotamente por HTTP, sem instalar o projeto nem
executar um processo local: o servidor já roda junto da API e o cliente se
conecta à URL `/mcp`.

A forma recomendada de autenticar é **OAuth**: você registra só a URL do MCP no
cliente e autoriza a conexão no navegador, com a sessão que já usa no Azy Board.
Nenhuma chave é copiada.

> [!warning] API Key e `stdio` depreciados no MCP
> Conectar o MCP com API Key (cabeçalho `Authorization`) ou pelo transporte
> local `stdio` (`EASYBOARD_API_KEY`) continua funcionando, mas está
> depreciado. Use essas formas apenas quando o cliente não suportar OAuth no MCP.

## Antes de começar

Você precisa de:

- acesso ao Azy Board e aos projetos que o agente utilizará;
- um cliente compatível com MCP remoto por HTTP e OAuth (por exemplo, Claude
  Code, Codex ou OpenCode);
- um navegador com sessão ativa no Azy Board.

## Conectar com OAuth (recomendado)

Use a URL do MCP exibida em **Minha conta**. Ela tem o formato:

```text
https://<endereco-da-instalacao>/mcp
```

Configure o cliente com transporte HTTP e **apenas a URL**, sem cabeçalho de
credencial. Exemplo genérico:

```json
{
  "mcpServers": {
    "azy-board": {
      "type": "http",
      "url": "https://<endereco-da-instalacao>/mcp"
    }
  }
}
```

Em clientes que usam outro formato, mantenha o mesmo dado: transporte HTTP e URL
terminada em `/mcp`. Exemplos:

- **Claude Code**: `claude mcp add --transport http azy-board https://<endereco-da-instalacao>/mcp`
  e, na sessão, `/mcp` para autenticar.
- **Codex**: em `~/.codex/config.toml`, a seção `[mcp_servers.azy-board]` com
  `url = "https://<endereco-da-instalacao>/mcp"`; depois `codex mcp login azy-board`.
- **OpenCode**: servidor `type: "remote"` com a `url`, sem `headers` e sem
  `"oauth": false`; a autorização começa ao usar o servidor ou com
  `opencode mcp auth azy-board`.

### Autorizar a conexão

1. Ao conectar, o cliente abre o navegador na tela de autorização do Azy Board.
2. Se não houver sessão, faça login (local, Microsoft ou Google); a tela de
   autorização é retomada em seguida.
3. Confira o aplicativo que pede acesso, o endereço para onde ele será
   redirecionado, a conta, o projeto (quando a URL for de projeto) e os escopos.
4. Selecione **Aprovar** para conectar ou **Negar** para recusar.

Os escopos disponíveis são `read`, `write`, `admin` e `delete`. Sem pedido
explícito do cliente, a conexão recebe `read` e `write`. O papel da pessoa em
cada projeto continua sendo aplicado em toda chamada: a conexão nunca amplia
permissões.

O token emitido vale apenas no MCP; ele não autentica a API REST.

### MCP de um projeto

Para trabalhar sempre no mesmo projeto, use a URL do MCP do projeto, disponível
para copiar em **URL do MCP deste projeto**, nas configurações do projeto:

```text
https://<endereco-da-instalacao>/mcp/projects/<projectId>
```

Com essa URL, o projeto fica fixado: `projectId` pode ser omitido nas
ferramentas, um `projectId` diferente é recusado e a autorização emitida vale
somente para esse projeto. O `projectId` aparece na URL das páginas do projeto
(`/projects/<projectId>/board`) e não é segredo.

Na URL geral (`/mcp`), informe `projectId` nos argumentos das ferramentas que o
exigem. Sem um projeto de contexto, use `list_projects` para descobrir os
projetos acessíveis. `AZYBOARD_PROJECT_ID` não é usado no modo remoto.

### Revogar uma conexão

Para desconectar um code agent autorizado por OAuth:

1. Acesse **Minha conta**.
2. Localize a seção **Conexões MCP**, que lista cada aplicativo autorizado, o
   recurso (MCP geral ou projeto), os escopos e as datas de criação e de último
   uso.
3. Revogue a conexão desejada.

A revogação invalida os tokens da conexão na próxima requisição. Para voltar a
usar o cliente, autorize novamente.

## Alternativa depreciada: API Key no MCP remoto

Use apenas quando o cliente não suportar OAuth no MCP. Crie uma API Key em
**Minha conta → Gerenciar API Keys** (veja
[[08 - Conta e Preferencias/Gerenciar API Keys|Gerenciar API Keys]]) e envie-a no
cabeçalho `Authorization: Bearer <sua-api-key>`:

```json
{
  "mcpServers": {
    "azy-board": {
      "type": "http",
      "url": "https://<endereco-da-instalacao>/mcp",
      "headers": {
        "Authorization": "Bearer azb_sua_chave_aqui"
      }
    }
  }
}
```

Copie a chave ao criá-la: o valor integral não será exibido novamente. As
respostas do MCP a requisições com API Key trazem os cabeçalhos `Deprecation` e
`Link` indicando a migração para OAuth. Nesse modo, o projeto de contexto pode
ser informado também pelo cabeçalho opcional `X-Azyboard-Project-Id`.

## Alternativa depreciada: servidor local (`stdio`)

O transporte `stdio` executa o adaptador MCP na máquina do cliente. Ele exige
Bun, o repositório (ou a versão compilada do servidor) e acesso à API do Azy
Board, e está depreciado: ao iniciar, o servidor avisa e recomenda o MCP remoto
com OAuth.

Exemplo de configuração:

```json
{
  "mcpServers": {
    "azy-board": {
      "command": "bun",
      "args": [
        "run",
        "/caminho/para/azyboard/apps/mcp/src/index.ts"
      ],
      "env": {
        "EASYBOARD_API_KEY": "azb_sua_chave_aqui",
        "EASYBOARD_URL": "http://localhost:3000",
        "AZYBOARD_PROJECT_ID": "<id-opcional-do-projeto-padrao>"
      }
    }
  }
}
```

| Variável | Obrigatória | Conteúdo |
|---|---:|---|
| `EASYBOARD_API_KEY` | Sim | API Key integral. |
| `EASYBOARD_URL` | Não | URL base da API; padrão `http://localhost:3000`. |
| `AZYBOARD_PROJECT_ID` | Não | Projeto padrão; quando definido, `projectId` pode ser omitido nas ferramentas. |

O nome técnico das variáveis mantém `EASYBOARD`, embora configurem o Azy Board.
No modo `stdio`, o processo MCP local usa essa chave para chamar a API.

## Verificar a conexão

1. Salve a configuração e recarregue ou reinicie o cliente MCP.
2. No OAuth, conclua a autorização no navegador quando o cliente pedir.
3. Confirme que `azy-board` conectou sem erro e oferece ferramentas como
   `list_projects` e `list_tasks`.
4. Execute `list_projects` e confirme que aparecem apenas projetos acessíveis
   à sua conta (ou somente o projeto da URL, no MCP de projeto).
5. Escolha um projeto e teste uma leitura, por exemplo `list_modules` com o
   `projectId` retornado.

Erro `401` indica conexão não autorizada, expirada ou revogada (no OAuth, refaça
a autorização no cliente) ou, com API Key, cabeçalho ausente ou chave inválida ou
revogada. Erro `403` indica permissão insuficiente; erro `404` pode indicar
projeto inexistente ou sem acesso.

## Publicar sob um caminho (base path)

Esta seção é para quem administra a instalação. Os clientes descobrem o
servidor de autorização pelos documentos `/.well-known`, que ficam **na raiz do
host**, com o caminho do recurso inserido depois do prefixo. Em uma instalação
publicada em `https://<host>/azyboard`:

| Documento | Caminho público |
|---|---|
| Metadados do MCP geral | `/.well-known/oauth-protected-resource/azyboard/mcp` |
| Metadados do MCP de projeto | `/.well-known/oauth-protected-resource/azyboard/mcp/projects/<projectId>` |
| Metadados do servidor de autorização | `/.well-known/oauth-authorization-server/azyboard` |

Para isso funcionar:

- defina na API a variável `AZYBOARD_PUBLIC_URL` com a URL pública completa,
  incluindo o caminho (por exemplo, `https://<host>/azyboard`). Sem ela, a API
  usa `FRONTEND_URL`, o que só é correto quando a instalação está na raiz do
  host;
- configure o proxy da raiz do host (nginx ou equivalente) para encaminhar à
  API os caminhos `/.well-known/oauth-protected-resource/<base>/mcp` (inclusive
  os de projeto) e `/.well-known/oauth-authorization-server/<base>`, além de
  `<base>/mcp` e `<base>/mcp/projects/*` por prefixo e sem buffering.

Em instalações na raiz do host, o nginx do web deve encaminhar `/.well-known/oauth-*`
e `/mcp` (por prefixo) para a API.

## Segurança operacional

- Use HTTPS no modo remoto.
- Prefira OAuth: nenhum segredo fica no arquivo de configuração do cliente, e
  cada conexão pode ser revogada em **Minha conta → Conexões MCP**.
- Autorize somente aplicativos que você reconhece; confira o endereço de
  redirecionamento exibido na tela de autorização.
- Com API Key, trate a chave como senha: não a grave em arquivos versionados,
  URLs, logs ou histórico de shell. Prefira o cofre de segredos do cliente, use
  uma chave diferente por cliente e ambiente e revogue imediatamente uma
  credencial exposta.
- Conexões OAuth e API Keys herdam as permissões da pessoa proprietária; elas
  não concedem privilégios adicionais.

## Funcionalidades relacionadas

- [[08 - Conta e Preferencias/Gerenciar API Keys|Gerenciar API Keys]]
- [[09 - Agentes e Integracoes/Usar as Ferramentas MCP|Usar as ferramentas MCP]]
- [[09 - Agentes e Integracoes/Integrar pela API REST e Autenticar Agentes|Integrar pela API REST e autenticar agentes]]
