Board ref: 25667747-2b18-43b6-badc-a2e461527c44

## Why

`apps/web/src/features/board/BoardScreen.tsx` mantém 1.220 linhas apesar de hooks e modelos existentes; testes estruturais ainda podem aceitar regressões de interação. `scripts/check-i18n.ts` procura literais com acento, deixando texto sem acento e chaves inválidas sem verificação suficiente.

## What Changes

- Separar filtros/população, drag/mutações, edição/modais e contexto do agente por responsabilidade, preservando preferências, Leaf Rule, densidade e comandos de visão.
- Substituir contratos de texto-fonte comportamentais por componentes e jornadas de login, Board, edição, Settings, permissões e agente.
- Exercitar conflito de revisão, rollback, autorização e reconexão com resultados observáveis.
- Ampliar scanner i18n para literais sem acento, chaves e conjuntos dinâmicos, com exceções explícitas e diagnósticos de origem.
- Verificar acessibilidade por teclado/foco e orçamento de bundle vigente.

## Capabilities

### New Capabilities
- `board-cohesive-interactions`: fronteiras do Board com jornadas de falha e reconciliação preservadas.
- `i18n-source-validation`: auditoria de texto e resolução de chaves estáticas/dinâmicas verificáveis.

### Modified Capabilities
Nenhuma: `frontend-testing`, `i18n`, `optimistic-mutations` e `realtime-sync` continuam válidas; as capacidades novas especificam mecanismos de comprovação e fronteiras.

## Impact

Afeta `apps/web/src/features/board`, stores de visão/foco e snapshot do agente, testes web/E2E, `scripts/{check-i18n,check-frontend-tests,check-bundle}.ts` e `TESTING.md` na futura implementação. T38 fornece revisões/erros transacionais, T39 entrega eventos e lacunas; este card testa a reação do cliente, não implementa outbox/pub-sub. T43 consumirá as jornadas como gates. Referências: análise atualizada e histórico `2026-10-03-add-agent-screen-context`, `2026-10-05-compactar-mais-cards`, que impede perder contexto e layout aprovado.
