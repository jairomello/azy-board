# Atualizar o guia de configuração do MCP remoto

## Problema

O guia publicado de configuração do servidor MCP apresenta `stdio` como modo
principal e orienta o usuário a executar um processo local. Para instalações
hospedadas, o Azy Board já oferece o endpoint remoto Streamable HTTP em `/mcp`,
mas essa opção está ausente do guia. Isso leva usuários a configurar um fluxo
obsoleto.

## Mudança

- Documentar o acesso remoto HTTP como modo recomendado para instalações
  hospedadas, usando a URL `/mcp` e autenticação Bearer por API Key.
- Explicar que a conexão remota não precisa de Bun, repositório local,
  `EASYBOARD_URL` ou variáveis de ambiente do processo.
- Manter `stdio` documentado como alternativa de desenvolvimento/local.
- Explicar como informar o projeto no modo remoto e como verificar a conexão.

## Impacto

Mudança editorial no guia da wiki que alimenta a página de ajuda. Não altera o
endpoint, os transportes ou o comportamento do runtime.
