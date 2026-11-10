# Spec Delta

## MODIFIED Requirements

### Requirement: Elegibilidade e preservação de concluídos
Candidatos SHALL ser TASK/BUG folhas não arquivados ligados à origem em NOT_STARTED/PLANNED/IN_PROGRESS/BLOCKED. DONE/CANCELLED, pais e itens fora da origem SHALL permanecer intactos. Mudança da população relevante após preparação SHALL invalidar o plano em vez de incluir novos itens silenciosamente.

#### Scenario: Preservar concluídos
- **WHEN** a transição é aplicada com um card DONE e outro BLOCKED na origem
- **THEN** só o BLOCKED recebe o destino e o DONE mantém seus vínculos/estado

#### Scenario: Carry-over de card planejado
- **WHEN** a transição é aplicada com um card PLANNED na origem
- **THEN** o card planejado recebe o vínculo com a sprint de destino e mantém o status

#### Scenario: Novo pendente antes de aprovação
- **WHEN** um novo pendente é associado à origem depois da preparação
- **THEN** a aplicação informa conflito e exige nova prévia sem ampliar os IDs aprovados
