---
title: Configurar o Servidor MCP
type: guide
order: 1
---

# Configurar o Servidor MCP

O MCP do Azy Board pode ser acessado remotamente por HTTP, sem instalar o
projeto nem executar um processo local. Para instalações hospedadas, esse é o
modo recomendado: o servidor já roda junto da API e o cliente se conecta à URL
`/mcp`.

O transporte local `stdio` continua disponível para desenvolvimento e para
instalações que ainda não oferecem o endpoint HTTP.

## Antes de começar

Você precisa de:

- acesso ao Azy Board e aos projetos que o agente utilizará;
- uma API Key criada em **Minha conta → Gerenciar API Keys**;
- um cliente compatível com MCP remoto por HTTP.

Consulte [[08 - Conta e Preferencias/Gerenciar API Keys|Gerenciar API Keys]].
Copie a chave ao criá-la: o valor integral não será exibido novamente.

## Conectar ao MCP remoto (recomendado)

Na instalação hospedada, o servidor já está em execução. Não instale Bun, não
clone o repositório e não configure um comando local. Use a URL do MCP exibida
em **Minha conta → Gerenciar API Keys**. Ela tem o formato:

```text
https://<endereco-da-instalacao>/mcp
```

Configure o cliente para usar transporte HTTP e envie a API Key no cabeçalho
`Authorization: Bearer <sua-api-key>`. Exemplo genérico:

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

O formato e o local do arquivo de configuração variam por cliente. Em clientes
que usam outro formato, mantenha os mesmos dados: transporte HTTP, URL terminada
em `/mcp` e cabeçalho Bearer.

O endpoint usa Streamable HTTP, é stateless e autentica cada requisição com a
API Key. Não configure `EASYBOARD_URL` ou `EASYBOARD_API_KEY` como variáveis de
ambiente do processo local neste modo.

### Projeto de contexto

No modo remoto, `AZYBOARD_PROJECT_ID` não é usado. Informe `projectId` nos
argumentos das ferramentas que o exigem ou configure o cabeçalho opcional
`X-Azyboard-Project-Id` no cliente. Sem um projeto de contexto, use uma
ferramenta como `list_projects` para descobrir os projetos acessíveis.

## Alternativa: servidor local (`stdio`)

Use `stdio` para desenvolvimento local ou quando precisar executar o adaptador
MCP junto ao código-fonte. Esse modo exige Bun, o repositório (ou a versão
compilada do servidor) na máquina do cliente e acesso à API do Azy Board.

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
2. Confirme que `azy-board` conectou sem erro e oferece ferramentas como
   `list_projects` e `list_tasks`.
3. Execute `list_projects` e confirme que aparecem apenas projetos acessíveis
   à sua API Key.
4. Escolha um projeto e teste uma leitura, por exemplo `list_modules` com o
   `projectId` retornado.

No modo remoto, erro `401` normalmente indica cabeçalho ausente, chave inválida
ou revogada. Erro `403` indica permissão insuficiente; erro `404` pode indicar
projeto inexistente ou sem acesso.

## Segurança operacional

- Use HTTPS no modo remoto.
- Trate a API Key como senha: não a grave em arquivos versionados, URLs, logs ou
  histórico de shell.
- Prefira o cofre de segredos do cliente quando disponível.
- Use uma chave diferente por cliente e ambiente e revogue imediatamente uma
  credencial exposta.
- A API Key herda as permissões da pessoa proprietária; ela não concede
  privilégios adicionais.

## Funcionalidades relacionadas

- [[08 - Conta e Preferencias/Gerenciar API Keys|Gerenciar API Keys]]
- [[09 - Agentes e Integracoes/Usar as Ferramentas MCP|Usar as ferramentas MCP]]
- [[09 - Agentes e Integracoes/Integrar pela API REST e Autenticar Agentes|Integrar pela API REST e autenticar agentes]]
