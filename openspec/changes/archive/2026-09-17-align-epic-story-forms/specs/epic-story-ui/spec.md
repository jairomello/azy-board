## MODIFIED Requirements

### Requirement: EpicModal — criação e edição de épicos
O sistema SHALL fornecer `EpicModal` em diálogo amplo e responsivo, com cabeçalho contextual, navegação por áreas, painel de propriedades e ações fixas de Cancelar e Salvar. As áreas SHALL ser Detalhes, Histórias e Histórico, iniciando em Detalhes. Campos: Título, Módulo (select de módulos do projeto), Versão (opcional) e Descrição rica; Código do item permanece editável na área de informações do painel de propriedades. Checklists e diário de trabalho NÃO SHALL ser exibidos nesta modal.

#### Scenario: Editar épico existente
- **WHEN** usuário clica no ícone de edição no header da swimlane de um EPIC
- **THEN** `EpicModal` abre em modo de edição com os dados do épico preenchidos e inicia na área Detalhes

#### Scenario: Layout e áreas do épico
- **WHEN** `EpicModal` é aberta em criação ou edição
- **THEN** o diálogo exibe cabeçalho com ícone do tipo, título editável inline e código, navegação acessível entre Detalhes, Histórias e Histórico, painel de propriedades e rodapé fixo com Cancelar e Salvar

#### Scenario: Salvar épico
- **WHEN** usuário confirma o formulário da EpicModal
- **THEN** sistema chama `POST /projects/:id/items` (criação) ou `PATCH /projects/:id/items/:id` (edição) com título, módulo, descrição, versão e código, e atualiza o board em tempo real

#### Scenario: Criar épico
- **WHEN** usuário abre `+ Novo Épico`, informa título e módulo válidos e confirma
- **THEN** item é criado via `POST /projects/:id/items` com `type = EPIC` e a nova swimlane aparece no board

#### Scenario: Responsividade e ações fixas do épico
- **WHEN** `EpicModal` é aberta em viewport desktop ou móvel
- **THEN** desktop mostra conteúdo e propriedades lado a lado; móvel empilha as áreas, mantém Cancelar e Salvar acessíveis e não exige rolagem horizontal

---

### Requirement: StoryModal — criação e edição de histórias com campos ágeis e rich text
O sistema SHALL fornecer `StoryModal` em diálogo amplo e responsivo, com cabeçalho contextual, navegação por áreas, painel de propriedades e ações fixas de Cancelar e Salvar. As áreas SHALL ser Detalhes, Tasks e Histórico, iniciando em Detalhes. Campos: Título, Épico pai (select), Versão (opcional) e Código na área de informações; narrativa Como/Eu quero/Para que, descrição, Critérios de Aceitação (editor Tiptap) e Notas (editor Tiptap) em Detalhes. Checklists e diário de trabalho NÃO SHALL ser exibidos nesta modal.

#### Scenario: Selecionar épico pai na StoryModal
- **WHEN** StoryModal é aberta em modo de criação
- **THEN** campo "Épico" exibe select com items do projeto onde `type = EPIC`

#### Scenario: Conteúdo rico em Detalhes
- **WHEN** usuário abre a área Detalhes de uma história
- **THEN** narrativa, descrição, critérios de aceitação e notas são exibidos para edição na área principal, enquanto Épico pai, Versão e Código ficam no painel de propriedades

#### Scenario: Layout e áreas da história
- **WHEN** `StoryModal` é aberta em criação ou edição
- **THEN** o diálogo exibe cabeçalho com ícone do tipo, título editável inline, navegação acessível entre Detalhes, Tasks e Histórico, painel de propriedades e rodapé fixo com Cancelar e Salvar

#### Scenario: Salvar história
- **WHEN** usuário confirma o formulário da StoryModal
- **THEN** sistema chama `POST /projects/:id/items` (criação) ou `PATCH /projects/:id/items/:id` (edição) com os campos ágeis e conteúdo rich text, sem alterar os valores nulos/opcionais atuais

---

### Requirement: Campo Versão opcional na EpicModal e StoryModal
O sistema SHALL exibir um campo "Versão" opcional no painel de propriedades da `EpicModal` e da `StoryModal`, permitindo associar épicos e histórias a versões do projeto.

#### Scenario: Selecionar versão em Épico
- **WHEN** usuário abre a `EpicModal` e o projeto possui versões cadastradas
- **THEN** campo "Versão" é exibido no painel de propriedades com select das versões disponíveis e opção "Sem versão"

#### Scenario: Selecionar versão em História
- **WHEN** usuário abre a `StoryModal` e o projeto possui versões cadastradas
- **THEN** campo "Versão" é exibido no painel de propriedades com select das versões disponíveis e opção "Sem versão"

#### Scenario: Salvar versão em Épico ou História
- **WHEN** usuário seleciona uma versão e salva
- **THEN** `versionId` é incluído no body do PATCH do respectivo item e persiste

#### Scenario: Campo Versão oculto quando projeto não tem versões
- **WHEN** projeto não possui versões cadastradas
- **THEN** campo "Versão" não é renderizado nas modais de Épico e História

## ADDED Requirements

### Requirement: Áreas relacionadas nas modais de épico e história
As modais de Épico e História SHALL oferecer as áreas de lista de filhos e Histórico, reutilizando os recursos existentes por `itemId` e mantendo contagens independentes por área. A área de filhos SHALL variar conforme o tipo: épico lista Histórias e história lista Tasks. Checklists NÃO SHALL ser exibidos e o diário de trabalho NÃO SHALL ser exibido, pois permanece exclusivo de task, subtask e bug.

#### Scenario: Filhos do épico
- **WHEN** usuário abre a área de filhos de um épico
- **THEN** sistema lista as histórias filhas via `GET /projects/:projectId/items/:itemId/children`, com título "Histórias" e estados de loading, vazio, erro e retry
- **AND** todos os filhos listados são do tipo `STORY`

#### Scenario: Filhos da história
- **WHEN** usuário abre a área de filhos de uma história
- **THEN** sistema lista as tasks filhas via `GET /projects/:projectId/items/:itemId/children`, com título "Tasks" e estados de loading, vazio, erro e retry

#### Scenario: Histórico de épico ou história
- **WHEN** usuário abre a área Histórico de um épico ou de uma história
- **THEN** sistema exibe apenas a auditoria de alterações (`/audit`), com contagem de eventos e paginação

#### Scenario: Sem checklists ou diário de trabalho
- **WHEN** usuário abre `EpicModal` ou `StoryModal`
- **THEN** nenhuma área ou ação de checklists ou de diário de trabalho é exibida

#### Scenario: Falha de consulta auxiliar não bloqueia o formulário
- **WHEN** a consulta de filhos ou de histórico falha
- **THEN** o painel afetado mostra erro e retry, e o usuário continua podendo editar e salvar os campos principais

#### Scenario: Abrir filho pelo tipo correto
- **WHEN** usuário clica em um filho na área de filhos de um épico ou história
- **THEN** sistema abre `StoryModal` quando o filho é `STORY` e `ItemModal` quando o filho é `TASK` ou `BUG`

### Requirement: Acessibilidade das modais de épico e história
As modais de Épico e História SHALL ser acessíveis por teclado e por leitores de tela, preservando foco, rótulos e empilhamento.

#### Scenario: Diálogo e abas acessíveis
- **WHEN** usuário abre `EpicModal` ou `StoryModal`
- **THEN** o diálogo expõe `role="dialog"`, `aria-modal` e título acessível; a navegação de áreas expõe `role="tab"`, `aria-selected` e `aria-controls`; o foco visível é preservado

#### Scenario: Cancelar sem salvar
- **WHEN** usuário clica em Cancelar, no X, no backdrop ou pressiona Escape
- **THEN** modal fecha sem persistir alterações locais, respeitando o fechamento do nível superior quando houver modal filha

#### Scenario: Trocar de área sem perder edição
- **WHEN** usuário edita um campo, alterna para a lista de filhos ou Histórico e retorna a Detalhes
- **THEN** o valor não salvo permanece no estado local da modal e pode ser salvo depois

### Requirement: Traduções das modais de épico e história
Os títulos de áreas, contagens, resumos, estados vazios, erros e labels das modais de Épico e História SHALL estar disponíveis em PT-BR, EN e ES.

#### Scenario: Idioma ativo
- **WHEN** usuário troca o idioma da interface
- **THEN** textos e controles das modais de Épico e História aparecem no idioma selecionado

#### Scenario: Cores não são a única indicação
- **WHEN** tipo, status ou prioridade são apresentados
- **THEN** a indicação é textual e acessível, sem depender apenas de cor
