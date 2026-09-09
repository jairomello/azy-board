## Purpose

Definir o roteamento adaptativo de tools do Azy Agent por contexto, capability, alvo e policy.

## Requirements

### Requirement: Metadados hierárquicos de capability
O sistema SHALL classificar cada tool nominal por domínio, escopo, operação, risco, dependências, tipos de alvo e policy. A hierarquia SHALL apoiar busca e priorização sem substituir tools nominais por uma tool-fachada.

#### Scenario: Tool classificada
- **WHEN** `create_task` é carregada do registry
- **THEN** a definição informa domínio Items, alvo de projeto/item, operação create, risco de mutação, dependencies e policy mínima

#### Scenario: Tool de escrita
- **WHEN** `claim_task`, `create_checklist`, `add_checklist_item` ou `check_item` é carregada
- **THEN** ela é classificada como escrita e não como leitura

#### Scenario: Catálogo incompleto
- **WHEN** uma tool não possui metadata, schema, validator, policy ou dispatcher coerente
- **THEN** o teste de catálogo falha antes da publicação

### Requirement: Contexto como prioridade e alvo padrão
O sistema SHALL usar tela, projeto e item atuais para ordenar tools e preencher alvos ausentes. O contexto visual MUST NOT bloquear uma capability autorizada solicitada explicitamente.

#### Scenario: Pedido local no board
- **WHEN** usuário pede para criar uma task sem informar projeto enquanto está no board
- **THEN** o agente prioriza Items e usa o projeto/item atuais como alvo padrão

#### Scenario: Novo projeto solicitado no board
- **WHEN** usuário autorizado pede explicitamente para criar um novo projeto enquanto está dentro de outro projeto
- **THEN** o agente carrega a capability Projects e executa a criação sem exigir mudança de tela

#### Scenario: Outro projeto explícito
- **WHEN** usuário menciona outro projeto de forma inequívoca
- **THEN** o sistema resolve e valida o projeto mencionado antes de substituir o projeto atual como alvo

#### Scenario: Item chamado Projetos
- **WHEN** título ou conteúdo de um item contém a palavra "Projetos"
- **THEN** esse dado não é interpretado como intenção de criar ou trocar projeto

### Requirement: Precedência determinística de alvo
O sistema SHALL aplicar a ordem recurso explicitamente informado e resolvido, item selecionado, projeto atual e pergunta de esclarecimento. Uma mutação MUST NOT usar alvo implícito quando existir ambiguidade relevante.

#### Scenario: Alvo explícito prevalece
- **WHEN** a mensagem identifica um projeto acessível diferente do projeto atual
- **THEN** o preview e a execução usam o projeto explicitamente resolvido

#### Scenario: Contexto preenche ausência
- **WHEN** a mensagem não identifica projeto ou item e a tela fornece um alvo válido
- **THEN** o alvo atual é injetado server-side nos argumentos

#### Scenario: Dois alvos plausíveis
- **WHEN** nome ou intenção corresponde a mais de um recurso acessível
- **THEN** o agente pergunta qual alvo usar antes de criar preview ou mutação

### Requirement: Progressive disclosure de tools
O provider SHALL receber inicialmente apenas schemas prováveis pelo contexto e intenção. O sistema SHALL poder carregar dependencies e tools de outros domínios autorizados durante a mesma run quando necessário para concluir o pedido.

#### Scenario: Tool presente no conjunto inicial
- **WHEN** a intenção pode ser executada pelas tools primárias
- **THEN** o agente não carrega domínios adicionais

#### Scenario: Capability de outro domínio
- **WHEN** pedido explícito exige uma tool fora do conjunto inicial
- **THEN** o resolver encontra a tool no índice permitido, adiciona seu schema e continua a run

#### Scenario: Dependência para resolver nome
- **WHEN** uma mutação exige converter nome de módulo, projeto ou coluna em ID
- **THEN** as dependency tools read-only necessárias são carregadas antes da mutação

#### Scenario: Tool proibida
- **WHEN** uma capability encontrada exige permissão que o usuário não possui
- **THEN** ela não é carregada e o agente explica a restrição real

### Requirement: Recuperação automática de erros
O harness SHALL devolver erros recuperáveis e sanitizados ao modelo como function output, permitindo resolver dependências, corrigir argumentos e tentar novamente dentro dos limites. Erros terminais MUST encerrar a run.

#### Scenario: Módulo ausente
- **WHEN** uma criação hierárquica falha porque o módulo não existe
- **THEN** o agente pode carregar `create_module` ou usar o comportamento de auto-criação e repetir o batch sem pedir trabalho manual

#### Scenario: Projeto duplicado
- **WHEN** `create_project` retorna conflito de nome
- **THEN** o agente pesquisa o projeto existente e continua ou pergunta somente se o objetivo permanecer ambíguo

#### Scenario: Argumento inválido
- **WHEN** uma tool retorna erro tipado de validação com orientação segura
- **THEN** o agente corrige os argumentos e tenta novamente com assinatura diferente

#### Scenario: Falta de permissão
- **WHEN** a execução retorna permission denied ou tenant mismatch
- **THEN** a run não tenta contornar a restrição e apresenta explicação segura

#### Scenario: Repetição sem progresso
- **WHEN** o agente repete a mesma assinatura sem alterar contexto ou argumentos
- **THEN** o harness encerra a tentativa para impedir loop e custo indevido

### Requirement: Limitação apenas após busca e recuperação
O sistema SHALL declarar uma capability indisponível somente depois de pesquisar o catálogo permitido e esgotar recuperação segura. Navegação SHALL ser oferecida como conveniência, não como requisito para tool executável.

#### Scenario: Capability não carregada inicialmente
- **WHEN** a tool existe e o usuário tem permissão
- **THEN** o sistema a carrega dinamicamente em vez de responder que ela não está disponível naquela tela

#### Scenario: Capability não implementada
- **WHEN** não existe tool registrada após a busca
- **THEN** o agente explica a limitação e pode indicar o caminho manual disponível

#### Scenario: Informação obrigatória ausente
- **WHEN** a capacidade existe mas o alvo obrigatório não pode ser inferido ou resolvido
- **THEN** o agente faz uma pergunta curta e específica
