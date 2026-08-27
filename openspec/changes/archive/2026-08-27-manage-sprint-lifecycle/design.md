## Context

O projeto já possui a tabela `sprints`, a relação `item_sprints`, endpoints básicos de criação/ativação/encerramento e um filtro de sprint no Board. Porém, o modelo usa os estados legados `PLANNED`, `ACTIVE` e `DONE`, as datas não são obrigatórias e a inclusão de cards não verifica se a sprint está encerrada. A interface de Settings também precisa oferecer um cadastro completo e o formulário de task precisa receber as sprints elegíveis.

## Goals / Non-Goals

**Goals:**

- Padronizar o ciclo `PROPOSED -> OPEN -> CLOSED` com nome e datas obrigatórios.
- Permitir N sprints por projeto e administrar seu cadastro nas configurações.
- Impedir novas associações a sprints fechadas no backend e removê-las das opções de vínculo.
- Manter o filtro Sprint visível sem sprints e permitir consulta histórica de sprints fechadas.
- Preservar isolamento multi-tenant e compatibilidade dos dados existentes por migração explícita.

**Non-Goals:**

- Impedir edição ou remoção de cards que já pertençam a sprint fechada.
- Permitir mais de uma sprint aberta simultaneamente no mesmo projeto, salvo decisão futura.
- Criar dependência de datas para movimentação de cards no Board.
- Alterar o modelo N:N entre itens e sprints.

## Decisions

- **Estados novos no banco:** usar `PROPOSED`, `OPEN` e `CLOSED`. Migrar `PLANNED -> PROPOSED`, `ACTIVE -> OPEN` e `DONE -> CLOSED`; não manter aliases no contrato público para evitar dois vocabulários.
- **Datas obrigatórias:** validar `startDate` e `endDate` no backend como datas ISO válidas, exigindo início menor ou igual ao fim. A UI usa controles `date` obrigatórios.
- **Transições explícitas:** criação inicia em `PROPOSED`; endpoint de abertura muda para `OPEN` e fecha eventual sprint aberta anterior; endpoint de fechamento muda para `CLOSED`. Não reabrir sprint fechada nesta etapa.
- **Inclusão em sprint fechada:** a associação via criação de item, endpoint de vínculo, edição ou MCP SHALL ser rejeitada no servidor quando o status for `CLOSED`. A UI filtra opções elegíveis para `PROPOSED`/`OPEN`; consultar sprints mantém todas.
- **Filtro histórico:** o filtro Sprint lista `PROPOSED`, `OPEN` e `CLOSED`, pois seu objetivo é consulta e não associação. Sem sprints, o select continua visível com estado vazio e mensagem informativa.
- **Contrato de criação:** `AddCardForm` recebe sprints do projeto e envia `sprintId` opcional. O backend cria o item e a associação atomicamente, validando projeto, tenant e status. Ausência de sprint permanece válida.
- **Cadastro em Settings:** usar CRUD protegido por autorização de configuração do projeto, com ações de abrir/fechar e feedback de transição inválida. A criação não deverá permitir escolher um status inconsistente com o fluxo.
- **Fonte única de regras:** concentrar validação de status/transição e elegibilidade de associação em helpers server-side reutilizáveis por REST e MCP; filtros do frontend são apenas conveniência visual.

## Risks / Trade-offs

- [Migração de status pode encontrar valores inesperados] -> validar valores antes da migração e abortar com erro explícito se houver dado inválido.
- [Cliente antigo envia status legado] -> rejeitar contratos legados após migração, documentando os novos valores.
- [Sprint fechada já possui itens] -> preservar vínculos existentes; bloquear somente novas inclusões.
- [Duas requisições abrem sprints simultaneamente] -> transacionar a troca de status por projeto e cobrir concorrência quando o driver permitir.
- [Frontend oferece sprint fechada por estado desatualizado] -> validar novamente no endpoint e retornar erro sem criar ou alterar parcialmente o item.

## Migration Plan

1. Criar migração de status e atualizar o schema/tipos para os três estados novos.
2. Ajustar API e UI de sprints, exigindo datas e implementando cadastro/transições.
3. Ajustar criação e associação de itens, filtro e opções do formulário.
4. Migrar dados existentes e validar que vínculos não foram removidos.
5. Executar testes de ciclo de vida, bloqueio, filtros, multi-tenant e build completo.
6. Em rollback, manter a migração aplicada e reverter apenas código se necessário; não reabrir sprints fechadas automaticamente.

## Open Questions

- A política de reabertura de sprint fechada e de transferência de seus itens ficará para uma mudança futura.
