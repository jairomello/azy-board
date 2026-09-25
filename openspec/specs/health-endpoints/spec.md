## ADDED Requirements

### Requirement: Liveness público

A API SHALL expor `GET /health/live`, sem autenticação e sem dados de tenant, respondendo HTTP 200 enquanto o processo está apto a atender requisições. A resposta SHALL conter apenas o estado do processo, sem versões, caminhos ou identificadores internos.

#### Scenario: Processo ativo
- **WHEN** um cliente consulta `GET /health/live` com o servidor em execução
- **THEN** a API responde HTTP 200 com um corpo mínimo de estado

#### Scenario: Endpoint público sem dados sensíveis
- **WHEN** um cliente não autenticado consulta `GET /health/live`
- **THEN** a resposta é atendida sem exigir credenciais e não expõe informações de tenant, versão ou infraestrutura

### Requirement: Readiness com verificação de dependências

A API SHALL expor `GET /health/ready`, sem autenticação, verificando as dependências necessária para atender o tráfego: banco de dados, diretório de storage e, no perfil ADVANCED, o serviço de coordenação. Quando todas as dependências responderem, o endpoint SHALL retornar HTTP 200; quando qualquer uma falhar, SHALL retornar HTTP 503 listando apenas os nomes das dependências indisponíveis. No perfil SIMPLE, a indisponibilidade de serviço de coordenação externa SHALL NOT afetar o resultado.

#### Scenario: Tudo disponível
- **WHEN** banco, storage e (no ADVANCED) coordenação respondem às verificações
- **THEN** `GET /health/ready` retorna HTTP 200

#### Scenario: Banco indisponível
- **WHEN** a verificação do banco de dados falha
- **THEN** `GET /health/ready` retorna HTTP 503 com o nome da dependência de banco listada como indisponível

#### Scenario: Perfil ADVANCED sem coordenação
- **WHEN** o perfil ADVANCED tem o serviço de coordenação indisponível
- **THEN** `GET /health/ready` retorna HTTP 503 indicando a dependência de coordenação

#### Scenario: Perfil SIMPLE não depende de coordenação
- **WHEN** o perfil SIMPLE responde readiness sem serviço externo
- **THEN** `GET /health/ready` retorna HTTP 200 baseado apenas em banco e storage

### Requirement: Uso operacional dos health endpoints

Os health endpoints SHALL ser consumidos pela verificação de smoke e referenciados na documentação e nos healthchecks de deploy como alvo de monitoramento da aplicação.

#### Scenario: Smoke valida liveness
- **WHEN** a verificação de smoke é executada contra uma instância
- **THEN** ela valida que `GET /health/live` responde HTTP 200

#### Scenario: Healthcheck de deploy aponta readiness
- **WHEN** o operador configura healthchecks de deploy conforme a documentação
- **THEN** a documentação indica `GET /health/ready` como alvo de readiness
