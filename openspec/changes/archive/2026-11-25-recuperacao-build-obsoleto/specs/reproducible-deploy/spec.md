## ADDED Requirements

### Requirement: Cache dos estáticos e 404 real para asset ausente

O nginx que serve o web SHALL tratar assets versionados por hash de conteúdo como
cacheáveis por longo prazo e SHALL responder **404** quando o arquivo não existir,
sem cair no fallback do SPA. O `index.html` SHALL ser servido com revalidação
obrigatória, para que uma navegação nunca reutilize HTML de um build anterior sem
consultar o servidor. As locations de assets e de HTML SHALL preservar os headers
de segurança definidos no `server` (CSP, `X-Frame-Options`, `nosniff` e
`Referrer-Policy`). Os dois templates nginx versionados (standalone e atrás de
Cloudflare) SHALL aplicar a mesma política.

#### Scenario: Asset de build antigo

- **WHEN** o navegador pede `/assets/BoardPage-<hash-antigo>.js` e o arquivo não existe no build atual
- **THEN** o nginx responde 404, sem devolver o `index.html` com `Content-Type: text/html`

#### Scenario: Asset do build atual

- **WHEN** o navegador pede um arquivo existente em `/assets/`
- **THEN** a resposta traz `Cache-Control` de longo prazo e os headers de segurança do `server`

#### Scenario: HTML sempre revalidado

- **WHEN** o navegador navega para `/` ou para uma rota profunda do SPA
- **THEN** o `index.html` é servido com `Cache-Control` que exige revalidação antes do reuso

#### Scenario: Rota profunda continua funcionando

- **WHEN** o usuário abre `/projects/:id/board` diretamente
- **THEN** o fallback do SPA entrega o `index.html` com os headers de segurança
