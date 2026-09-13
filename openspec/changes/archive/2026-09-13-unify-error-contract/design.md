## Context

A API possui respostas de erro produzidas por handlers, middleware de autenticação/validação e integrações de agente. Hoje o formato varia entre string no campo `error`, campos auxiliares no nível raiz e envelopes específicos do Azy Agent. O contrato precisa atravessar HTTP, frontend, MCP e harness sem duplicar regras nem expor detalhes internos.

## Goals / Non-Goals

**Goals:**

- Definir um tipo compartilhado para erro de API e um único serializador.
- Normalizar status HTTP, código estável, mensagem segura, retryabilidade e detalhes estruturados.
- Fazer clientes HTTP, MCP e Azy Agent consumirem o mesmo payload.
- Preservar correlação e diagnóstico por logs sem retornar stack trace ou segredos.
- Cobrir respostas explícitas e exceções não tratadas com testes de contrato.

**Non-Goals:**

- Redesenhar todos os códigos de domínio existentes além de mapeá-los para o envelope.
- Alterar semântica de autorização, autenticação ou retry das operações.
- Criar um novo protocolo de transporte ou substituir o SDK MCP.
- Expor detalhes internos para facilitar debugging no navegador.

## Decisions

- **Envelope compartilhado:** usar `{ "error": { "code": string, "message": string, "retryable": boolean, "details": object | array | null } }`. O tipo será exportado pelo pacote compartilhado e usado por API, frontend e MCP. Isso é preferível a tipos locais porque evita drift entre consumidores.
- **Serialização central no backend:** criar um erro de domínio/HTTP normalizado e um único helper/middleware de resposta. Handlers poderão lançar ou retornar erros conhecidos, mas não montar JSON manualmente. Isso é preferível a uma migração apenas nos clientes, que manteria respostas incompatíveis.
- **Mapeamento explícito:** manter códigos estáveis para categorias atuais, associar cada código a status HTTP e definir `retryable` por categoria. Erros desconhecidos virão como `INTERNAL_ERROR`, com mensagem genérica e `details: null` em produção.
- **Validação de detalhes:** `details` aceitará somente dados serializáveis e não sensíveis, preferencialmente campos de validação ou identificadores de correlação. Stack traces ficarão somente nos logs.
- **Propagação de integrações:** o MCP e o harness do Azy Agent preservarão o envelope recebido; não haverá segunda transformação para `{ error, code, retryable }`. O MCP poderá adaptar apenas o mecanismo de transporte exigido pelo SDK, sem alterar o contrato semântico.
- **Migração de consumidores:** o frontend terá um parser tolerante durante a transição, mas novos testes exigirão o formato único e o backend deixará de emitir formatos legados após a mudança.

## Risks / Trade-offs

- **[Breaking] Clientes legados esperam `error` como string** → atualizar parser/documentação e registrar a alteração; manter leitura tolerante somente no cliente durante a janela de rollout.
- **Handlers esquecidos continuam montando payload manual** → adicionar teste de contrato que percorra rotas de erro e revisão/search gate para respostas legadas.
- **Códigos inconsistentes entre módulos** → catálogo central de códigos e testes de unicidade/serialização.
- **Detalhes vazam informação sensível** → allowlist de campos, sanitização e teste que verifica ausência de stack, SQL, token e segredos em produção.

## Migration Plan

1. Catalogar os formatos e códigos existentes e definir o mapa de códigos/status/retryable.
2. Implementar tipos compartilhados, erro normalizado, serializador e middleware de fallback.
3. Migrar handlers, validação, autenticação e integrações MCP/Azy Agent para o serializador.
4. Atualizar frontend, documentação e testes de contrato; executar typecheck, testes e build.
5. Fazer deploy em ordem backend e frontend, observar erros e confirmar que nenhuma resposta legada permanece.

Rollback: reverter a versão da aplicação para o commit anterior. Como não há alteração de schema, o rollback não exige migration reversa.

## Open Questions

- O catálogo final de códigos deve manter os códigos atuais exatamente ou adotar nomes novos por domínio?
- `details` terá um schema único discriminado ou um conjunto de schemas por código?
- Clientes externos precisam de uma janela formal de compatibilidade para o formato legado?
