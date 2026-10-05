## ADDED Requirements

### Requirement: Publicação do foco pelas modais e controles internos

O sistema SHALL publicar, por aba do navegador, o foco corrente composto pela **pilha ordenada de modais** (cada nível com item e tipo), pelo **item em primeiro plano**, pela **aba/área ativa** do item e pelo **objeto interno selecionado** (checklist/etapa, link, apontamento de trabalho ou anexo). Os controles internos SHALL publicar o objeto selecionado quando houver seleção explícita; desmontar uma modal SHALL remover seu nível da pilha e restaurar o foco anterior. O foco SHALL NOT vazar para outras abas nem ser persistido de forma durável.

#### Scenario: Abrir subtarefa empilha o foco

- **WHEN** o usuário abre uma subtarefa a partir da modal do pai
- **THEN** o foco passa a ter dois níveis, com a subtarefa em primeiro plano

#### Scenario: Fechar a subtarefa restaura o pai

- **WHEN** o usuário fecha a subtarefa empilhada
- **THEN** o foco volta ao nível do pai como item em primeiro plano

#### Scenario: Seleção de objeto interno

- **WHEN** o usuário seleciona uma checklist, um link ou um apontamento na aba correspondente
- **THEN** o foco publica o objeto interno selecionado com seu tipo e identificador

#### Scenario: Isolamento por aba

- **WHEN** duas abas do navegador estão abertas no mesmo projeto
- **THEN** cada aba mantém seu próprio foco, sem interferência

### Requirement: Resolução do item em primeiro plano

Na resolução de “este card”, “aqui” e expressões equivalentes, o sistema SHALL usar o **item em primeiro plano** da pilha de modais (a subtarefa aberta sobre o pai), e SHALL usar o item da mensagem ou da modal principal apenas quando não houver foco. O sistema MUST NOT usar a modal principal quando houver um item de nível superior em primeiro plano.

#### Scenario: “Este card” com subtarefa aberta

- **WHEN** o usuário pede “mude o prazo deste card” com uma subtarefa aberta sobre o pai
- **THEN** o alvo resolvido é a subtarefa, não o pai

#### Scenario: Sem foco, usa o item da mensagem

- **WHEN** não há foco publicado e a mensagem carrega um `itemId`
- **THEN** o alvo resolvido é o item da mensagem

### Requirement: Resolução de aba e objeto interno com pergunta em ambiguidade

Quando o pedido depender da aba ativa ou de um objeto interno, o sistema SHALL usar o objeto selecionado publicado no foco. Quando houver mais de um candidato plausível (ex.: várias checklists ou vários apontamentos) e nenhuma seleção explícita, o sistema SHALL fazer uma **pergunta curta** para desambiguar e MUST NOT escolher arbitrariamente a primeira ou a última entrada.

#### Scenario: Pedido na aba Checklists

- **WHEN** o usuário pede “adicione validar rollback nesta lista” com a aba Checklists ativa e uma checklist selecionada
- **THEN** o alvo é a checklist selecionada

#### Scenario: Ambiguidade pergunta

- **WHEN** o usuário pede para corrigir “este apontamento” e há vários apontamentos sem seleção explícita
- **THEN** o agente pergunta qual apontamento antes de agir

#### Scenario: Correção na aba Atividade

- **WHEN** o usuário pede “corrija este apontamento para 45 minutos” com um apontamento selecionado
- **THEN** o alvo é o apontamento selecionado

### Requirement: Foco no contexto autoritativo do modelo

O servidor SHALL incluir o **foco** da fotografia no contexto autoritativo formatado para o modelo (pilha de modais, item em primeiro plano, aba ativa e objeto interno), respeitando os limites de payload. O foco SHALL ser fixado na execução junto do snapshot, e a retomada da fila SHALL preservar o mesmo foco.

#### Scenario: Foco presente no prompt

- **WHEN** o servidor processa a mensagem com foco publicado
- **THEN** o contexto formatado para o modelo inclui a pilha de modais, o item em primeiro plano e a aba/objeto ativo

#### Scenario: Foco fixado na execução

- **WHEN** o usuário navega após o envio
- **THEN** a execução pendente continua usando o foco capturado no envio

### Requirement: Validação de acesso aos identificadores do foco

IDs e seleções recebidos da tela SHALL ser tratados como **referências a validar**, nunca como permissões. O servidor SHALL validar projeto, tenant e acesso antes de usar o item, a checklist, o link ou o apontamento do foco; sem acesso, o sistema SHALL recusar sem revelar conteúdo.

#### Scenario: Item do foco sem acesso

- **WHEN** o item em primeiro plano pertence a projeto/tenant sem vínculo do autor
- **THEN** o servidor recusa a resolução e não revela o conteúdo

#### Scenario: Objeto interno de outro item

- **WHEN** o objeto interno do foco não pertence ao item em primeiro plano
- **THEN** o servidor recusa o uso do objeto como alvo

### Requirement: Internacionalização da pergunta de ambiguidade

O sistema SHALL fornecer traduções em PT-BR, EN e ES para a pergunta de ambiguidade e para os rótulos de resolução do foco exibidos no chat.

#### Scenario: Idioma do chat

- **WHEN** o usuário troca o idioma da interface
- **THEN** a pergunta de ambiguidade e os rótulos de resolução são exibidos no idioma selecionado
