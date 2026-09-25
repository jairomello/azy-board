## ADDED Requirements

### Requirement: Request ID em toda requisição

A API SHALL associar um identificador de requisição (`X-Request-Id`) a cada requisição HTTP: quando a requisição de entrada trouxer `X-Request-Id` em formato seguro (até 64 caracteres de `[A-Za-z0-9._-]`), o valor SHALL ser propagado; caso contrário (ausente ou malformado), a API SHALL gerar um novo identificador. O identificador SHALL ser devolvido no header `X-Request-Id` de toda resposta, inclusive de erro.

#### Scenario: Requisição sem request ID
- **WHEN** um cliente chama a API sem o header `X-Request-Id`
- **THEN** a resposta devolve um `X-Request-Id` gerado pela API

#### Scenario: Request ID válido é propagado
- **WHEN** um cliente envia `X-Request-Id` com valor no formato seguro
- **THEN** a resposta devolve exatamente o mesmo valor e os registros da requisição o utilizam

#### Scenario: Request ID inválido é substituído
- **WHEN** um cliente envia `X-Request-Id` com formato inválido ou excessivamente longo
- **THEN** a API descarta o valor, gera um novo identificador e o devolve na resposta

#### Scenario: Resposta de erro carrega o identificador
- **WHEN** a requisição termina em erro (4xx ou 5xx)
- **THEN** a resposta de erro inclui o header `X-Request-Id` daquela requisição

### Requirement: Log JSON estruturado por requisição

Ao final de cada requisição tratada pelo pipeline HTTP, a API SHALL emitir exatamente um registro de log em JSON com, no mínimo, timestamp, nível, mensagem, request ID, método, rota, status HTTP e duração em milissegundos, além do tenant anonimizado quando a requisição estiver autenticada. Requisições a health endpoints SHALL ser registradas em nível de depuração para não inflar o volume.

#### Scenario: Requisição bem-sucedida
- **WHEN** uma requisição autenticada completa com status 2xx
- **THEN** há um registro JSON com request ID, método, rota, status, duração e tenant anonimizado

#### Scenario: Requisição com erro
- **WHEN** uma requisição completa com status 4xx ou 5xx
- **THEN** o registro JSON usa nível de erro ou aviso e mantém os mesmos campos de correlação

#### Scenario: Health em nível de depuração
- **WHEN** um cliente consulta um health endpoint
- **THEN** o registro correspondente é emitido em nível de depuração (ou omitido conforme `LOG_LEVEL`)

### Requirement: Redação de dados sensíveis nos logs

Os registros de log SHALL NOT conter segredos, cookies, tokens, chaves de API, corpos de requisição ou resposta, query strings, nem identificadores crus de tenant ou usuário. O tenant SHALL aparecer apenas de forma anonimizada e estável (hash truncado), suficiente para correlação local sem permitir a recuperação do identificador a partir do log.

#### Scenario: Requisição com credenciais
- **WHEN** uma requisição traz header de autorização, cookie de sessão ou API key
- **THEN** nenhum desses valores aparece no registro de log da requisição

#### Scenario: Tenant anonimizado e estável
- **WHEN** requisições do mesmo tenant são registradas
- **THEN** o campo de tenant é um hash truncado igual entre elas e diferente do `tenant_id` em texto

#### Scenario: Parâmetros de consulta não são registrados
- **WHEN** uma requisição traz query string
- **THEN** a rota registrada não inclui a query string nem seus valores

### Requirement: Exceções registradas de forma estruturada

Exceções não tratadas SHALL serem registradas pelo logger estruturado em JSON, incluindo request ID, mensagem, tipo e stack trace no log protegido do servidor, e SHALL substituir os `console.error`/`console.log` soltos do runtime da API. O stack trace SHALL permanecer apenas nos logs, nunca em respostas HTTP.

#### Scenario: Exceção não tratada
- **WHEN** uma exceção não mapeada ocorre durante o atendimento de uma requisição
- **THEN** um registro JSON de erro é emitido com request ID, mensagem, tipo e stack, e a resposta HTTP não expõe o stack

#### Scenario: Sem logging por console solto no runtime
- **WHEN** o código de runtime da API precisa registrar falha operacional
- **THEN** o registro usa o logger estruturado em vez de `console.error`/`console.log`
