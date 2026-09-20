## ADDED Requirements

### Requirement: Mensagem genérica em produção

O boundary de renderização SHALL exibir uma mensagem genérica e traduzida quando uma exceção for capturada em produção, sem renderizar `error.message` nem `error.stack`. Em desenvolvimento, o boundary SHALL poder exibir a mensagem e o stack do erro para depuração. O detalhamento do erro SHALL ser determinado por uma flag de ambiente injetável, e não por uma condição implícita no componente.

#### Scenario: Erro de renderização em produção
- **WHEN** um componente lança durante a renderização com o app em modo de produção
- **THEN** a tela de erro mostra a mensagem genérica e o identificador de referência
- **AND** não mostra `error.message`, `error.stack` nem nomes internos de módulos

#### Scenario: Erro de renderização em desenvolvimento
- **WHEN** um componente lança durante a renderização com o app em modo de desenvolvimento
- **THEN** a tela de erro mostra a mensagem e o stack para depuração, além do identificador de referência

#### Scenario: Flag de ambiente controlável
- **WHEN** o boundary é montado com a flag de produção explicitamente ligada ou desligada
- **THEN** o detalhamento exibido segue a flag informada, independentemente do ambiente do processo de teste

### Requirement: Identificador de referência por ocorrência

Ao capturar um erro, o boundary SHALL gerar um identificador de referência único para aquela ocorrência, exibi-lo na tela de erro em formato curto e legível e registrá-lo junto do erro para correlação com a observabilidade. O identificador SHALL permanecer o mesmo enquanto a tela de erro daquela ocorrência estiver visível e SHALL ser renovado quando o boundary for reiniciado.

#### Scenario: Exibição da referência
- **WHEN** um erro é capturado
- **THEN** a tela mostra o identificador de referência com um rótulo que orienta o usuário a informá-lo ao suporte

#### Scenario: Referência estável durante a ocorrência
- **WHEN** a tela de erro é re-renderizada sem reset
- **THEN** o identificador exibido permanece o mesmo

#### Scenario: Nova ocorrência gera nova referência
- **WHEN** o usuário aciona "tentar novamente" e um novo erro é capturado
- **THEN** um novo identificador de referência é gerado para a nova ocorrência

### Requirement: Stack restrito à observabilidade

O boundary SHALL registrar o erro completo (referência, mensagem, stack e `componentStack`) apenas no sistema de observabilidade/console, nunca na interface em produção. O registro SHALL ser estruturado o suficiente para permitir a correlação pelo identificador de referência.

#### Scenario: Registro estruturado
- **WHEN** um erro é capturado
- **THEN** o registro inclui o identificador de referência, a mensagem, o stack e o `componentStack`, associados ao mesmo erro

#### Scenario: Sem vazamento na UI de produção
- **WHEN** o app está em produção
- **THEN** nenhuma parte do stack ou da mensagem original do erro aparece no DOM

### Requirement: Acessibilidade e recuperação

A tela de erro SHALL ser anunciada como alerta (`role="alert"`) e SHALL oferecer uma ação de recuperação que reinicia o estado do boundary, voltando a renderizar a aplicação.

#### Scenario: Anúncio para leitores de tela
- **WHEN** a tela de erro é exibida
- **THEN** o contêiner do erro tem `role="alert"`

#### Scenario: Recuperação pelo usuário
- **WHEN** o usuário aciona a ação de recuperação
- **THEN** o boundary limpa o estado de erro e tenta renderizar novamente os filhos

### Requirement: Textos traduzidos

Os textos da tela de erro SHALL ser obtidos do sistema de i18n e SHALL existir em pt-BR, en e es, sem literais fixos no componente.

#### Scenario: Paridade entre idiomas
- **WHEN** o app é executado em pt-BR, en ou es
- **THEN** os rótulos da tela de erro aparecem no idioma selecionado

#### Scenario: Ausência de texto fixo
- **WHEN** o código do boundary é inspecionado
- **THEN** não há strings de interface fixas fora dos arquivos de idioma
