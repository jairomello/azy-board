# card-visibility-explanation Specification

## Purpose
TBD - created by archiving change explain-card-visibility. Update Purpose after archive.
## Requirements
### Requirement: Avaliador compartilhado de visibilidade

O sistema SHALL prover uma função compartilhada de avaliação de visibilidade que, dado um item e o estado de visão corrente (filtros de população, aba de módulo ativa, grupos recolhidos, regra de folha/subtarefas, exibição de histórias, ocultação de grupos vazios e arquivamento), retorne `visible` e uma lista ordenada de motivos tipados. A mesma função SHALL ser a fonte única usada pela interface do board e pelo agente. O avaliador MUST NOT inferir exclusão apenas pela ausência do item na lista de exibição.

#### Scenario: Item excluído por filtro de população

- **WHEN** um filtro ativo exclui o item (ex.: `Sem versão` e o item possui `versionId`)
- **THEN** o avaliador retorna `visible = false` com um motivo `FILTER` identificando o campo e o valor responsável

#### Scenario: Item arquivado

- **WHEN** o item está arquivado e fora da população carregada
- **THEN** o avaliador retorna `visible = false` com o motivo `ARCHIVED`

#### Scenario: Item dentro de grupo recolhido

- **WHEN** o item pertence a um épico, história ou módulo recolhido, mas permanece no resultado
- **THEN** o avaliador retorna `visible = false` com o motivo `COLLAPSED_GROUP` e identifica o grupo

#### Scenario: Item subtarefa com regra de folha

- **WHEN** o item é subtarefa e a visão está com `showSubtasks = false`
- **THEN** o avaliador retorna `visible = false` com o motivo `SUBTASK_HIDDEN`

#### Scenario: Item em aba de módulo diferente

- **WHEN** o épico do item pertence a módulo diferente da aba ativa e `moduleViewMode = 'tabs'`
- **THEN** o avaliador retorna `visible = false` com o motivo `MODULE_TAB` identificando o módulo

#### Scenario: Item visível sem motivos

- **WHEN** nenhum filtro, grupo, regra de apresentação ou arquivamento exclui o item
- **THEN** o avaliador retorna `visible = true` com lista de motivos vazia

#### Scenario: Item desconhecido ou fora do projeto

- **WHEN** não é possível determinar a visibilidade com o estado disponível, ou o item não pertence ao projeto atual
- **THEN** o avaliador retorna `visible = false` com o motivo `UNKNOWN`, sem afirmar que o item foi excluído

### Requirement: Explicação da causa no chat

O Azy Agent SHALL responder a perguntas como “por que o card X não aparece?” resolvendo o item por identificador ou `sequenceCode`, avaliando-o com a fotografia da tela e apresentando a causa comprovada. Quando houver mais de um motivo, a resposta SHALL listá-los na ordem determinística da taxonomia. Quando a visibilidade não puder ser determinada, o agente SHALL declarar isso explicitamente em vez de inferir exclusão.

#### Scenario: Explicação de filtro responsável

- **WHEN** o usuário pergunta por que um card não aparece e um filtro ativo o exclui
- **THEN** o agente responde com o campo e o valor do filtro responsável em linguagem natural

#### Scenario: Múltiplos motivos

- **WHEN** o item é excluído por mais de um motivo simultaneamente
- **THEN** o agente lista os motivos na ordem determinística da taxonomia

#### Scenario: Causa indeterminada

- **WHEN** o estado disponível não permite determinar o motivo
- **THEN** o agente informa que não foi possível determinar e não afirma que o card foi excluído

### Requirement: Oferta de exibição preservando a visão anterior

O sistema SHALL oferecer revelar o item citado neutralizando somente os motivos responsáveis (trocar a aba de módulo, expandir o grupo, desligar o filtro ou a regra de apresentação), registrando um checkpoint da visão anterior e abrindo o item. A revelação SHALL NOT mutar dados e a visão anterior SHALL ser restaurável pelo comando de voltar à visão anterior.

#### Scenario: Revelar item escondido por filtro

- **WHEN** o usuário aceita mostrar um card excluído por um filtro ativo
- **THEN** o filtro responsável é desligado, um checkpoint é registrado e o item é aberto

#### Scenario: Revelar item em grupo recolhido

- **WHEN** o usuário aceita mostrar um card dentro de um grupo recolhido
- **THEN** o grupo é expandido, o checkpoint é registrado e o item é aberto

#### Scenario: Restaurar a visão anterior

- **WHEN** o usuário pede para voltar à visão anterior após uma revelação
- **THEN** o estado de visão anterior (filtros, modo, módulo, grupos e item aberto) é restaurado

#### Scenario: Revelação não altera dados

- **WHEN** a revelação é aplicada
- **THEN** nenhum item, coluna ou relação é alterado no servidor

### Requirement: Guarda de acesso ao projeto

A explicação e a revelação SHALL validar o acesso ao projeto e ao item antes de responder ou exibir conteúdo. Sem acesso, o sistema SHALL retornar o motivo `ACCESS_DENIED` e MUST NOT revelar título, descrição ou qualquer dado do item. Identificadores e filtros recebidos da tela SHALL ser tratados como referências a validar, nunca como permissões.

#### Scenario: Item sem acesso do autor

- **WHEN** o usuário pergunta por um item de projeto sem vínculo de acesso
- **THEN** o sistema responde `ACCESS_DENIED` sem revelar o conteúdo do item

#### Scenario: ID de outro tenant ou projeto

- **WHEN** o item referenciado pertence a outro tenant ou projeto inacessível
- **THEN** o sistema recusa a explicação e não confirma a existência do item

### Requirement: Taxonomia determinística e internacionalização

Os motivos de visibilidade SHALL ser códigos tipados e estáveis, ordenados de forma determinística (`ACCESS_DENIED` > `ARCHIVED` > `FILTER` > `MODULE_TAB` > `SUBTASK_HIDDEN` > `EMPTY_GROUP_HIDDEN` > `COLLAPSED_GROUP` > `UNKNOWN`), com o texto humano derivado por internacionalização. O sistema SHALL fornecer traduções em PT-BR, EN e ES para os rótulos dos motivos e da oferta de revelação.

#### Scenario: Ordem determinística

- **WHEN** o item possui motivos de categorias diferentes
- **THEN** eles são apresentados na ordem definida pela taxonomia, independentemente da ordem de avaliação

#### Scenario: Idioma do chat

- **WHEN** o usuário troca o idioma da interface
- **THEN** os rótulos dos motivos e da oferta de revelação são exibidos no idioma selecionado

### Requirement: Degradação sem estado de apresentação

Quando a fotografia da tela não carregar o estado de apresentação necessário (regra de folha/subtarefas, exibição de histórias, modo de módulos e ocultação de grupos vazios), o avaliador SHALL explicar apenas os motivos determináveis e SHALL NOT inventar regras de apresentação. A ausência desses campos MUST NOT causar erro nem bloquear a explicação dos filtros de população e do arquivamento.

#### Scenario: Snapshot sem estado de apresentação

- **WHEN** a fotografia não inclui o estado de apresentação
- **THEN** a explicação cobre os motivos determináveis e marca como `UNKNOWN` o que dependeria das regras ausentes

