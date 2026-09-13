# Contrato de Erro

Toda resposta de erro HTTP, MCP ou Azy Agent usa o mesmo envelope:

```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "A requisição não pôde ser processada",
    "retryable": false,
    "details": null
  }
}
```

## Campos

- `code`: identificador estável para tratamento programático.
- `message`: mensagem segura para apresentação ao usuário ou ao agente.
- `retryable`: indica se repetir a operação pode ter sucesso.
- `details`: dados estruturados não sensíveis, normalmente erros de validação; pode ser `null`.

## Códigos E Retry

- `INVALID_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`, `RESOURCE_NOT_FOUND`, `CONFLICT`, `PAYLOAD_TOO_LARGE`: não retryable.
- `RATE_LIMITED`: retryable após o intervalo indicado, quando disponível.
- `INTERNAL_ERROR`: não retryable por padrão; falhas transitórias conhecidas usam `retryable: true`.

Stack trace, SQL, tokens, senhas e detalhes de infraestrutura ficam somente nos logs protegidos. Clientes legados que recebiam `error` como string ou `code` no nível raiz precisam migrar para `error.message` e `error.code`.
