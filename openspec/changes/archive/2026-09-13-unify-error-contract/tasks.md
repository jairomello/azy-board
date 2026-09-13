## 1. Inventário E Contrato Base

- [x] 1.1 Catalogar todos os formatos de erro emitidos por rotas HTTP, middleware, MCP e Azy Agent.
- [x] 1.2 Definir catálogo de códigos, status HTTP, mensagens seguras e regra de `retryable` para cada categoria.
- [x] 1.3 Adicionar tipos compartilhados e schemas runtime para o envelope `error` e seus detalhes.

## 2. Backend HTTP

- [x] 2.1 Implementar erro normalizado e serializador central de respostas.
- [x] 2.2 Integrar o serializador ao middleware de exceções não tratadas, sem expor stack trace ou dados sensíveis.
- [x] 2.3 Migrar handlers de validação, autenticação, autorização, recurso inexistente, conflito e falhas de infraestrutura.
- [x] 2.4 Remover respostas manuais legadas com `error` string ou campos auxiliares no nível raiz.
- [x] 2.5 Adicionar testes de contrato para status, código, mensagem, retryabilidade e detalhes.

## 3. MCP E Azy Agent

- [x] 3.1 Atualizar validação e dispatchers MCP para produzirem o envelope comum em erros de parâmetros e domínio.
- [x] 3.2 Remover a transformação paralela do middleware/harness do Azy Agent e preservar o envelope HTTP.
- [x] 3.3 Adicionar testes de paridade entre erro HTTP, ferramenta MCP e execução do Azy Agent.

## 4. Frontend E Documentação

- [x] 4.1 Atualizar parser de erro, toasts e mensagens de interface para ler `error.message` e códigos normalizados.
- [x] 4.2 Manter leitura tolerante de respostas legadas somente durante a transição, sem emitir o formato antigo.
- [x] 4.3 Documentar o contrato, catálogo de códigos, retryabilidade e formato de `details`.

## 5. Verificação E Entrega

- [x] 5.1 Adicionar gate que detecte novos payloads de erro fora do serializador central.
- [x] 5.2 Executar typecheck, testes de API/MCP/Azy Agent, build e smoke tests dos consumidores.
- [x] 5.3 Registrar a alteração breaking, atualizar changelog e preparar rollout/rollback.
