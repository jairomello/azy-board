## ADDED Requirements

### Requirement: Configuração Root de provider OpenAI
O sistema SHALL permitir que usuário `ROOT` configure, teste, ative, substitua e revogue uma configuração OpenAI por tenant, com modelo, modalidade de credencial e parâmetros operacionais validados.

#### Scenario: Root configura API key
- **WHEN** Root informa modelo e API key válida e executa teste de conexão
- **THEN** o servidor valida a credencial, armazena somente a versão cifrada e ativa a configuração sem retornar a chave completa

#### Scenario: Usuário não Root gerencia provider
- **WHEN** usuário que não é Root tenta criar, ativar, testar ou revogar provider
- **THEN** a API retorna `403` sem revelar credenciais ou configuração protegida

### Requirement: Credenciais não são expostas
Credenciais API key, access token e refresh token SHALL ser cifradas em repouso, acessíveis somente no backend, redigidas de logs/telemetria e nunca retornadas ao browser, ao chat ou a respostas de erro.

#### Scenario: Consulta de configuração
- **WHEN** Root consulta o provider configurado
- **THEN** a resposta contém status, provider, modelo, modalidade, prefixo mascarado e datas, mas não contém segredo recuperável

#### Scenario: Credencial é revogada
- **WHEN** Root revoga uma credencial ativa
- **THEN** novas chamadas ao modelo falham de forma segura, o assistente fica não configurado e o token cifrado deixa de ser utilizável

### Requirement: Arquitetura de provider extensível
O contrato de configuração SHALL representar provider, modelo, modalidade de autenticação e capacidades sem acoplar tabelas, chat ou harness a OpenAI, permitindo futuros adapters sem alterar o contrato do frontend.

#### Scenario: Provider OpenAI é selecionado
- **WHEN** uma run resolve sua configuração ativa
- **THEN** o registry seleciona o adapter OpenAI pelas capacidades declaradas e não por lógica espalhada em rotas
