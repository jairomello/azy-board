## Why

Equipes precisam anexar documentos, imagens e evidências diretamente aos cards, mas a capacidade atual não oferece uma política operacional configurável nem uma estratégia de armazenamento alinhada aos perfis de instalação. A solução deve permitir ativar anexos por tenant e escolher storage local simples ou object storage, sem exigir migração automática de dados quando a configuração mudar.

## What Changes

- Adicionar configuração por tenant para habilitar/desabilitar anexos e selecionar armazenamento local ou object storage.
- Definir contrato de armazenamento abstrato, configuração validada de provedores compatíveis com S3 e persistência de metadados vinculados ao tenant, projeto e card.
- Implementar limites de tamanho, allowlist de tipos MIME/extensões, validação de conteúdo e nomes/chaves de armazenamento seguros.
- Implementar upload, listagem, download e remoção autorizados, protegendo acesso por membership no projeto e evitando servir conteúdo ativo na mesma origem.
- Adicionar UI de anexos no card para listar, enviar, remover e visualizar imagens com controles acessíveis.
- Ao desabilitar anexos, ocultar as ações e a área da funcionalidade, sem apagar metadados ou arquivos. Alterações de backend/storage passam a valer para novos uploads; migração/reapontamento de arquivos existentes fica fora do produto.
- Integrar respostas e visualização às políticas de headers/CSP existentes.

## Capabilities

### New Capabilities

### Modified Capabilities
- `file-attachments`: substituir os requisitos atuais de armazenamento local fixo, formatos irrestritos e rotas de acesso estático pelo comportamento configurável por tenant, validação de arquivos, autorização e regras de ativação/desativação descritas nesta proposta.

## Impact

- Banco e migrations da API para configuração do tenant e metadados de anexos.
- API Hono: serviços/adapters de storage e endpoints de upload, listagem, download e remoção.
- Setup/configuração do tenant, validação de credenciais e documentação de instalação.
- Frontend de cards, contratos compartilhados, traduções pt-BR/en/es e visualização de imagens.
- Testes de API, storage, segurança, migrations e fluxos web; integração com CSP e deploy/volumes locais.

Board ref: d43b3eb1-ff9f-4c95-be0a-06e24c8227d0
