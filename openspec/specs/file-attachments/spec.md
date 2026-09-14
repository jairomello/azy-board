## Purpose

Definir os requisitos da capacidade file attachments.

## Requirements

### Requirement: Upload de anexos em qualquer card
O sistema SHALL permitir anexar arquivos a qualquer task (card). Nao ha restricao de tipo de arquivo. O tamanho maximo por arquivo SHALL ser configuravel (padrao: 10 MB). A exclusao individual ou em cascata SHALL remover os metadados do banco e SHALL garantir a limpeza eventual do arquivo no storage por meio do mecanismo pos-commit, sem exigir que o storage participe da transacao do banco.

#### Scenario: Upload de anexo ao card
- **WHEN** membro faz upload de um arquivo no modal de edicao do card
- **THEN** arquivo e salvo no storage e o card exibe o anexo com nome, tamanho e icone de tipo

#### Scenario: Multiplos anexos por card
- **WHEN** membro faz upload de varios arquivos em sequencia no mesmo card
- **THEN** todos os anexos sao listados no card, cada um com link de download individual

#### Scenario: Exclusao individual de anexo
- **WHEN** membro exclui um anexo do card
- **THEN** o metadado e removido e o sistema agenda ou conclui a remocao do arquivo no storage de forma idempotente

#### Scenario: Exclusao do card remove anexos
- **WHEN** um card com anexos e excluido, direta ou recursivamente
- **THEN** todos os metadados sao removidos na transacao e cada arquivo fisico fica registrado para limpeza pos-commit

#### Scenario: Exclusao do projeto remove anexos
- **WHEN** um projeto com cards e anexos e excluido
- **THEN** os metadados dos anexos sao removidos e os arquivos fisicos associados sao encaminhados para limpeza sem atravessar o limite do tenant

---

### Requirement: Visualização de imagens inline
O sistema SHALL permitir que imagens anexadas (JPEG, PNG, GIF, WebP, SVG) sejam visualizadas diretamente na aplicação via lightbox, sem necessidade de download.

#### Scenario: Abrir imagem em lightbox
- **WHEN** usuário clica em uma imagem anexada ao card
- **THEN** lightbox abre exibindo a imagem em tela cheia com controles de navegação entre imagens do card

#### Scenario: Navegar entre imagens do card
- **WHEN** lightbox está aberto e card possui múltiplas imagens
- **THEN** usuário pode navegar com setas (teclado ou clique) entre as imagens do card

#### Scenario: Fechar lightbox
- **WHEN** usuário pressiona ESC ou clica fora da imagem
- **THEN** lightbox fecha e retorna ao card

---

### Requirement: Armazenamento local com abstração para cloud
O sistema SHALL armazenar arquivos no filesystem local no MVP, servidos por rota estática do Bun. A camada de storage SHALL ser abstraída via interface `StorageAdapter` para permitir troca para S3 ou outro provider sem alteração de lógica de negócio.

#### Scenario: Upload processado pelo backend
- **WHEN** frontend envia arquivo via `multipart/form-data` para `POST /projects/{id}/tasks/{taskId}/attachments`
- **THEN** backend salva o arquivo em `/uploads/{projectId}/{taskId}/`, registra metadados no banco e retorna URL de acesso

#### Scenario: Troca de storage para produção
- **WHEN** variável de ambiente `STORAGE_ADAPTER=s3` é configurada
- **THEN** sistema usa o adapter S3 para upload e geração de URL sem alterar nenhum outro código

---

### Requirement: Segurança no acesso a arquivos
O sistema SHALL garantir que apenas membros do projeto possam acessar os anexos de cards daquele projeto.

#### Scenario: Acesso a anexo por não-membro
- **WHEN** usuário sem membership no projeto tenta acessar URL de um anexo diretamente
- **THEN** sistema retorna 403 ou 404 sem servir o arquivo
