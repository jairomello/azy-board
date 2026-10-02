## 1. Persistência de modelos por tenant

- [x] 1.1 Criar o modelo persistido de configuração provider/modelo ordenada por tenant, preservando credenciais cifradas e estado de validação.
- [x] 1.2 Criar migrations SQLite e PostgreSQL para a lista de modelos e migrar configurações singleton existentes para a primeira posição sem mudar governança ou toggle global.
- [x] 1.3 Implementar consultas e mutações de configuração nos adapters/ports com escopo tenant explícito, atualização transacional da ordem e proteção contra remoção de credencial ainda referenciada.

## 2. API ROOT e disponibilidade

- [x] 2.1 Implementar endpoints ROOT para listar, testar, incluir, editar, ordenar, habilitar/desabilitar e remover configurações, retornando somente dados não secretos.
- [x] 2.2 Resolver `configured` a partir da existência de modelos habilitados e validados, preservando o toggle global e recusando ativação sem candidato elegível.
- [x] 2.3 Cobrir autorização ROOT, isolamento entre tenants, validação de credenciais/modelos, respostas sem segredo e semântica após remoção/desativação.

## 3. Fallback do Azy Agent

- [x] 3.1 Iniciar `startAgentWorker()` em `startServer()` e fornecer executor que reconstrói contexto e autorização do run pelo banco; cobrir consumo de runs `QUEUED`.
- [x] 3.2 Carregar no worker a cadeia ordenada de modelos ativos do tenant e descriptografar cada credencial somente no backend, revalidando tenant e estado atual.
- [x] 3.3 Implementar fallback sequencial por chamada de inferência para erros do provider, com retries existentes, orçamento de timeout compartilhado e sem novo fallback para cancelamento ou limites locais.
- [x] 3.4 Manter transcript canônico entre adapters durante fallback, preservando respostas e resultados de tools já concluídas sem repetir mutações.
- [x] 3.5 Registrar tentativas, modelo/provider efetivo e falha final em histórico operacional sanitizado, sem segredos nem payloads sensíveis.
- [x] 3.6 Cobrir worker inicializado, modelo primário bem-sucedido, falhas e passagem ao próximo, cadeia esgotada, candidato desativado ou inválido, timeout, cancelamento, erro local e continuação depois de tool sem duplicação.

## 4. Interface Root e localização

- [x] 4.1 Substituir o formulário singleton por uma lista ordenada de modelos com estado, prioridade, ações de teste/edição/ativação/remoção e formulário de inclusão.
- [x] 4.2 Tornar a reordenação acessível por teclado, preservar feedback de validação/falha e não exibir chaves completas após salvar.
- [x] 4.3 Adicionar traduções PT-BR, EN e ES para gerenciamento, estado de fallback, erros e confirmações.
- [x] 4.4 Usar `model-fallback-prototype.svg` como referência visual e revisar os estados sem modelos, carregando, inválido e fallback ativo.

## 5. Verificação e encerramento

- [x] 5.1 Rodar testes de migrations e paridade SQLite/PostgreSQL, `bun run check` e `bun run test:smoke`.
- [x] 5.2 Registrar `Board ref: 64203ebf-a76c-44ba-952e-e06ed53c616b` nos artefatos da change.
