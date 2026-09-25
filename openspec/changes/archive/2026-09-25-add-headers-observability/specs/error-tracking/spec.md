## ADDED Requirements

### Requirement: Provedor de error tracking opcional

O envio de erros a um provedor de error tracking SHALL ocorrer apenas quando um DSN estiver configurado (backend e frontend configurados de forma independente). Sem DSN, a aplicação SHALL NOT inicializar o provedor nem enviar qualquer dado, e o diagnóstico continua baseado nos logs estruturados.

#### Scenario: Sem DSN configurado
- **WHEN** a aplicação roda sem DSN de error tracking
- **THEN** nenhum dado de erro é enviado a serviços externos e os fluxos funcionam normalmente

#### Scenario: Com DSN configurado
- **WHEN** a aplicação roda com DSN válido
- **THEN** exceções capturadas são enviadas ao provedor informado

#### Scenario: Frontend e backend independentes
- **WHEN** apenas um dos lados (frontend ou backend) tem DSN configurado
- **THEN** somente o lado configurado envia erros, sem falha do lado não configurado

### Requirement: Captura de exceções no backend

O backend SHALL capturar exceções não tratadas e falhas 5xx do pipeline HTTP, enviando-as ao provedor com o request ID da requisição no escopo do evento, permitindo correlação com logs e respostas.

#### Scenario: Exceção em rota
- **WHEN** uma exceção não tratada ocorre ao atender uma requisição
- **THEN** o evento enviado ao provedor inclui mensagem, stack e o request ID da requisição

#### Scenario: Erro 5xx sem exceção propagada
- **WHEN** o pipeline conclui uma resposta com status 5xx
- **THEN** o erro é capturado com o request ID correspondente

### Requirement: Captura de erros no frontend

O frontend SHALL encaminhar ao provedor os erros capturados pelo boundary de renderização, preservando o identificador de referência da ocorrência como dado de correlação do evento, sem alterar o que é exibido na tela de erro. Quando habilitado, o frontend também SHALL poder capturar erros globais não tratados (`window.onerror` e rejeições de promessa).

#### Scenario: Erro de renderização enviado
- **WHEN** o boundary captura um erro de renderização com DSN configurado
- **THEN** o evento enviado inclui a referência da ocorrência, mensagem e stack, e a tela continua exibindo apenas a mensagem genérica e a referência

#### Scenario: Erro global não tratado
- **WHEN** ocorre um erro global não tratado com a captura global habilitada
- **THEN** o evento é enviado ao provedor com os dados disponíveis de contexto

#### Scenario: Sem DSN no frontend
- **WHEN** o boundary captura um erro sem DSN configurado
- **THEN** o registro continua apenas no canal local (console/observabilidade), sem envio externo

### Requirement: Redação antes do envio a terceiros

Todo evento enviado ao provedor SHALL passar por redação que remove cookies, headers de autorização, tokens, chaves de API, corpos de requisição/resposta, query strings e identificadores crus de tenant e usuário (substituídos por hash truncado), mantendo mensagem, stack e dados de correlação.

#### Scenario: Evento com credenciais no contexto
- **WHEN** a requisição que falhou continha cookie de sessão ou header de autorização
- **THEN** o evento enviado não contém esses valores

#### Scenario: Tenant redigido
- **WHEN** o evento é emitido para uma requisição autenticada
- **THEN** o tenant aparece apenas em forma de hash truncado

#### Scenario: Dados úteis preservados
- **WHEN** um evento é redigido
- **THEN** mensagem, stack, request ID e referência do boundary permanecem presentes para diagnóstico

### Requirement: Correlação entre erros, logs e respostas

Os eventos de error tracking SHALL conter o request ID (backend) ou a referência da ocorrência (frontend) para permitir a correlação com os logs estruturados e com o header `X-Request-Id` devolvido ao cliente, sem alterar o envelope de erro HTTP definido em `unified-error-contract`.

#### Scenario: Correlação backend
- **WHEN** um erro de backend é investigado no provedor
- **THEN** o request ID do evento localiza o log estruturado e a resposta HTTP da mesma requisição

#### Scenario: Correlação frontend
- **WHEN** o usuário informa a referência exibida na tela de erro
- **THEN** o suporte localiza o evento correspondente no provedor pela mesma referência

#### Scenario: Contrato de erro preservado
- **WHEN** a API responde um erro com error tracking ativo
- **THEN** o corpo da resposta continua seguindo o envelope de `unified-error-contract`, sem campos novos obrigatórios
