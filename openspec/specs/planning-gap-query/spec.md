# planning-gap-query Specification

## Purpose
TBD - created by archiving change consultar-lacunas-planejamento. Update Purpose after archive.
## Requirements
### Requirement: Consulta combinável de lacunas
O sistema SHALL oferecer consulta somente-leitura com grupos ALL/ANY, operadores tipados IS_EMPTY/IS_NOT_EMPTY, igualdade e comparações de datas compatíveis. SHALL cobrir prazo, pontos, sprint, versão e responsável, combinados com escopo de projeto, tipo, status, módulo e ator. Padrão SHALL ser TASK/BUG folhas ativos não arquivados nos estados NOT_STARTED/IN_PROGRESS/BLOCKED, com possibilidade de alteração explícita do escopo. Omitir um filtro ou null no envelope SHALL significar não filtrar, nunca ausência de valor.

#### Scenario: Meus cards sem prazo ou pontos
- **WHEN** o usuário consulta responsável igual ao ator e ANY de prazo/pontos IS_EMPTY
- **THEN** o resultado contém somente folhas do ator com ao menos uma dessas lacunas e retorna a expressão e o escopo aplicados

#### Scenario: Sem sprint e sem versão
- **WHEN** a consulta usa ALL das duas ausências
- **THEN** somente itens com ambas as lacunas são incluídos

#### Scenario: Consulta inválida
- **WHEN** há campo desconhecido, comparação incompatível ou mais de 20 condições ou profundidade superior a 3
- **THEN** a consulta retorna erro de validação sem executar predicados livres ou ampliar o escopo

### Requirement: Ausência semanticamente correta
O sistema SHALL tratar prazo/pontos/versão nulos como ausência; pontos zero SHALL ser valor preenchido. Sprint IS_EMPTY SHALL significar ausência de todos os vínculos, inclusive históricos. Responsável IS_EMPTY SHALL exigir ausência de usuário e de API key atribuída. Datas SHALL ser validadas em YYYY-MM-DD, com referência de data/fuso explícita para tradução de expressões relativas.

#### Scenario: Pontos zero
- **WHEN** um item possui zero pontos e outro possui pontos nulos
- **THEN** apenas o segundo aparece no grupo sem pontos

#### Scenario: Sprint histórica
- **WHEN** um item está ligado apenas a uma sprint CLOSED
- **THEN** ele não pertence ao grupo sem sprint

#### Scenario: Agente responsável
- **WHEN** um item está atribuído a uma API key e não a um usuário
- **THEN** ele não pertence ao grupo sem responsável

### Requirement: Resultado consistente paginado e contável
O sistema SHALL retornar resultId, captura, total distinto, grupos por lacuna com contagens sobrepostas rotuladas, combinações exclusivas e cursor da população fixada. Páginas SHALL ter 1–100 itens, padrão 50. O snapshot SHALL expirar após 30 minutos e conter no máximo 10.000 IDs; excedente SHALL ser erro explícito. Totais SHALL NOT ser inferidos da primeira página nem pela soma de grupos sobrepostos.

#### Scenario: Lacunas sobrepostas
- **WHEN** três cards possuem duas lacunas simultâneas
- **THEN** cada grupo conta três, o total distinto conta três e o resultado informa sobreposição

#### Scenario: Mudança entre páginas
- **WHEN** um card novo corresponde ao filtro após a captura
- **THEN** ele não entra nas páginas desse resultId e só aparece em uma nova consulta

#### Scenario: Expiração ou excesso
- **WHEN** o resultado expirou ou a resolução excede 10.000 IDs
- **THEN** o servidor solicita nova consulta ou redução do escopo, sem truncamento silencioso

### Requirement: Abertura fiel do resultado no board
O assistente SHALL oferecer abertura do resultado/grupo na aba de origem por comando tipado idempotente e checkpoint da visão anterior. A população SHALL ser a do resultId, inclusive OR e lacunas não representadas pelo toolbar. Ancestrais da árvore SHALL ser distinguíveis dos resultados reais. Itens não apresentáveis no Kanban SHALL ter quantidade informada e opção de árvore. O MCP SHALL consultar os dados sem receber ferramentas de navegação do navegador.

#### Scenario: Abrir condição OR
- **WHEN** o usuário abre um grupo com prazo vazio OU pontos vazios
- **THEN** o board mostra os IDs do grupo sem traduzir a expressão para uma interseção AND e permite voltar à visão anterior

#### Scenario: Outra aba aberta
- **WHEN** um comando de abertura é entregue ou repetido após reconexão
- **THEN** somente a aba de origem aplica o recorte uma vez

### Requirement: Correção delimitada sem inventar planejamento
O sistema SHALL propor correções somente com valores informados ou confirmados pelo usuário, por IDs fixados do grupo, diferenças e pré-condições. SHALL NOT inventar prazo, pontos, sprint, versão ou responsável. IDs sobrepostos SHALL ser deduplicados e alterações incompatíveis SHALL exigir revisão. Aprovação SHALL NOT autorizar reconsulta que incorpore novos cards nem fallback matchAll. A execução SHALL integrar T38 para efeitos repetíveis.

#### Scenario: Estimativa desconhecida
- **WHEN** o usuário solicita organizar cards sem indicar pontos ou prazo
- **THEN** o agente apresenta lacunas e solicita decisão para esses valores sem preenchê-los automaticamente

#### Scenario: Grupo vazio
- **WHEN** o grupo não contém IDs
- **THEN** nenhuma mutação é preparada ou executada

#### Scenario: Alteração concorrente
- **WHEN** um campo relevante muda entre consulta/aprovação e commit
- **THEN** a correção retorna conflito sem sobrescrever a mudança e exige nova prévia

### Requirement: Segurança da consulta e do resultado
O sistema SHALL exigir acesso de leitura ao projeto e revalidá-lo em cada página, abertura e correção. Resultados SHALL ser vinculados a tenant/projeto/ator; referências do cliente SHALL NOT conceder permissão. Correções SHALL respeitar a política existente de mutação.

#### Scenario: resultId de outro ator ou tenant
- **WHEN** o cliente tenta consultar ou abrir um resultado que não lhe pertence
- **THEN** o servidor recusa sem expor IDs, contagens ou conteúdo

