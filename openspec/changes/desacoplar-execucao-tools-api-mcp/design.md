Board ref: 5a92afc0-d02d-4dbe-9852-b931cb81ecb2

## Context

`assistantTools.ts` importa execução e tipos do app MCP. `registry.ts` valida/coerce argumentos, resolve nomes de projeto, revalida autorização e despacha para `tools.ts` usando `ApiCall`; também injeta revisões da fotografia. `packages/tool-registry` já contém definições/policies puras e sua spec proíbe transporte. `apps/api/src/persistence/{ports,models,context,runtime}.ts` oferece fronteira independente de dialect, mas ainda há orquestração em `routes/{items,batch,assistant,projects}.ts`. A análise atualizada e a proposta delimitam a extração residual; não há justificativa para reescrever todo CRUD.

## Goals / Non-Goals

**Goals:** API compilável/executável sem `apps/mcp`; execução única com contratos estáveis; autorização e transação observáveis em testes dos casos críticos, nos dois perfis.

**Non-Goals:** novo catálogo, novos endpoints, troca de autenticação, migração de instalação, adapters ADVANCED (T36), isolamento do worker/fencing (T37), criação de outbox/idempotência (T38) ou barramento (T39).

## Decisions

### Separar definições, execução e adaptadores

Recomenda-se `packages/tool-execution` (novo) para normalização, resolução, dispatch e sanitização, dependente de `tool-registry` e contratos, sem Hono, SDK MCP, driver ou acesso a ambiente. Receber um port de invocação tipado e contexto confiável por composição. Extrair os mapeamentos hoje em `tools.ts` para adaptador HTTP compartilhado ou camada interna do novo pacote, sem importar o app MCP. MCP fica responsável pelo protocolo e credencial HTTP; a API injeta invocação local. Alternativa de pôr transporte no `tool-registry` viola sua spec; copiar dispatch duplica regras.

### Aplicação local para casos críticos

Recomenda-se `apps/api/src/application/{items,batch,agent}` (novos módulos) com funções pequenas, comandos e DTOs explícitos. Rotas convertem request/response, middleware resolve identidade e aplicação autoriza por membership/escopos no instante do uso. Criar/editar/mover item, batch de criação/atualização/movimentação e invocação de ferramenta do agente convergem para esses casos. Ferramentas não críticas podem temporariamente usar adaptador HTTP local, com inventário explícito; nenhuma regra crítica fica no adaptador. Não substituir validação de domínio por apenas JSON schema.

### Usar a unidade transacional estabelecida em T38

Casos de uso recebem port de unidade de trabalho e ports restritos ao tenant/ator. Na mesma unidade: autorização sensível à concorrência, mutação, revisão, resultado idempotente, auditoria/analytics e evento durável. Falha impede commit; emissão de rede fica depois do commit pelo contrato de T38/T39. Reutilizar as operações atômicas já extraídas por T36/T38 e mover somente sua orquestração. T37 entrega token de posse; caso do agente valida esse token antes de efeitos. Não aceitar tenant, owner ou geração vindos do modelo. Alternativa de transacionar só no handler permite execução interna sem a mesma garantia.

### Compatibilidade comprovada por contrato

Manter nomes, coerção null/string, duração, nome exato/UUID de projeto, limites, sanitização, `PROJECT_CONTEXT_MISMATCH`, autorização obrigatória do agente e revisões de snapshot. Testar REST, MCP via HTTP e agente local para resultados/erros equivalentes, normalizando somente IDs/relógio controlados. Gate estrutural de dependências é adequado para fronteira de imports; resultado de negócio exige testes comportamentais. Build isolado usa staging descartável sem fontes MCP, não remove arquivos do workspace.

## Risks / Trade-offs

- [Autorização esquecida ao abandonar HTTP] → contexto autenticado e port de autorização obrigatório; revogar membership entre descoberta e execução em teste.
- [Transações aninhadas ou fragmentadas] → uma unidade de trabalho por comando; adapters não fazem commits paralelos fora dela.
- [Mudanças concorrentes T36/T38] → integrar contratos após estabilização e revisar ownership antes de mover funções; não criar segundo sistema transacional.
- [Ciclo de imports e efeitos no boot] → composição só no runtime; pacote compartilhado sem imports de apps; teste isolado em ambos os perfis.
- [Deriva no catálogo extenso] → matriz de ferramentas/mapeamentos e testes de compatibilidade antes de retirar reexports.

## Migration Plan

1. Estabilizar ports de T36/T38 e contexto de T37; inventariar executores.
2. Extrair pacote mantendo fachada MCP compatível; migrar testes e API para o pacote.
3. Extrair um caso crítico por vez e trocar invocação do agente para local, sem duas mutações para comparação.
4. Comparar respostas/efeitos em ambientes descartáveis; retirar import legado só com gate isolado verde.
5. Rollback por versão de aplicação compatível com schema de T38; manter fachadas até concluir rollout. Não fazer downgrade destrutivo de schema nem republicar eventos já confirmados.

## Open Questions

Sem dúvida bloqueante de produto. Os nomes finais dos ports devem seguir os contratos entregues por T36/T38, preservando as responsabilidades acima. Metas de redução de linhas não são critério de aceite.
