## Purpose

Definir o contrato versionado dos comandos de interface emitidos pela conversa e sua aplicação idempotente na aba de origem, isolada por aba e à frente da preferência durável.

## Requirements
### Requirement: Comandos tipados de interface
O sistema SHALL definir um contrato versionado de comandos de interface emitidos pela conversa, cobrindo: aplicar/substituir filtros, limpar filtros, definir o modo de visualização (Kanban ou árvore) e o módulo ativo, abrir um item e voltar à visão anterior. Cada comando SHALL carregar um identificador único, o tipo e o alvo, e SHALL produzir um resultado de sucesso ou erro sem mutar dados. IDs e filtros recebidos da tela SHALL ser tratados como referências a validar, nunca como permissões.

#### Scenario: Comando de filtro tipado
- **WHEN** o agente emite um comando para aplicar filtros (ex.: tipo = Bug e versão sem valor)
- **THEN** o comando é expresso como estrutura tipada, com ausência de valor por operador e não pelo sentinela da interface como nome de entidade

#### Scenario: Comando inválido não altera a tela
- **WHEN** o comando referencia projeto sem acesso, item inexistente ou operação desconhecida
- **THEN** o comando é recusado com resultado de erro acionável e a visualização permanece inalterada

### Requirement: Superfície do agente somente-leitura e fora do catálogo MCP
As ferramentas de interface SHALL ser declaradas no catálogo do assistente como operações somente-leitura de um domínio de UI, dispensando aprovação por não mutarem dados, e SHALL NOT ser expostas no catálogo MCP de agentes.

#### Scenario: Comando de UI não exige aprovação
- **WHEN** o modelo emite um comando de interface
- **THEN** o harness o normaliza e o entrega sem pedir aprovação, pois não há mutação de dados

#### Scenario: Ferramenta de UI ausente do catálogo MCP
- **WHEN** um agente autenticado por API Key consulta o catálogo MCP
- **THEN** as ferramentas de interface não aparecem entre as ferramentas disponíveis

### Requirement: Entrega idempotente na aba de origem
O comando normalizado SHALL ser transportado pelo canal de execução do run já existente e SHALL ser aplicado apenas na aba que iniciou o pedido. Reconexão, replay ou retomada SHALL NOT aplicar o mesmo comando mais de uma vez.

#### Scenario: Aplicação apenas na aba que pediu
- **WHEN** um comando é emitido por um run iniciado na aba A
- **THEN** somente a aba A aplica o comando; outras abas abertas no mesmo projeto não são alteradas

#### Scenario: Reconexão não duplica comando
- **WHEN** a conexão do stream cai e o cliente reconecta por cursor
- **THEN** o comando já aplicado não é reaplicado

### Requirement: Aplicação na interface com confirmação
O frontend SHALL aplicar o comando sobre o estado de visão com a mesma semântica do toolbar do board (incluindo o operador de ausência de valor) e SHALL confirmar no chat o recorte resultante, em conformidade com o escopo interpretado. Aplicar filtros SHALL substituir o conjunto vigente salvo indicação explícita de limpeza.

#### Scenario: Pedido “mostre meus bugs sem versão”
- **WHEN** o usuário pede para mostrar apenas seus bugs sem versão
- **THEN** a interface aplica os filtros correspondentes e o chat confirma o recorte aplicado

#### Scenario: Alternância de visualização
- **WHEN** o usuário pede para ver a árvore (ou voltar ao Kanban)
- **THEN** a visualização alterna no cliente sem recarregar a página e o chat confirma

#### Scenario: Abertura de card
- **WHEN** o usuário pede para abrir um card
- **THEN** a modal do item é aberta para o item validado e o deep-link por item continua funcionando

### Requirement: Voltar à visão anterior
O sistema SHALL manter, por aba, uma pilha limitada de checkpoints da visão (filtros, modo, módulo ativo e item aberto) registrada antes de cada mudança, e um comando SHALL restaurar o checkpoint mais recente. Restaurar SHALL NOT cruzar projetos nem abas.

#### Scenario: Voltar após aplicar um filtro
- **WHEN** o usuário pede para voltar à visão anterior após um filtro aplicado pela conversa
- **THEN** o estado de visão anterior (filtros, modo, módulo e item aberto) é restaurado

#### Scenario: Pilha limitada
- **WHEN** o número de checkpoints excede o limite definido
- **THEN** os checkpoints mais antigos são descartados sem erro

### Requirement: Isolamento por aba e precedência sobre a preferência durável
O estado de visão aplicado SHALL viver numa camada de sessão por aba do navegador e SHALL NOT ser gravado na persistência durável de preferências nem vazar para outras abas. A preferência durável do usuário SHALL permanecer, com a camada de sessão prevalecendo enquanto existir na aba.

#### Scenario: Filtro aplicado não vaza entre abas
- **WHEN** um filtro é aplicado pela conversa em uma aba
- **THEN** outra aba do mesmo projeto mantém seu próprio estado de filtros e visualização

#### Scenario: Preferência durável preservada
- **WHEN** a sessão da aba termina ou é recarregada sem comando
- **THEN** a preferência durável do usuário continua sendo restaurada normalmente

### Requirement: Internacionalização dos comandos de interface
O sistema SHALL fornecer traduções em PT-BR, EN e ES para os rótulos de confirmação e de erro dos comandos de interface exibidos no chat.

#### Scenario: Idioma do chat
- **WHEN** o usuário troca o idioma da interface
- **THEN** as mensagens de confirmação e de erro dos comandos são exibidas no idioma selecionado
