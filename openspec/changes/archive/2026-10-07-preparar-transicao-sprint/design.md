Board ref: 4b20db3d-ddf2-400e-b0f4-cb3f1a4ac351

## Context

`sprint-management/spec.md` define PROPOSED/OPEN/CLOSED, baseline de folhas e preservação de ciclos. `routes/sprints.ts` valida transições; adapters fecham ciclos junto do status. `itemUnitOfWork.ts` substitui relações no SET, enquanto `sprint-filter.test.ts` prova múltiplas associações por item. Portanto a composição ingênua de `SET sprint` seguida de `close_sprint` perderia associações e teria janela de falha parcial.

## Goals / Non-Goals

**Goals:** plano revisável de carry-over, fechamento consistente, preservação de histórico e retomada observável.

**Non-Goals:** abrir destino implicitamente, criar sprint com datas inventadas, mover agregadores, reabrir CLOSED ou oferecer desfazer genérico de fechamento.

## Decisions

1. **Plano persistido.** `prepare_sprint_transition` lê origem OPEN e destino distinto do mesmo projeto; `apply_sprint_transition` recebe planId/hash e chave idempotente. Ambos são ADMIN; preparar é leitura, aplicar exige aprovação no chat. Plano guarda ciclo ativo, revisões de sprints e dos candidatos, IDs, vínculos anteriores, status/pontos e exclusões. Até 500 folhas por plano, sem execução parcial por chunk; excedente gera erro acionável.
2. **Pendentes explícitos.** Selecionar TASK/BUG folhas não arquivados ligados à origem nos estados NOT_STARTED/IN_PROGRESS/BLOCKED. DONE/CANCELLED, pais e itens fora da origem permanecem intactos. Nenhum item novo após preparação entra no plano. Se população ou estado relevante muda, invalidar prévia antes de commit, em vez de fechar silenciosamente deixando pendentes não revisados. Zero pendentes ainda permite fechar após aprovação com impacto zero.
3. **Resolver próxima sprint sem adivinhar.** Destino explicitado por ID/nome exato; “próxima” usa menor startDate posterior ao início da origem dentre PROPOSED/OPEN, mostrando nome/datas e critério na prévia; empate, homônimo, inexistência ou origem=destino exige esclarecimento no fluxo futuro. Não criar sprint nem ativar implicitamente. Datas relativas usam referência/fuso do pedido, não o instante posterior da fila.
4. **Acrescentar vínculo.** Para cada candidato, união de sprintIds atuais com destino; conservar origem e outros vínculos, deduplicando. O relatório chama essa ação de inclusão na próxima preservando participação anterior. Históricos em `item_events` e `sprint_cycle_items` não são reescritos. Alternativa de mover associação removendo origem foi rejeitada pois prejudica filtro histórico e não é necessária no modelo atual.
5. **Transação de domínio.** Estender port com comando atômico que revalida autorização, plano, população, ciclos, revisões e estados; associa destino, registra analytics das mudanças e fecha origem/ciclo na mesma transação. Implementar em SQLite e PostgreSQL reutilizando helpers analíticos/transições, não invocando rotas HTTP em sequência. Destino CLOSED ou origem já fechada por outra operação gera conflito sem efeitos. Prévia informa encerramento do ciclo, preservação da baseline, total/pontos (NULL destacado) e estado final do destino.
6. **Retomada T38.** Reserva única por tenant/projeto/ator/chave e hash, resultado e mudanças no commit; o replay retorna o resultado original apenas após revalidar acesso. Mesmo key com hash diferente é conflito. Notificações de vínculos/SPRINT_CHANGED entram no outbox T38, não em worker novo. Falha pré-commit reverte tudo; falha pós-commit marca publicação pendente e retoma só os efeitos. Consultar estado da operação resolve timeout incerto, sem novo fechamento.

## Risks / Trade-offs

- [T38 ainda não pronto] → elaborar interfaces/testes agora, integrar sua infraestrutura antes de liberar garantias de replay; não duplicar journal/outbox.
- [Duas transições da mesma origem] → serializar por origem/ciclo no commit; somente uma vence, a outra retorna conflito.
- [Histórico de associação múltipla pode surpreender] → prévia/resultado explicam que filtros de ambas as sprints incluem o card; métricas de compromisso usam baseline oficial.
- [Origem sem ciclo por dado legado] → impedir fluxo coordenado e diagnosticar inconsistência; não fabricar baseline retroativa.

## Migration Plan

Disponibilizar planos versionados e comando em ambos os adapters, integrar T38 e catálogo, depois liberar UI. Preservar rotas individuais existentes. Rollback desabilita ferramenta, mantém planos/resultados para auditoria; fechamento aplicado permanece CLOSED e não há compensação automática.

## Open Questions

Nenhuma decisão de produto pendente. O nome final dos métodos de T38 é alinhamento técnico; contratos de atomicidade e replay acima são obrigatórios.
