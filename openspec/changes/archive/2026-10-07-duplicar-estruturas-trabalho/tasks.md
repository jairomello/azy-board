Board ref: 63658232-4112-47c3-937e-03bc6cb8fdcb

## 1. Contratos e política

- [ ] 1.1 Definir schemas/roteamento/políticas de `prepare_structure_duplication` e `duplicate_structure` no catálogo compartilhado, separando leitura de aplicação MEMBER aprovada.
- [ ] 1.2 Definir plano versionado, política por campo, limites de 50 itens/1.000 passos/bytes, fingerprint de fonte e resposta com mapa origem→cópia.
- [ ] 1.3 Implementar validação de destino SAME_PROJECT, SIMPLE/HIERARCHICAL, tipos/pais/profundidade e coluna inicial NOT_STARTED inequívoca.
- [ ] 1.4 Alinhar chave/hash/resultado e efeitos ao contrato T38 sem nova infraestrutura; declarar anexos EXCLUDE e rejeitar COPY antes da escrita.

## 2. Preparação e comando de cópia

- [ ] 2.1 Coletar árvore, relações, descrições, checklists/passos e links selecionados em lote pelos ports, com snapshot e autorização tenant/projeto/ator.
- [ ] 2.2 Normalizar política de responsáveis/pontos/sprint/versão, validar membership/API keys e sprints não CLOSED, explicitando CLEAR para bloquear defaults T35.
- [ ] 2.3 Estender UnitOfWork SQLite para criar itens/relações/checklists/passos/links em uma transação com novos códigos/IDs e ancestry recalculado.
- [ ] 2.4 Implementar comando equivalente no adapter PostgreSQL com validação concorrente de fonte/destino e rollback integral; incluir comentários `[TENANT]`/`[DB-SWAP]` pertinentes.
- [ ] 2.5 Reiniciar status/passos/datas/bloqueios, aplicar advancedChecklists e excluir logs/horas/eventos/ciclos/bytes antigos; emitir apenas os eventos novos de criação.
- [ ] 2.6 Persistir resultado/mapa e chave idempotente no commit via T38; publicar notificações pelo outbox compartilhado e retornar estado de efeitos pendentes.

## 3. Experiência do agente

- [ ] 3.1 Integrar adaptadores MCP/agente e preview que enumera campos, contagens, exclusões e mapeamento de destino; fixar planId/hash na aprovação.
- [ ] 3.2 Mostrar explicitamente a cópia de descendentes para STORY fixa de SIMPLE, recusando pedido incompatível de nova STORY sem conversão silenciosa.
- [ ] 3.3 Retornar links/IDs das cópias, distinção de falha/conflito/publicação pendente e orientação de replay versus nova cópia intencional.
- [ ] 3.4 Atualizar skill/orientação e traduções PT-BR/EN/ES para políticas e exclusão de anexos/horas, sem prometer fetch de links.

## 4. Verificação

- [ ] 4.1 Testar STORY/subárvore em HIERARCHICAL e descendentes de STORY fixa em SIMPLE, ancestry/Leaf Rule/códigos e limite de profundidade.
- [ ] 4.2 Testar políticas CLEAR/COPY/SET, pontos zero/null, defaults T35, responsável inválido, sprint CLOSED, links sem fetch e anexos EXCLUDE/COPY rejeitado.
- [ ] 4.3 Testar checklist detalhada/desmarcada, original DONE com horas/eventos e ausência de histórico replicado, nos dois adapters.
- [ ] 4.4 Testar fonte/checklist/destino alterados após prévia, IDs externos, acesso perdido e rollback induzido em passo de checklist sem órfãos.
- [ ] 4.5 Testar replay simultâneo/pós-commit, hash divergente e falha de outbox T38 mantendo os mesmos IDs e sem cópia extra.
- [ ] 4.6 Executar `bun run check`, `bun run test:smoke` e `bun run test:agent-skill` se a skill for alterada; verificar aprovação até abertura da nova estrutura na web.
