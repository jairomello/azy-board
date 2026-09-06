# Configuração e Segurança

## Servidor MCP

Configure o cliente com transporte `stdio` e o servidor `apps/mcp/src/index.ts` ou sua versão compilada. Use variáveis de ambiente:

```text
EASYBOARD_API_KEY=azb_sua_chave_aqui
EASYBOARD_URL=http://localhost:3000
```

Não coloque valores reais em arquivos versionados. Gere uma chave por agente, cliente e ambiente; use o cofre de segredos do cliente quando disponível.

Depois de recarregar o cliente, confirme que `list_tasks` e `list_modules` aparecem e execute `list_modules` em um `projectId` autorizado. O `projectId` pode ser obtido na URL `/projects/<id>/...`.

## Autorização

O servidor resolve Owner, tenant, grupo global, membership, papel local e escopos em cada chamada. A skill não deve solicitar `tenantId`, grupo ou papel para conceder acesso. Leituras, conteúdo e administração exigem permissões diferentes; uma API Key nunca eleva o Owner.

## Limites

- Upload de arquivos não está disponível pelo MCP; `list_attachments` retorna apenas metadados.
- Não assuma que nomes de colunas, sprint ativa ou módulos existem; consulte-os.
- Não revele recursos que retornarem erro de autorização ou fora do escopo.
- Para excluir projeto/item ou arquivar em cascata, faça preview quando suportado e confirme explicitamente.

## Chat humano e privacidade

O Root configura o Azy Agent no painel por tenant com `OPENAI`, modelo e API
key. O toggle permanece desligado por padrão. OAuth/token plan não é suportado;
use somente uma API key oficial da API de modelos.

O chat limita mensagens/payloads a 100 KB, CSV a 1 MB/1.000 linhas/50 colunas,
runs a 8 passos/20 tools/60 segundos e concorrência a 2 por usuário/10 por
tenant. Mutações exigem preview e aprovação, e cada tool revalida a identidade
humana, tenant, projeto e permissões. O histórico segue
`docs/AI_AGENT_DATA_POLICY.md`; não registre prompts completos, chain-of-thought,
secrets, CSV bruto ou PII desnecessária.

Para validar a skill e seus contratos:

```bash
bun run test:agent-skill
bun run test:mcp-catalog
```
