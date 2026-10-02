## 1. Decisões e contratos

- [x] 1.1 Confirmar allowlist inicial, limite por arquivo e política de leitura/download enquanto anexos estiverem desabilitados; registrar valores e mensagens de erro.
- [x] 1.2 Definir fluxo administrativo pós-instalação para habilitar anexos e configurar provider, incluindo armazenamento seguro de credenciais e campos S3-compatible.
- [x] 1.3 Revisar contratos compartilhados de configuração e anexo, incluindo tenant, projeto, card, provider, chave opaca, nome, MIME, tamanho e timestamps.

## 2. Persistência e armazenamento

- [x] 2.1 Criar migration append-only para configuração do tenant e metadados dos anexos, com índices e relações necessárias para isolamento e exclusão em cascata.
- [x] 2.2 Implementar interface StorageAdapter e adapter local em diretório persistente fora de arquivos públicos.
- [x] 2.3 Implementar adapter S3-compatible configurável (endpoint, região, bucket, prefixo e modo compatível com MinIO), sem expor segredos.
- [x] 2.4 Resolver provider e configuração por tenant; persistir provider/chave por anexo para não quebrar referências após troca de provider.
- [x] 2.5 Implementar limpeza pós-commit idempotente para remoção individual, exclusão de card/projeto e retry/observabilidade de falhas.

## 3. API e segurança

- [x] 3.1 Implementar endpoints de configuração e operações de anexos (listar, upload, download e remover) com RBAC e autorização de membership por tenant/projeto/card.
- [x] 3.2 Validar tamanho, extensão, MIME declarado e conteúdo real segundo allowlist; gerar chaves aleatórias e sanitizar nome apresentado.
- [x] 3.3 Servir arquivos somente por rota autenticada, definir Content-Type pelo servidor, usar Content-Disposition seguro e impedir execução inline de conteúdo ativo.
- [x] 3.4 Cobrir isolamento cross-tenant, não-membros, IDOR, MIME forjado, limite excedido, provider indisponível e desativação com testes de API.

## 4. Interface e integração

- [x] 4.1 Implementar área de anexos no detalhe do card para listar, enviar, baixar e remover respeitando estado habilitado e permissões.
- [x] 4.2 Implementar preview/lightbox apenas para imagens raster aprovadas, com navegação e acessibilidade por teclado.
- [x] 4.3 Adicionar UI administrativa para ativar/desativar anexos e configurar storage após instalação, ocultando segredos já salvos.
- [x] 4.4 Adicionar traduções pt-BR, en e es e validar integração com CSP/headers de segurança.

## 5. Compatibilidade e validação

- [x] 5.1 Definir compatibilidade para anexos locais legados e comportamento de instalações existentes sem ativar a capacidade inadvertidamente.
- [x] 5.2 Documentar configuração, volume persistente local, configuração S3-compatible, backup, troca de provider e migração externa de objetos.
- [x] 5.3 Executar testes de migrations, `bun run check` e `bun run test:smoke`; corrigir regressões relacionadas à funcionalidade.
