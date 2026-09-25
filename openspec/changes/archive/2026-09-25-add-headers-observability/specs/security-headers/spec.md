## ADDED Requirements

### Requirement: Headers de segurança em toda resposta da API

Toda resposta HTTP da API SHALL incluir os headers de segurança básicos: `Content-Security-Policy` com `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff` e `Referrer-Policy`. Os headers SHALL estar presentes também em respostas de erro, de arquivos (anexos/avatares) e de rotas públicas.

#### Scenario: Resposta de sucesso com headers
- **WHEN** um cliente realiza uma requisição autenticada à API
- **THEN** a resposta inclui CSP com `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff` e `Referrer-Policy`

#### Scenario: Resposta de erro com headers
- **WHEN** a API responde um erro (4xx ou 5xx)
- **THEN** os mesmos headers de segurança estão presentes na resposta

#### Scenario: Conteúdo não pode ser encaixado em frame
- **WHEN** uma página externa tenta encaixar uma página da aplicação em iframe/frame
- **THEN** o navegador bloqueia o encaixe pelas diretivas `frame-ancestors 'none'` e `X-Frame-Options: DENY`

### Requirement: HSTS apenas em HTTPS

A API SHALL emitir `Strict-Transport-Security` apenas quando a requisição ocorrer sobre HTTPS em produção (considerando o encaminhamento de proxy quando `TRUST_PROXY` estiver configurado) e SHALL NOT emitir HSTS em desenvolvimento ou em requisições HTTP simples.

#### Scenario: Produção sobre HTTPS
- **WHEN** a aplicação responde uma requisição HTTPS em produção
- **THEN** a resposta inclui `Strict-Transport-Security` com a política de max-age definida

#### Scenario: Desenvolvimento ou HTTP simples
- **WHEN** a aplicação roda em desenvolvimento ou atende HTTP simples
- **THEN** nenhuma resposta inclui `Strict-Transport-Security`

### Requirement: CSP compatível com o funcionamento do web

A política CSP SHALL permitir os recursos legitimamente usados pela aplicação (recursos de mesma origem, imagens inline em `data:`/`blob:` usadas pelo editor de rich text e avatares, e os estilos exigidos pelos componentes) sem quebrar telas, e SHALL restringir `default-src` a `'self'`.

#### Scenario: Aplicação web funciona com a CSP ativa
- **WHEN** o web é carregado com a CSP aplicada pelo servidor
- **THEN** as telas principais (login, board, modal de item, editor de rich text) funcionam sem violações de CSP que bloqueiem recursos

#### Scenario: Recursos externos não são permitidos por padrão
- **WHEN** a página tenta carregar script ou recurso de origem externa não listada
- **THEN** o navegador bloqueia o carregamento pela diretiva `default-src 'self'`

### Requirement: Paridade de headers no web servido

A configuração recomendada do servidor estático que serve o web em produção SHALL emitir os mesmos headers de segurança da API e SHALL estar documentada na documentação de deploy; o servidor de desenvolvimento (Vite) SHALL emitir headers equivalentes para que a validação local reflita produção.

#### Scenario: Build de produção servido com headers
- **WHEN** o build do web é servido com a configuração de servidor documentada
- **THEN** as respostas incluem CSP, `X-Frame-Options`, `X-Content-Type-Options` e `Referrer-Policy`

#### Scenario: Servidor de desenvolvimento emite headers
- **WHEN** o web é executado em modo de desenvolvimento
- **THEN** as respostas incluem os headers de segurança equivalentes aos de produção

#### Scenario: Documentação de deploy cobre os headers
- **WHEN** o operador consulta a documentação de deploy
- **THEN** ela contém o trecho de configuração de headers pronto para o servidor estático e a indicação dos health endpoints
