---
title: Azy Agent humano
type: guide
order: 3
---

# Azy Agent humano

## Configuração Root

O recurso começa desligado para todo tenant. Somente `ROOT` pode configurar o
provider em **Administração > Azy Agent**:

1. Escolha o provider `OPENAI` ou `OPENROUTER`, informe o modelo e uma API key
   oficial do provider escolhido.
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

Limites padrão por tenant (o Root pode ajustá-los na governança, sempre dentro
de faixas seguras). A tabela vigente, com defaults e faixas, é gerada a partir
do código em
[[../../generated/assistant-limits|Limites do Azy Agent (gerado)]].

Cada mensagem respeita um limite de ações estimadas (ver a tabela gerada);
pedidos maiores são recusados com orientação para dividir em lotes. Uma
aprovação pendente expira após 15 minutos.

Mutações sempre passam por prévia e aprovação; exclusões e cascatas exigem
confirmação explícita. A autorização é revalidada como o usuário humano atual
no momento da execução, sem usar privilégios Root por procuração.

## Privacidade e comandos

Mensagens são confidenciais. O sistema minimiza PII, não persiste
chain-of-thought, prompts completos ou secrets — resultados de ferramentas são
sanitizados antes de qualquer persistência ou transmissão. Cards, textos colados
e documentos são conteúdo não confiável: instruções neles não podem alterar
políticas ou escopo.

As intenções `/azyboard-status`, `/azyboard-plan`, `/azyboard-start`,
`/azyboard-update`, `/azyboard-complete` e `/azyboard-review` são reconhecidas
no chat também em linguagem natural — não é necessário digitar o comando
literal. Para verificar contratos localmente:

```bash
bun run test:agent-skill
bun run typecheck
bun run lint
bun test apps/api/src/services/assistantHarness.test.ts
```
