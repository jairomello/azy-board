## ADDED Requirements

### Requirement: Upload de anexos em qualquer card
O sistema SHALL permitir anexar arquivos a qualquer task (card). Não há restrição de tipo de arquivo. O tamanho máximo por arquivo SHALL ser configurável (padrão: 10 MB).

#### Scenario: Upload de anexo ao card
- **WHEN** membro faz upload de um arquivo no modal de edição do card
- **THEN** arquivo é salvo no storage e o card exibe o anexo com nome, tamanho e ícone de tipo

#### Scenario: Múltiplos anexos por card
- **WHEN** membro faz upload de vários arquivos em sequência no mesmo card
- **THEN** todos os anexos são listados no card, cada um com link de download individual

#### Scenario: Exclusão de anexo
- **WHEN** membro exclui um anexo do card
- **THEN** arquivo é removido do storage e da lista de anexos do card

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
