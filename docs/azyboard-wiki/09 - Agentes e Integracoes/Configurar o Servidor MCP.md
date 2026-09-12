---
title: Configurar o Servidor MCP
type: guide
order: 1
---

# Configurar o Servidor MCP

O servidor MCP conecta um cliente compatível ao Azy Board e disponibiliza ferramentas de projeto para um agente de IA. A conexão usa transporte `stdio`; cada instância recebe a URL da API e uma API Key pessoal.

## Antes de começar

Você precisa de:

- acesso ao Azy Board e aos projetos que o agente utilizará;
- uma API Key criada em **Minha conta**;
- URL acessível do backend do Azy Board;
- Bun instalado no ambiente que executará o servidor MCP;
- caminho local do repositório ou do arquivo compilado do servidor.

Consulte [[08 - Conta e Preferencias/Gerenciar API Keys|Gerenciar API Keys]] antes de configurar a credencial.

## Variáveis de ambiente

| Variável | Obrigatória | Conteúdo |
|---|---:|---|
| `EASYBOARD_API_KEY` | Sim | Segredo integral da API Key. |
| `EASYBOARD_URL` | Não | URL base do backend; padrão `http://localhost:3000`. |
| `AZYBOARD_PROJECT_ID` | Não | Projeto padrão da codebase; quando definido, `projectId` torna-se opcional nas ferramentas. |

Embora o nome técnico das variáveis mantenha `EASYBOARD`, elas configuram o servidor MCP do Azy Board.

## Projeto padrão da codebase

Quando um repositório de código trabalha sempre com o mesmo projeto do Azy
Board, defina `AZYBOARD_PROJECT_ID` no ambiente do servidor MCP. Com isso, o
agente não precisa descobrir o projeto a cada comando: `projectId` vira
opcional e o servidor injeta o padrão. Informar `projectId` explicitamente
continua permitindo operar outros projetos acessíveis à chave. O ID aparece na
URL `/projects/<id>/...`; ele não é um segredo e pode ficar versionado na
configuração MCP do repositório.

## Configuração de um cliente MCP

Cadastre um servidor chamado `azy-board` no cliente. Exemplo com execução pelo código-fonte:

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
        "EASYBOARD_URL": "http://localhost:3000"
      }
    }
  }
}
```

O local exato do arquivo de configuração varia conforme o cliente. Preserve a estrutura de comando, argumentos e ambiente exigida por ele.

## Skill oficial

O repositório mantém a skill oficial e agnóstica de cliente em
`skills/azyboard/SKILL.md`. Carregue esse arquivo no Claude Code, OpenCode,
Codex ou outro cliente compatível para obter os playbooks, regras operacionais
e comandos semânticos do Azy Board. Os arquivos em `skills/azyboard/commands/`
podem ser copiados para a convenção de slash commands do cliente; quando isso
não for suportado, use os mesmos comandos como prompts em linguagem natural.

Não copie API Keys para a skill ou para arquivos versionados. A configuração
deve continuar usando `EASYBOARD_API_KEY` e `EASYBOARD_URL` no ambiente ou no
cofre de segredos do cliente.

## Usar a versão compilada

Em ambientes estáveis, compile o servidor e aponte o cliente para `apps/mcp/dist/index.js`. Isso evita recompilação a cada inicialização.

O processo continua usando Bun, transporte `stdio` e as mesmas variáveis de ambiente.

## Verificar a conexão

1. Inicie ou recarregue o cliente MCP.
2. Confirme que o servidor `azy-board` iniciou sem erros.
3. Verifique se a lista de ferramentas inclui `list_tasks` e `list_modules`.
4. Execute `list_modules` com um `projectId` permitido.
5. Confirme que os módulos do projeto foram retornados.

Essa verificação testa, ao mesmo tempo, inicialização, rede, autenticação e acesso ao projeto.

## Encontrar o projectId

O identificador do projeto aparece na URL das páginas do projeto, entre `/projects/` e a tela atual. Exemplo:

```text
/projects/01ABCDEF/board
          ^^^^^^^^ projectId
```

Use o identificador integral nas ferramentas. As ferramentas também aceitam o
nome exato do projeto no lugar do ID; nomes ambíguos ou inexistentes retornam
erro corrigível sem executar a operação.

## Problemas comuns

| Sintoma | Verificação |
|---|---|
| `EASYBOARD_API_KEY não configurada` | Confirme a variável no processo MCP. |
| Erro `401` | Chave ausente, inválida ou revogada. |
| Erro `403` | O papel do proprietário não permite a ação. |
| Erro `404` em um projeto | O proprietário não participa do projeto ou o ID está incorreto. |
| Falha de conexão | Confirme `EASYBOARD_URL`, porta, protocolo e disponibilidade da API. |
| Ferramenta desconhecida | Recarregue o servidor e confira a versão configurada. |

## Segurança operacional

- Não grave a chave diretamente em arquivos versionados.
- Prefira variáveis de ambiente ou o cofre de segredos do cliente.
- Use uma chave diferente por cliente e ambiente.
- Revogue imediatamente uma credencial exposta.
- Execute o servidor somente em uma máquina confiável.

## Funcionalidades relacionadas

- [[08 - Conta e Preferencias/Gerenciar API Keys|Gerenciar API Keys]]
- [[09 - Agentes e Integracoes/Usar as Ferramentas MCP|Usar as ferramentas MCP]]
- [[09 - Agentes e Integracoes/Integrar pela API REST e Autenticar Agentes|Integrar pela API REST e autenticar agentes]]

<details>
<summary><strong>Como funciona tecnicamente</strong></summary>

O processo usa o SDK do Model Context Protocol com `StdioServerTransport`. Na inicialização, lê a chave e a URL do ambiente; se a chave estiver ausente, encerra antes de registrar ferramentas.

Cada chamada MCP é convertida em uma requisição à API sob `/api`, com `Authorization: Bearer {chave}` e conteúdo JSON. Respostas bem-sucedidas retornam ao cliente como conteúdo textual JSON; falhas são devolvidas como resultado MCP com `isError: true`.

</details>
