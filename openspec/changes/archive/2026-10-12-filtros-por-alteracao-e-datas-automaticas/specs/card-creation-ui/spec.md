# Spec Delta

## ADDED Requirements

### Requirement: Sugestão de datas da sprint na criação do card

Nos formulários de criação de TASK/BUG (rápido inline e amplo), ao selecionar uma sprint o sistema SHALL pré-preencher as datas de início e fim do card com as datas da sprint selecionada, quando o usuário ainda não tiver informado datas. As datas sugeridas SHALL permanecer editáveis e, se o usuário informar um valor, esse valor SHALL ser preservado.

#### Scenario: Sprint selecionada sugere as datas

- **WHEN** o usuário seleciona uma sprint no formulário de criação sem datas preenchidas
- **THEN** os campos de início e fim são pré-preenchidos com as datas da sprint e continuam editáveis

#### Scenario: Usuário sobrescreve a sugestão

- **WHEN** o usuário altera manualmente uma das datas sugeridas
- **THEN** o valor informado é mantido e não é substituído pela data da sprint

#### Scenario: Troca de sprint antes de salvar

- **WHEN** o usuário troca a sprint selecionada antes de salvar e as datas ainda são as sugeridas da sprint anterior
- **THEN** as datas são atualizadas para as da nova sprint selecionada

#### Scenario: Sprint removida da criação

- **WHEN** o usuário volta a seleção de sprint ao estado neutro
- **THEN** as datas que eram apenas sugestão são limpas, preservando datas digitadas pelo usuário
