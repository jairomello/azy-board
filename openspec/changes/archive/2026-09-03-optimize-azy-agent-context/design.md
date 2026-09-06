## Context

O agente usa Chat Completions stateless. O catálogo atual de ferramentas ocupa aproximadamente 50 mil tokens e o fluxo de aprovação não retoma a run após a decisão.

## Decisions

- Persistir o estado mínimo de continuação em `assistant_runs`: entrada normalizada, resposta do provider e allowlist selecionada.
- Usar confirmação explícita por `runId` e `operationHash`; texto como "sim" só será atalho quando houver uma única aprovação pendente.
- Montar histórico no backend com resumo persistido e janela recente limitada por tokens.
- Classificar intenção deterministicamente e passar a allowlist ao harness. A allowlist limita exposição ao modelo, nunca autorização.
- Usar grupos de ferramentas existentes/registrados e fallback controlado para o catálogo de leitura quando a intenção for ambígua.
- Manter ferramentas estáveis no prefixo da requisição para permitir cache do provider no futuro, sem depender de cache externo para correção.

## Flow

```text
mensagem -> histórico/resumo -> intenção -> ferramentas mínimas -> modelo
mutação -> aprovação persistida -> confirmar -> executar uma vez -> continuar modelo
```

## Safety

Toda execução continua validando tenant, usuário, autorização, argumentos e hash da operação no servidor. Cache não será usado para mutações nem para dados fora do escopo do tenant.

## Testing

Adicionar testes para histórico, seleção de ferramentas, retomada de aprovação, idempotência e limite de tokens.
