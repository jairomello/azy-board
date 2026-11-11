# Spec Delta

## MODIFIED Requirements

### Requirement: Elegibilidade e preservação de concluídos
Candidatos SHALL ser TASK/BUG folhas não arquivados ligados à origem em NOT_STARTED/PLANNED/IN_PROGRESS/IN_HOMOLOGATION/BLOCKED. DONE/CANCELLED, pais e itens fora da origem SHALL permanecer intactos. Mudança da população relevante após preparação SHALL invalidar o plano em vez de incluir novos itens silenciosamente.

#### Scenario: Preservar concluídos
- **WHEN** a transição é aplicada com um card DONE e outro BLOCKED na origem
- **THEN** só o BLOCKED recebe o destino e o DONE mantém seus vínculos/estado

#### Scenario: Card em homologação é levado para a próxima sprint
- **WHEN** um card em `IN_HOMOLOGATION` está ligado à sprint de origem
- **THEN** ele recebe o vínculo com a sprint de destino e preserva o vínculo anterior

#### Scenario: Novo pendente antes de aprovação
- **WHEN** um novo pendente é associado à origem depois da preparação
- **THEN** a aplicação informa conflito e exige nova prévia sem ampliar os IDs aprovados
