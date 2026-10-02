## 1. Persistência e contratos

- [x] 1.1 Definir schema Drizzle da entidade de links com tenant, projeto, item, nome, URL, descrição e timestamps, incluindo índices e chaves estrangeiras.
- [x] 1.2 Criar migração compatível com os perfis de banco suportados e validar criação/remoção da tabela.
- [x] 1.3 Adicionar contratos compartilhados e validações de entrada/saída, incluindo limites explícitos e URLs somente HTTP/HTTPS.

## 2. API e segurança

- [x] 2.1 Implementar listagem e criação de links no escopo do item com autorização e filtros de tenant/projeto/item.
- [x] 2.2 Implementar edição parcial e remoção de links com validação de associação e RBAC.
- [x] 2.3 Adicionar testes de integração para CRUD, isolamento cross-tenant/projeto/item, permissões e validação de URL/campos.

## 3. Interface do item

- [x] 3.1 Implementar área de links no detalhe/modal do item, disponível sem depender da configuração de anexos.
- [x] 3.2 Implementar formulários de criação/edição e ação de remoção para usuários com permissão de escrita, com estados de carregamento, erro e vazio.
- [x] 3.3 Exibir nome e descrição e abrir cada endereço em nova guia com `noopener noreferrer`.
- [x] 3.4 Adicionar textos de interface para PT-BR, EN e ES e testes de interface para leitura, edição, estado vazio e abertura segura.

## 4. Verificação

- [x] 4.1 Executar `bun run check` e `bun run test:smoke`, corrigindo eventuais falhas relacionadas à mudança.

Board ref: cb1b516c-d2ed-4bab-9a29-8278611ec62d
