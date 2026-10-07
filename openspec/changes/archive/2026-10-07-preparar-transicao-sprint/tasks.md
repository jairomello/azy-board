Board ref: 4b20db3d-ddf2-400e-b0f4-cb3f1a4ac351

## 1. Contrato e planejamento

- [ ] 1.1 Registrar `prepare_sprint_transition` somente-leitura ADMIN e `apply_sprint_transition` mutação ADMIN no catálogo, schemas e políticas compartilhados.
- [ ] 1.2 Definir plano versionado com origem/destino/ciclo, população/revisões, diferenças, pontos conhecidos/desconhecidos, exclusões e limite de 500 folhas.
- [ ] 1.3 Implementar resolução inequívoca de “próxima”/nomes, validação de estados/projeto e apresentação do impacto de fechamento sem ativação implícita.
- [ ] 1.4 Alinhar reserva/resultado/outbox ao contrato T38, reusando a base compartilhada; definir consulta de estado e erros sem criar executor paralelo.

## 2. Comando atômico

- [ ] 2.1 Acrescentar comando de transição aos ports de persistência com pré-condições e metadados de ator/correlação; adicionar comentários `[TENANT]` e `[DB-SWAP]` pertinentes.
- [ ] 2.2 Implementar adapter SQLite: revalidar população/estado/ciclo no commit, unir sprintIds sem remover origem/outros e registrar analytics junto do fechamento.
- [ ] 2.3 Implementar adapter PostgreSQL com bloqueio/serialização da origem e garantia equivalente de rollback, unicidade e pré-condições.
- [ ] 2.4 Reutilizar helpers existentes para encerrar ciclo CLOSED sem alterar baseline ou iniciar destino; suportar plano vazio e rejeitar origem sem ciclo.
- [ ] 2.5 Integrar idempotência e resultado ao commit via T38, com payload hash, consulta/replay e publicação de efeitos no outbox comum.

## 3. Ferramentas e aprovação

- [ ] 3.1 Implementar adaptadores MCP/agente, preparar preview de candidatos/preservados e vincular aprovação a planId/hash e IDs fixos.
- [ ] 3.2 Revalidar autorização no apply/replay e distinguir não aplicado, conflito, aplicado e publicação pendente no resultado do harness.
- [ ] 3.3 Atualizar board/cache de sprints e associações após publicação; documentar múltiplos vínculos e diferença entre carry-over e `SET sprint` na orientação do agente.
- [ ] 3.4 Traduzir rótulos/erros PT-BR/EN/ES e apresentar acesso à lista completa e estado final de ambas as sprints.

## 4. Verificação

- [ ] 4.1 Testar elegibilidade de folhas NOT_STARTED/IN_PROGRESS/BLOCKED, preservação DONE/CANCELLED/pais/arquivados e manutenção de outros vínculos.
- [ ] 4.2 Testar destino CLOSED/externo/igual/ambíguo, zero pendentes e origem sem ciclo, sem dados parciais.
- [ ] 4.3 Testar candidato criado/editado após prévia, duas transições concorrentes, perda de permissão e rollback induzido entre associação e fechamento nos dois adapters.
- [ ] 4.4 Testar timeout pré/pós-commit, replay de mesma chave, chave com hash distinto e retomada só de outbox T38, sem novo vínculo/ciclo.
- [ ] 4.5 Confirmar baseline/histórico e métricas oficiais preservados; executar `bun run check`, `bun run test:smoke` e `bun run test:agent-skill` se a skill for alterada.
