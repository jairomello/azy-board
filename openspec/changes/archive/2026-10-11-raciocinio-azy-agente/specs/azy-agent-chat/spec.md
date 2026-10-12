## ADDED Requirements

### Requirement: Atividade do run em accordion vertical
O chat SHALL apresentar as etapas de execução de um run dentro de um accordion posicionado abaixo da mensagem do usuário, recolhido por padrão, em que o primeiro item é o nome do modelo em uso e as etapas (ferramentas e status) aparecem empilhadas verticalmente. A abertura do accordion SHALL ser controlada pelo usuário e o conteúdo SHALL expor apenas as etapas de execução, nunca o raciocínio privado do modelo.

#### Scenario: Consultar as etapas do run
- **WHEN** o usuário abre o accordion de atividade de um run
- **THEN** o primeiro item exibido é o nome do modelo em uso e as etapas seguintes aparecem uma abaixo da outra, com os rótulos amigáveis fornecidos pelo servidor

#### Scenario: Accordion recolhido por padrão
- **WHEN** um run é iniciado ou exibido
- **THEN** o accordion permanece recolhido, mostrando apenas o cabeçalho, sem revelar as etapas até o usuário expandir

#### Scenario: Acessível por teclado
- **WHEN** o usuário navega por teclado pelo chat
- **THEN** consegue focar e acionar o cabeçalho do accordion, recebendo retorno de estado expandido ou recolhido

#### Scenario: Nenhuma etapa disponível
- **WHEN** o run ainda não produziu etapas
- **THEN** o accordion permanece recolhido e não exibe conteúdo vazio nem etapas inventadas

### Requirement: Indicador de processamento sincronizado ao estado do run
O cabeçalho do accordion de atividade SHALL exibir um rótulo localizado de processamento acompanhado de um indicador animado enquanto o run estiver em andamento, e SHALL interromper a animação quando o run atingir um estado terminal ou de espera. O estado apresentado SHALL refletir o status real do run.

#### Scenario: Processamento em andamento
- **WHEN** o run está em execução
- **THEN** o cabeçalho mostra o rótulo de processamento e o indicador animado

#### Scenario: Processamento concluído
- **WHEN** o run atinge estado terminal concluído, falho, cancelado ou expirado
- **THEN** a animação para e o cabeçalho deixa de indicar processamento ativo

#### Scenario: Aguardando interação do usuário
- **WHEN** o run está aguardando resposta do usuário ou decisão de aprovação
- **THEN** a animação de processamento para e a interface destaca a ação pendente
