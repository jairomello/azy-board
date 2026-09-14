## Context

As rotas de projeto e item atualmente implementam cascatas conhecendo diretamente varias tabelas. A rota de projeto ja usa uma transacao e faz uma pre-contagem opcional, mas a lista de deletes continua espalhada e a exclusao de `attachments` remove apenas metadados. O adapter de storage e uma dependencia externa ao banco, portanto nao pode participar da mesma transacao atomica.

O sistema precisa preservar o isolamento por `tenantId`, a regra de descendentes recursivos e o contrato atual dos endpoints. A solucao deve funcionar com SQLite no ambiente atual e nao bloquear PostgreSQL no futuro.

## Goals / Non-Goals

**Goals:**

- Definir um servico unico para montar e executar planos de exclusao de itens e projetos.
- Garantir que todas as leituras e deletes sejam limitados ao tenant e ao recurso autorizado.
- Usar FKs `ON DELETE CASCADE` apenas onde a relacao e inequivocamente dependente, mantendo deletes de aplicacao para referencias especiais e polimorficas.
- Persistir uma fila/outbox de limpeza de objetos do storage na mesma transacao que remove os metadados.
- Processar essa fila depois do commit com idempotencia, retry e auditoria de falhas.
- Detectar orfaos de banco e pendencias de storage em testes e diagnosticos.

**Non-Goals:**

- Alterar permissao, confirmacao ou formato de resposta dos endpoints publicos.
- Migrar o banco de SQLite para PostgreSQL.
- Fazer garbage collection indiscriminado de arquivos cujo caminho nao esteja registrado.
- Tornar a exclusao fisica do storage parte da transacao do banco.

## Decisions

### Servico de plano de exclusao

Criar um modulo de dominio para carregar a subarvore de itens e os recursos dependentes, validar tenant e produzir um plano com IDs e `storagePath`s. As rotas continuarao responsaveis por autorizacao e resposta HTTP, mas chamarao o mesmo executor para item e projeto. O executor fara os deletes em uma unica transacao e registrara jobs de storage antes do commit.

Alternativa considerada: manter listas independentes em cada rota. Foi rejeitada porque qualquer tabela nova pode ser esquecida em uma das cascatas.

### FKs e deletes explicitos

Usar cascata no banco para tabelas puramente dependentes, quando a migration puder preservar constraints e isolamento. Manter tratamento explicito para `projects.simple_story_id`, tabelas de associacao e recursos cujo cleanup exige coletar dados antes do delete. O teste de integridade deve verificar que cada tabela filha tenha politica documentada.

Alternativa considerada: converter todas as FKs para `CASCADE`. Foi rejeitada porque referencias para usuarios, credenciais e entidades compartilhadas podem ter semantica diferente e cascatas globais aumentam o risco de apagar dados fora do escopo.

### Outbox de storage

Adicionar uma tabela de jobs contendo tenant, storage path, tipo de recurso, status, tentativas, erro e timestamps. O insert do job ocorre na transacao do delete. Um processador pequeno e reutilizavel executa jobs pendentes apos o commit, marca sucesso depois de `storage.delete` e agenda retry com backoff em falhas. A operacao de delete deve continuar bem-sucedida quando o banco confirmou, mesmo que o provider esteja temporariamente indisponivel.

Alternativa considerada: chamar `storage.delete` dentro da transacao. Foi rejeitada porque falha externa nao pode fazer rollback confiavel do filesystem/S3 e pode manter a transacao aberta.

### Idempotencia e auditoria

Jobs serao identificados de forma unica por recurso e caminho, e delecoes repetidas tratarao recurso ausente como sucesso. A auditoria existente sera expandida para relatar metadados sem pai, referencias cruzadas de tenant e jobs presos/expirados, sem tentar apagar automaticamente dados.

## Risks / Trade-offs

- [Falha apos commit] O arquivo pode permanecer temporariamente → job persistente, retry e diagnostico de pendencias.
- [Migration de FKs] Reconstrucao SQLite pode perder constraint ou dado → migrations append-only, backup e testes em base vazia e populada.
- [Jobs sem worker ativo] A fila pode crescer → processador no startup e ciclo periodico no processo API, com metricas/logs e comando manual de drenagem.
- [Plano grande] Projetos com muitos itens podem exceder memoria ou limites de `IN` → processamento em lotes e consultas paginadas, preservando uma transacao por operacao.
- [Dados legados] Arquivos antigos podem nao ter job ou metadado confiavel → auditoria apenas reporta e exige acao explicita.

## Migration Plan

1. Adicionar a tabela de jobs e os servicos sem alterar o comportamento existente.
2. Aplicar migrations de FK somente onde a politica estiver coberta por teste.
3. Migrar as rotas de item e projeto para o executor compartilhado.
4. Iniciar o processador de jobs e executar uma auditoria em modo somente leitura.
5. Validar exclusoes em staging, incluindo rollback, retry e isolamento entre tenants.
6. Em rollback, manter a tabela de jobs e desabilitar o consumidor; os metadados podem continuar sendo excluidos pelo fluxo anterior sem perder os jobs ja registrados.

## Open Questions

- O ciclo periodico deve permanecer no processo da API no MVP ou ser exposto como comando separado para o deploy?
- Qual limite de tentativas e janela de retenção deve ser adotado para jobs permanentemente falhos?

## Limitações descobertas na implementação

- **Drizzle/bun-sqlite**: `db.transaction` com callback async não efetua rollback
  completo das instruções precedentes ao erro (o driver executa a transação
  nativa apenas até o primeiro `await`). A força do rollback de ponta a ponta é
  uma limitação preexistente nesta stack (Item 3/Item 22 da análise) e continua
  em pé: o endpoint devolve 500, o projeto permanece e a auditoria detecta
  resíduos. O outbox mitiga o pior efeito: todo caminho cujo metadado foi
  excluído possui job de limpeza, mesmo em falha parcial — nenhum arquivo fica
  órfão sem rastro.
- [DB-SWAP] Em PostgreSQL (node-postgres), `transaction` aguarda a promessa e o
  rollback de fato cobre o executor inteiro.
