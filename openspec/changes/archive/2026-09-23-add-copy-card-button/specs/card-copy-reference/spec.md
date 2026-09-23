## ADDED Requirements

### Requirement: Botão copiar referência no card do Kanban
O card do Kanban SHALL exibir um botão de ação "Copiar referência", apenas com ícone (Lucide `Copy`), ao lado dos botões de arquivar e excluir, visível no hover do card. Ao ser acionado, o sistema SHALL copiar para a área de transferência um texto plano com aspas simples externas, no formato `'<código> - <título> [id=<uuid>]'` quando o item tiver `sequenceCode`, ou `'<título> [id=<uuid>]'` quando não tiver — sem incluir nenhum código de fallback. `<título>` é o título completo do card e `<uuid>` é o identificador completo do item. O tooltip e o rótulo de acessibilidade do botão SHALL deixar explícito que o texto é copiado para a área de transferência, para que o usuário não confunda a ação com a duplicação do card. Copiar é uma operação somente-leitura e SHALL estar disponível para todos os papéis com acesso ao board, inclusive VIEWER.

#### Scenario: Copiar referência de card com sequenceCode
- **WHEN** usuário aciona o botão de copiar em um card com `sequenceCode` "T5" e título "Opcionalmente tarefas do checklist com data"
- **THEN** a área de transferência recebe o texto `'T5 - Opcionalmente tarefas do checklist com data [id=<uuid completo do item>]'`

#### Scenario: Card sem sequenceCode
- **WHEN** usuário aciona o botão de copiar em um card sem `sequenceCode`
- **THEN** o texto copiado traz apenas o título e o id completo, no formato `'<título> [id=<uuid>]'`, sem nenhum código de fallback

#### Scenario: Botão visível no hover para todos os papéis
- **WHEN** o usuário passa o mouse sobre um card do board
- **THEN** o botão de copiar aparece junto dos demais botões de ação, inclusive para usuários com papel VIEWER

#### Scenario: Feedback de sucesso sem alterar o layout
- **WHEN** a cópia é concluída com sucesso
- **THEN** o ícone de copiar muda temporariamente para um ícone de confirmação e volta ao estado original, sem deslocar o conteúdo do card

#### Scenario: Não abrir o card ao copiar
- **WHEN** usuário clica no botão de copiar
- **THEN** o modal/detalhe do card não é aberto e o arraste não é iniciado

#### Scenario: Falha de clipboard tratada
- **WHEN** a área de transferência não está disponível ou a cópia falha
- **THEN** o sistema tenta o fallback e, se ainda falhar, informa o erro ao usuário sem quebrar o board nem lançar exceção não tratada

#### Scenario: Textos traduzidos e sem ambiguidade
- **WHEN** a interface está em pt-BR, en ou es
- **THEN** o tooltip e o rótulo de acessibilidade do botão mencionam explicitamente a cópia para a área de transferência e são exibidos no idioma correspondente
