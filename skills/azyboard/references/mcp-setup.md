# Configurar o MCP do Azy Board

Roteiro para o agente do usuário configurar o servidor MCP do Azy Board no
cliente de code agent em uso (Claude Code, Codex, OpenCode e outros), a partir
de um pedido em linguagem natural. O agente deve conduzir o usuário passo a
passo e adaptar a configuração ao cliente, sem inventar caminhos ou credenciais.

## Pré-requisitos

Confirme com o usuário antes de montar a configuração:

- acesso ao Azy Board e aos projetos que o agente vai operar;
- uma API Key criada no Azy Board (ver abaixo);
- URL base do backend do Azy Board (ex.: `http://localhost:3000` ou a URL da instalação);
- Bun instalado na máquina que executará o servidor MCP;
- caminho local do repositório do Azy Board (ou do arquivo compilado `apps/mcp/dist/index.js`).

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
cliente. A estrutura é sempre a mesma — comando, argumentos e ambiente — ainda
que o nome/posição do arquivo mude por cliente:

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

Variáveis de ambiente lidas pelo servidor:

| Variável | Obrigatória | Conteúdo |
|---|---:|---|
| `EASYBOARD_API_KEY` | Sim | Segredo integral da API Key. |
| `EASYBOARD_URL` | Não | URL base do backend; padrão `http://localhost:3000`. |
| `AZYBOARD_PROJECT_ID` | Não | Projeto padrão da codebase; quando definido, `projectId` torna-se opcional nas ferramentas. |

O nome técnico das variáveis mantém `EASYBOARD`, mas elas configuram o servidor
MCP do Azy Board.

### Onde fica o arquivo de configuração

Localize o arquivo do cliente em uso em vez de assumir um caminho fixo:

- **Claude Code**: configuração de servidores MCP (ex.: `.mcp.json` do projeto ou o arquivo de settings do cliente).
- **OpenCode**: `opencode.json` (ou o arquivo de config indicado pelo cliente).
- **Codex**: arquivo de configuração de MCP do Codex.

Preserve a estrutura exigida pelo cliente (nomes de chaves podem variar: `env`
vs `environment`, `args` etc.). Em caso de dúvida, consulte a documentação do
próprio cliente.

### Projeto padrão da codebase

Quando o repositório trabalha sempre com o mesmo projeto do Azy Board, defina
`AZYBOARD_PROJECT_ID`. Com isso o agente não descobre o projeto a cada comando:
`projectId` vira opcional e o servidor injeta o padrão. Informar `projectId`
explicitamente continua permitindo operar outros projetos acessíveis à chave.

O ID aparece na URL das páginas do projeto, entre `/projects/` e a tela:

```text
/projects/01ABCDEF/board
          ^^^^^^^^ projectId
```

O `projectId` **não é segredo** e pode ficar versionado na configuração MCP do
repositório. A API Key **não pode**.

### Versão compilada

Em ambientes estáveis, compile o servidor e aponte o cliente para
`apps/mcp/dist/index.js`, evitando recompilação a cada inicialização. O processo
continua usando Bun, transporte `stdio` e as mesmas variáveis.

## 3. Verificar a conexão

1. Inicie ou recarregue o cliente MCP.
2. Confirme que o servidor `azy-board` iniciou sem erro.
3. Verifique que a lista de ferramentas inclui `list_tasks` e `list_modules`.
4. Execute `list_modules` para um `projectId` permitido (ou omita-o se `AZYBOARD_PROJECT_ID` estiver definido).
5. Confirme que os módulos do projeto foram retornados.

Essa verificação cobre inicialização, rede, autenticação e acesso ao projeto.

## Problemas comuns

| Sintoma | Verificação |
|---|---|
| `EASYBOARD_API_KEY não configurada` | Confirme a variável no processo do servidor MCP. |
| Erro `401` | Chave ausente, inválida ou revogada. |
| Erro `403` | O papel do proprietário não permite a ação. |
| Erro `404` em um projeto | O proprietário não participa do projeto ou o ID está incorreto. |
| Falha de conexão | Confirme `EASYBOARD_URL`, porta, protocolo e disponibilidade da API. |
| Ferramenta desconhecida | Recarregue o servidor e confira a versão configurada. |

## Segurança operacional

- Não grave a chave diretamente em arquivos versionados (garanta-a no `.gitignore` se necessário).
- Prefira variáveis de ambiente ou o cofre de segredos do cliente.
- Use uma chave por cliente e ambiente; revogue imediatamente uma credencial exposta.
- Execute o servidor somente em uma máquina confiável.
- A skill e os roteiros usam apenas placeholders; nunca inclua uma chave real em resposta, arquivo versionado ou log.
