Board ref: 932bd490-4503-42b3-9193-5327926fda33

## ADDED Requirements

### Requirement: Composição da API por perfil antes de aceitar tráfego
O composition root SHALL validar configuração e marcadores, selecionar somente adapters compatíveis e construir a API por ports tipados antes de aceitar tráfego. ADVANCED SHALL usar PostgreSQL real e coordenação Valkey/Redis, sem abrir SQLite, executar PRAGMA ou recorrer a fallback. SIMPLE SHALL continuar usando SQLite sem inicializar PostgreSQL/Valkey. Importar uma factory de aplicação SHALL NOT iniciar listener ou worker automaticamente.

#### Scenario: API ADVANCED inicia com serviços reais
- **WHEN** migrations/setup da instalação ADVANCED estão válidos e PostgreSQL/Valkey estão disponíveis
- **THEN** a API inicia sem `ADVANCED_DATABASE_ADAPTER_NOT_READY`, responde HTTP e não abre arquivo/conexão SQLite

#### Scenario: Boot SIMPLE independente
- **WHEN** a API inicia com perfil padrão SIMPLE e nenhuma infraestrutura externa
- **THEN** autenticação, projetos, itens e agente conservam o comportamento SQLite, sem tentativa de conexão PostgreSQL/Valkey

#### Scenario: Dependência transitiva incompatível
- **WHEN** uma rota ou serviço carregado no boot ADVANCED tenta usar driver/schema SQLite
- **THEN** o teste de bootstrap reprova o fluxo em vez de aceitar fallback ou remover a proteção do driver SIMPLE

### Requirement: Setup e lifecycle validam identidade da instalação
Setup, migrations e boot SHALL usar store de marcadores do dialect escolhido e validar banco, volume, perfil e revisão antes de escritas de negócio. Boot SHALL NOT criar tenant, executar conversão de perfil ou substituir marcador inválido. Inicialização parcial e shutdown SHALL fechar recursos e timers de sua responsabilidade sem afetar processos independentes.

#### Scenario: Marcador divergente ou volume ausente
- **WHEN** banco e volume divergem, ou banco marcado perdeu o marcador do volume
- **THEN** startup é recusado sem criar tenant, alterar dados ou sobrescrever marcador, com diagnóstico sem credenciais

#### Scenario: Instalação nova e migrations repetidas
- **WHEN** migrations e setup CLI ADVANCED são executados no fluxo suportado com banco/volume novos e migrations são reexecutadas
- **THEN** o schema e a identidade da instalação permanecem consistentes, sem reaplicar journal SQLite nem duplicar dados válidos

#### Scenario: Falha após abrir pool
- **WHEN** bootstrap falha na validação de storage/coordenação depois de abrir PostgreSQL
- **THEN** não aceita tráfego e fecha pool/conexões/timers já criados

#### Scenario: Troca de perfil tentada
- **WHEN** uma instalação marcada SIMPLE recebe configuração ADVANCED mesmo apontando para PostgreSQL vazio
- **THEN** a troca é recusada; ADVANCED exige outra instalação com banco e volume novos, sem transferência de dados

### Requirement: Readiness efetiva de todos os serviços requeridos
A API SHALL verificar banco/schema operacional, storage e coordenação injetados por probes limitados. Coordenação ausente ou indisponível em ADVANCED SHALL produzir HTTP 503, mesmo que persistence não possua uma propriedade coordination. Liveness SHALL permanecer independente e respostas públicas SHALL conter somente estado e nomes de dependências, sem segredos. SIMPLE SHALL NOT depender de coordenação externa.

#### Scenario: Todas as dependências disponíveis
- **WHEN** cliente consulta `/health/live` e `/health/ready` em ADVANCED com serviços saudáveis
- **THEN** ambos retornam 200 e readiness realizou probes nos serviços reais do perfil

#### Scenario: Valkey ausente ou derrubado
- **WHEN** coordenação não foi composta ou Valkey deixa de responder após boot
- **THEN** readiness retorna 503 com coordination, sem fallback permissivo nas operações protegidas

#### Scenario: Banco ou storage falha
- **WHEN** banco ou storage não responde ao probe dentro do timeout
- **THEN** readiness retorna 503 indicando apenas a dependência falha e liveness do processo permanece disponível

### Requirement: Jornada de negócio ADVANCED exercitada pelo CI
O gate ADVANCED SHALL iniciar API e web reais contra PostgreSQL/Valkey temporários após migrations/setup suportados. SHALL exercitar autenticação, projeto/item, contratos de erro, restart, isolamento e agente com provider determinístico de teste; mocks de persistência ou apenas testes de adapters SHALL NOT satisfazer esse gate. Resultados SHALL ser comparáveis ao SIMPLE e falha de qualquer etapa SHALL reprovar o gate.

#### Scenario: Login e projeto item persistem após restart
- **WHEN** o CI autentica usuário, cria projeto e item, consulta/altera dados e reinicia a API ADVANCED
- **THEN** cookie/autorização e respostas seguem o contrato, os dados permanecem no PostgreSQL e web/API continuam acessíveis

#### Scenario: Isolamento REST WebSocket e API key
- **WHEN** identidades de dois tenants tentam ler/mutar recursos e assinar WebSocket do outro tenant ou projeto sem permissão
- **THEN** todas as tentativas são rejeitadas sem eventos ou gravações cruzadas, enquanto acesso autorizado funciona

#### Scenario: Agente usa ferramenta real
- **WHEN** provider determinístico conduz run com leitura, mutação autorizada, aprovação e consumo de eventos
- **THEN** fila, ferramenta e resultado são persistidos pelo adapter PostgreSQL e os contratos do agente são exercitados sem mock do banco

### Requirement: Suporte e recuperação publicados por perfil
Guias SHALL descrever comandos e recursos verificados de cada perfil, migrations/backup/restore dentro do perfil, recuperação de marcadores e limitações dependentes de T37/T38/T39. SHALL NOT oferecer migração SIMPLE ↔ ADVANCED nem apresentar boot verificado como prova de multi-instância segura.

#### Scenario: Operador consulta deploy ADVANCED
- **WHEN** operador segue README/DEPLOY da versão entregue
- **THEN** encontra instalação nova, testes operacionais, rollback/restore do próprio perfil e condições explícitas para separar worker e habilitar réplicas
