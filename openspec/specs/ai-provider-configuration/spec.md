## Purpose

Definir a configuração segura e extensível de providers de IA do Azy Agent.

## Requirements

### Requirement: Configuração Root de provider OpenAI
O sistema SHALL permitir que somente usuário `ROOT` gerencie, por tenant, uma lista ordenada de zero ou mais configurações de modelos para o Azy Agent. Cada configuração SHALL identificar provider e modelo, possuir credencial própria cifrada, prioridade, estado enabled e estado de validação. O ROOT SHALL poder testar, incluir, editar, reordenar, habilitar, desabilitar e remover qualquer configuração sem expor a chave completa. O teste de conexão SHALL validar a combinação de provider, modelo e segredo antes de salvá-la como `VALID`.

#### Scenario: Root configura um modelo
- **WHEN** ROOT informa provider, modelo e chave válida e confirma o cadastro após o teste de conexão
- **THEN** o sistema armazena a credencial cifrada, cria a configuração na prioridade solicitada e retorna apenas dados não secretos e o prefixo mascarado

#### Scenario: Root mantém vários modelos ordenados
- **WHEN** ROOT adiciona mais de uma configuração válida ao tenant e muda sua ordem
- **THEN** a API persiste uma lista ordenada sem limite fixo de quantidade e retorna a nova ordem

#### Scenario: Root desabilita ou remove uma configuração
- **WHEN** ROOT desabilita ou remove um modelo da lista
- **THEN** ele deixa de participar de novas cadeias de fallback sem alterar o toggle global nem os limites de governança do tenant

#### Scenario: Usuário não Root gerencia provider
- **WHEN** usuário que não é ROOT tenta listar ou alterar as configurações de modelo
- **THEN** a API retorna `403` e não revela provider, modelo, prefixo ou credencial da configuração

#### Scenario: Credencial rejeitada no teste
- **WHEN** o provider rejeita a combinação de chave e modelo durante o teste de conexão
- **THEN** a configuração não é criada nem habilitada e a resposta apresenta erro seguro sem persistir segredo não validado

#### Scenario: Migração da configuração existente
- **WHEN** a migration é executada em tenant que possui provider e credencial configurados nos campos legados de `assistant_settings`
- **THEN** a configuração existente aparece como a primeira configuração da lista, preservando provider, modelo, credencial cifrada, validação e disponibilidade global

### Requirement: Credenciais não são expostas
API keys SHALL ser cifradas em repouso, acessíveis somente no backend, redigidas de logs/telemetria e nunca retornadas ao browser, ao chat ou a respostas de erro.

#### Scenario: Consulta de configuração
- **WHEN** Root consulta o provider configurado
- **THEN** a resposta contém status, provider, modelo, modalidade, prefixo mascarado e datas, mas não contém segredo recuperável

#### Scenario: Credencial é revogada
- **WHEN** Root revoga uma credencial ativa
- **THEN** novas chamadas ao modelo falham de forma segura, o assistente fica não configurado e o token cifrado deixa de ser utilizável

### Requirement: Arquitetura de provider extensível
O contrato de configuração SHALL representar provider, modelo, API key e capacidades sem acoplar tabelas, chat ou harness a OpenAI, permitindo futuros adapters sem alterar o contrato do frontend.

#### Scenario: Provider OpenAI é selecionado
- **WHEN** uma run resolve sua configuração ativa
- **THEN** o registry seleciona o adapter OpenAI pelas capacidades declaradas e não por lógica espalhada em rotas

### Requirement: Fallback sequencial entre modelos configurados
Para cada chamada de inferência, o sistema SHALL tentar as configurações habilitadas e validadas do tenant em ordem de prioridade. Se uma chamada falhar no provider, o sistema SHALL avançar para o próximo candidato elegível dentro do orçamento de execução existente. Cada candidato SHALL ser tentado no máximo uma vez na cadeia daquela chamada, além dos retries transitórios já definidos para o candidato. O mecanismo SHALL aceitar quantidade variável de configurações sem limite fixo de lista.

#### Scenario: Modelo primário falha e o fallback responde
- **WHEN** o provider do primeiro modelo retorna timeout, falha de rede, rate limit, erro HTTP de provider ou rejeita o modelo/credencial
- **THEN** o sistema tenta o próximo modelo habilitado e validado na ordem salva e continua a mesma run quando recebe resposta válida

#### Scenario: Fallback mantém contexto e resultados de tools
- **WHEN** uma tool já foi executada e a chamada de inferência seguinte falha no modelo atual
- **THEN** o próximo modelo recebe o transcript e os resultados já produzidos, sem reexecutar a tool nem repetir uma mutação

#### Scenario: Falha local não troca de modelo
- **WHEN** a run é cancelada ou falha por autorização, limite local, validação de argumentos ou execução de tool
- **THEN** o sistema não trata o erro como falha do provider e não tenta o próximo modelo por esse motivo

#### Scenario: Tempo total da inferência se esgota
- **WHEN** os candidatos restantes não podem ser tentados dentro do timeout ou limite de execução vigente
- **THEN** o sistema interrompe o fallback e finaliza a chamada sem ultrapassar os limites globais da run

#### Scenario: Todos os modelos falham
- **WHEN** todos os modelos enabled e validados falham antes de uma resposta utilizável
- **THEN** a run termina pelo fluxo de falha existente com mensagem sanitizada, sem credencial, prompt ou payload interno

#### Scenario: O resultado do fallback é registrado sem segredo
- **WHEN** uma run muda para um modelo de fallback ou esgota a lista
- **THEN** o histórico operacional registra provider/modelo e resultado de cada tentativa, sem incluir a chave ou seu ciphertext

#### Scenario: Ordem salva é respeitada
- **WHEN** o ROOT altera a ordem e inicia uma nova run
- **THEN** a próxima execução tenta primeiro o modelo habilitado de menor posição

#### Scenario: Configuração desabilitada ou não validada é ignorada
- **WHEN** há itens desabilitados ou sem validação válida antes de um modelo elegível na lista
- **THEN** o sistema ignora esses itens e tenta apenas configurações enabled e validadas na ordem relativa salva
