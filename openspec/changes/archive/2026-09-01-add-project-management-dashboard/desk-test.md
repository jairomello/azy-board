# Teste de Mesa da Especificação

## Objetivo

Validar teoricamente fluxos, migrações, fórmulas, permissões e estados degradados antes da implementação, com foco em não quebrar a aplicação existente.

## Cenários Percorridos

| # | Cenário | Passos teóricos | Resultado esperado | Resultado |
|---|---|---|---|---|
| 1 | Base atual sem tabelas analíticas | Executar migração; iniciar API; abrir Board | Tabelas/colunas aditivas são criadas; Board e payloads existentes permanecem iguais | Passa |
| 2 | Projeto existente com itens ativos | Gerar baseline no deploy; abrir Dashboard | Snapshot atual aparece; aging informa limite inferior desde a cobertura | Passa com ressalva documentada |
| 3 | Sprint aberta no deploy | Migrar sprint OPEN; consultar box Sprint | Baseline MIGRATION é parcial e não é chamado de compromisso original | Passa |
| 4 | Sprint fechada legada | Migrar; consultar sprint antiga | Nenhum ciclo fictício; box informa indisponibilidade histórica | Passa |
| 5 | Abrir nova sprint | Associar itens; abrir sprint | Ciclo/baseline OPENED é gravado na mesma transação | Passa |
| 6 | Falha ao gravar ciclo | Simular erro durante abertura | Abertura reverte; sprint não fica OPEN sem ciclo | Passa se transacional |
| 7 | Criar/mover via diferentes canais | Executar UI, REST, MCP, batch e Shadow Markdown | Cada mutação coberta grava um evento equivalente sem mudar a resposta pública | Passa se serviço for centralizado |
| 8 | Falha ao gravar evento | Simular erro após validação da mutação | Mutação corrente reverte; demais operações continuam íntegras | Passa se mesma transação |
| 9 | Pai com filhos filtrados | Filtrar de modo que filhos não apareçam | Pai não vira folha; nenhuma dupla contagem | Passa se folha for calculada antes do filtro |
| 10 | Item muda pontos/sprint/versão | Consultar burnup antes/depois das mudanças | Série preserva snapshots anteriores e altera somente datas posteriores | Passa |
| 11 | Item já ativo no baseline | Consultar Aging WIP | Exibe “≥ N dias desde cobertura”, não uma data inicial inventada | Passa |
| 12 | Item inicia após cobertura | Mover NOT_STARTED → IN_PROGRESS | Primeiro evento ativo define aging; mudanças seguintes não zeram idade | Passa |
| 13 | Projeto sem pontos | Abrir Progresso/Escopo e Burnup por pontos | Contagem funciona; pontos mostram cobertura 0% e estado indisponível, sem divisão por zero | Passa |
| 14 | Projeto SIMPLE | Abrir Dashboard | STORY fixa não é contada; folhas TASK/BUG são agregadas corretamente | Passa |
| 15 | Horas em logs | Criar log manual com/sem duração e log automático | Somente manual com duração positiva é somado | Passa sem mudança de formulário |
| 16 | Filtro de responsável em horas | Autor do log difere do assignee atual | Box declara que horas por pessoa usam autor do log | Passa após esclarecimento na spec |
| 17 | Filtro de período em WIP | Selecionar 30 dias | WIP continua “agora” e filtro é marcado inaplicável | Passa após regra de aplicabilidade |
| 18 | Viewer autorizado | Abrir Dashboard e detalhar itens | Leitura permitida; nenhuma mutação adicional exposta | Passa |
| 19 | Tentativa cross-tenant | Forjar projectId/eventId externo | Query com tenant+projeto não retorna dado | Passa se guardrails forem testados |
| 20 | Rollback da UI | Remover menu/rota após deploy | Board continua funcional; tabelas aditivas permanecem sem impacto | Passa |
| 21 | Projeto vazio | Migrar projeto sem itens | Cabeçalho de cobertura existe sem exigir itemId | Passa após entidade de cobertura |
| 22 | Sprint vazia | Abrir sprint sem itens | Ciclo OPENED existe com zero itens | Passa após cabeçalho próprio |
| 23 | Primeiro/último filho | Criar primeiro filho e excluir/reparentear último | Pai recebe LEAF_CHANGED e burnup não duplica pai/filho | Passa após evento derivado |
| 24 | Arquivar/restaurar | Arquivar e restaurar folha | Escopo diminui/aumenta na data correta | Passa após ITEM_UNARCHIVED |
| 25 | Mudar TASK para BUG/módulo | Alterar tipo ou módulo efetivo | Filtros históricos usam snapshots anterior/posterior | Passa após eventos adicionais |
| 26 | Sprint N:N duplicada | Migrar pares repetidos em item_sprints | Pares são deduplicados e constraint impede recorrência | Passa após migração explícita |
| 27 | Trocar sprint aberta | Abrir B enquanto A está OPEN; reabrir A depois | Ciclo de A termina SUSPENDED; B inicia; reabrir A cria novo ciclo | Passa preservando comportamento atual |
| 28 | Aging após reabertura | DONE → IN_PROGRESS após meses | Novo episódio começa na reabertura; idade antiga não contamina | Passa após correção da fórmula |
| 29 | Excluir projeto | Excluir projeto com eventos/ciclos | Analytics é limpo sem bloquear rota; item delete isolado preserva histórico | Passa após política de cascade |
| 30 | Mutação durante corte | Tentar escrever enquanto baseline é capturado | Writer aguarda ou já grava evento; não existe janela de perda | Passa após corte sem writers antigos |
| 31 | Cascata multinível | Arquivar/restaurar/excluir pai com descendentes | Cada item afetado recebe evento; pais recebem LEAF_CHANGED quando aplicável | Passa após exigência por item |
| 32 | Reparenting com descendentes | Mover TASK pai entre módulos | Todas as folhas descendentes recebem módulo efetivo atualizado no histórico | Passa |
| 33 | Baseline sem ator humano | Executar migração | Eventos usam ator SYSTEM e origem MIGRATION | Passa |
| 34 | Projeto criado após deploy | Criar projeto vazio e depois itens iniciais | Coverage nasce atomicamente com projeto; itens posteriores geram eventos | Passa |
| 35 | Item em várias sprints | Filtrar Horas por uma sprint | Filtro usa EXISTS e não duplica total; não há breakdown aditivo | Passa |
| 36 | Arquivar/restaurar item ativo | ARCHIVED e restauração para IN_PROGRESS | Arquivo encerra episódio; restauração inicia novo aging | Passa |
| 37 | Ciclo suspenso | Abrir outra sprint antes de fechar a atual | `endedAt` e SUSPENDED permitem calcular o ciclo anterior | Passa |
| 38 | Hard delete após ciclo | Excluir item que participou de ciclo | Snapshot do ciclo sobrevive sem FK restritiva enquanto projeto existir | Passa |

## Lacunas Encontradas e Correções Aplicadas

| Lacuna | Risco | Correção na especificação |
|---|---|---|
| Aging de item ativo antes do deploy não possui início real | Mostrar idade falsa | Usar limite inferior desde `coverageStartedAt` |
| Sprint aberta existente não possui compromisso original | Baseline enganoso | Fonte `MIGRATION` e rótulo parcial |
| Filtro de período não faz sentido para WIP atual | Mudança silenciosa de semântica | API declara filtros aplicados/inaplicáveis por box |
| Filtrar antes de calcular folhas | Pai contado como card | Calcular folha no conjunto completo antes dos filtros |
| Horas não possuem `workDate` | Tratar data do log como data trabalhada | Nome “Horas Registradas” e sem timesheet nesta fase |
| Autor do log pode diferir do responsável do item | Atribuição errada de esforço | Horas por pessoa usam `authorId`; carga usa `assigneeId` |
| Hard delete poderia apagar histórico | Burnup se altera retroativamente | Eventos sem FK cascade e snapshots mínimos |
| Evento obrigatório pode quebrar mutação | Regressão operacional | Migração antes do menu, mesma transação e testes de todos os canais |
| Filtros atuais podem reclassificar história | Burnup retroativo incorreto | Eventos guardam snapshots de módulo/sprint/versão/tipo |
| Projeto sem estimativas | Divisão por zero | Cobertura explícita e fallback por contagem |
| Evento apenas do filho não atualizava o pai | Burnup com população de folhas errada | `LEAF_CHANGED` para pais e conversões de modo |
| Cobertura dependia de itemId | Projeto vazio sem coverageStartedAt | Entidade `project_analytics_coverage` |
| Baseline sem itens era indistinguível de ausência | Sprint vazia/legada ambígua | Cabeçalho `sprint_cycles` separado |
| `item_sprints` permite duplicatas | Multiplicação de pontos/horas | Deduplicação + constraint única + conjuntos nos eventos |
| Aging carregava episódios encerrados | Item reaberto parecia artificialmente antigo | Aging do episódio ativo atual |
| Baseline antes do dual-write criava janela | Perda de histórico durante deploy | Corte sem writers antigos |
| Exclusão de projeto sem política | FK poderia bloquear ou deixar órfãos | Cascade/limpeza no limite do projeto |
| WIP e bloqueados poderiam ser somados | Dupla contagem na equipe | `blockedSubset` explicitamente não aditivo |
| Múltiplas aberturas não tinham corte temporal | Ciclos anteriores incalculáveis | `sprint_cycles.startedAt/endedAt/endReason` |
| Cascatas registravam apenas o pai | Histórico divergente da subárvore | Evento por item analiticamente afetado |
| Migração não possui ator autenticado | Baseline incompatível com contrato | Ator SYSTEM permitido apenas em migração/processo interno |
| Sprint multivalorada duplicava horas | Soma por sprint acima do total | Filtro por EXISTS e ausência de breakdown aditivo |

## Conclusão

Após a segunda rodada, o plano reduzido é teoricamente consistente e aditivo. Não exige novos campos de formulário e preserva contratos existentes. Os principais riscos remanescentes são cobertura parcial legada, corte sem writers antigos e centralização de eventos; todos estão explicitados nas specs e tarefas.
