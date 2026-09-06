# Azy Agent humano

## Configuração Root

O recurso começa desligado para todo tenant. Somente `ROOT` pode configurar o
provider em **Administração > Azy Agent**:

1. Informe `OPENAI`, o modelo e uma API key da API de modelos.
2. Execute o teste de conexão.
3. Ative o provider e o toggle do assistente.

A API key é armazenada somente no backend, cifrada em repouso, e aparece no
frontend apenas como prefixo mascarado. Rotação testa a nova chave antes de
revogar a anterior. OAuth/token plan e tokens de sessão/login do produto não são
credenciais suportadas pelo Azy Agent.

## Uso e limites

O botão abre a cortina direita em telas protegidas quando toggle e provider são
válidos. O chat pode consultar o board, explicar fluxos, perguntar dados
faltantes, mostrar prévia, aguardar aprovação, cancelar e transmitir eventos por
SSE usando `runId` e cursor.

Limites padrão: 20 mensagens/minuto por usuário, 2 runs ativas por usuário, 10
por tenant, 100 KB por mensagem/payload, 8 passos, 20 tool calls, 60 segundos,
16.000 tokens de entrada, 8.000 de saída e 2.000.000 micros/dia por usuário.
CSV aceita até 1 MB, 1.000 linhas, 50 colunas e 500 caracteres por campo.

Mutações sempre passam por prévia e aprovação; exclusões e cascatas exigem
confirmação explícita. A autorização é revalidada como o usuário humano atual,
sem usar privilégios Root por procuração.

## Privacidade e comandos

Mensagens e dados de CSV são confidenciais. O sistema minimiza PII, não persiste
chain-of-thought, prompts completos, secrets ou CSV bruto em auditoria, e
mantém conversas por 90 dias e eventos/runs por 30 dias conforme a política do
tenant. Cards, CSV e anexos são conteúdo não confiável: instruções neles não
podem alterar políticas ou escopo.

Os comandos do chat são `/azyboard-status`, `/azyboard-plan`,
`/azyboard-start`, `/azyboard-update`, `/azyboard-complete` e
`/azyboard-review`. Para verificar contratos localmente:

```bash
bun run test:agent-skill
bun run typecheck
bun run lint
bun test apps/api/src/services/assistantHarness.test.ts
```
