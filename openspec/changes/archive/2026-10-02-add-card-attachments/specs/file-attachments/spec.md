## MODIFIED Requirements

### Requirement: Upload de anexos em qualquer card
O sistema SHALL permitir anexos em qualquer task (card) quando a capacidade estiver habilitada para o tenant. O sistema SHALL aplicar allowlist explícita de MIME e validação de conteúdo, sem confiar no Content-Type enviado pelo cliente, e SHALL impor limite máximo por arquivo de 10 MB. A allowlist SHALL manter os tipos atuais: imagens PNG/JPEG/GIF/WebP/AVIF/BMP, PDF, texto/plain, Markdown, CSV, JSON, formatos Microsoft Office suportados, ZIP/GZIP/7z, áudio MPEG/WAV/OGG e vídeo MP4/WebM. Um usuário autorizado SHALL poder listar, enviar, baixar e remover anexos no contexto do card. A exclusão individual ou em cascata SHALL remover os metadados do banco e SHALL garantir a limpeza eventual do objeto no storage por mecanismo pós-commit idempotente, sem exigir que o storage participe da transação do banco.

#### Scenario: Upload de anexo válido ao card
- **WHEN** membro autorizado envia arquivo permitido dentro do limite para um card de tenant com anexos habilitados
- **THEN** arquivo é salvo no provider ativo, metadados são vinculados ao tenant, projeto e card, e o card exibe nome, tamanho e tipo

#### Scenario: Rejeição de tipo ou tamanho não permitido
- **WHEN** usuário envia arquivo cujo conteúdo/tipo não pertence à allowlist ou excede o limite configurado
- **THEN** API rejeita a operação sem persistir arquivo nem metadados e retorna erro acionável

#### Scenario: Múltiplos anexos por card
- **WHEN** membro autorizado envia vários arquivos válidos em sequência no mesmo card
- **THEN** todos os anexos são listados com ação individual de download

#### Scenario: Exclusão individual de anexo
- **WHEN** membro autorizado exclui um anexo do card
- **THEN** o metadado é removido e o sistema agenda ou conclui a remoção do objeto de forma idempotente

#### Scenario: Exclusão do card remove anexos
- **WHEN** um card com anexos é excluído, direta ou recursivamente
- **THEN** todos os metadados são removidos na transação e cada objeto físico fica registrado para limpeza pós-commit

#### Scenario: Exclusão do projeto remove anexos
- **WHEN** um projeto com cards e anexos é excluído
- **THEN** os metadados dos anexos são removidos e os objetos físicos associados são encaminhados para limpeza sem atravessar o limite do tenant

### Requirement: Visualização segura de imagens inline
O sistema SHALL permitir visualização inline apenas dos formatos de imagem raster aprovados pela allowlist (JPEG, PNG, GIF e WebP), via lightbox autenticado. SVG e demais formatos ativos SHALL ser tratados como download e nunca executados na origem da aplicação.

#### Scenario: Abrir imagem aprovada em lightbox
- **WHEN** usuário autorizado clica em imagem aprovada anexada ao card
- **THEN** lightbox abre exibindo a imagem com controles de navegação entre imagens do card

#### Scenario: Navegar entre imagens do card
- **WHEN** lightbox está aberto e card possui múltiplas imagens aprovadas
- **THEN** usuário pode navegar com teclado ou controles entre as imagens

#### Scenario: Baixar formato não inline
- **WHEN** usuário autorizado acessa anexo que não é formato de imagem inline aprovado
- **THEN** o sistema fornece download como attachment e não executa o conteúdo na origem da aplicação

#### Scenario: Fechar lightbox
- **WHEN** usuário pressiona ESC ou clica fora da imagem
- **THEN** lightbox fecha e retorna ao card

### Requirement: Armazenamento local e object storage por tenant
O sistema SHALL disponibilizar uma interface `StorageAdapter` desacoplada das regras de negócio, com backend local para instalações simples e backend S3-compatible configurável para armazenamento de objetos. Cada upload SHALL usar o backend ativo do tenant e registrar provider e chave opaca nos metadados para permitir localizar anexos existentes após troca de configuração. Arquivos locais SHALL ficar fora de diretórios estáticos públicos. Downloads SHALL passar por rota autenticada, não por URL pública permanente.

#### Scenario: Upload processado pelo backend local
- **WHEN** tenant habilitado está configurado para storage local e frontend envia arquivo válido via multipart para a API de anexos do card
- **THEN** backend grava o objeto no diretório persistente configurado, registra provider/chave/metadados e retorna a representação do anexo sem expor caminho físico

#### Scenario: Upload para object storage S3-compatible
- **WHEN** tenant habilitado está configurado para um provider S3-compatible com credenciais válidas
- **THEN** backend grava o objeto por meio do adapter e registra provider/chave sem expor credenciais ao cliente

#### Scenario: Troca de provider
- **WHEN** administrador altera o backend configurado para uploads futuros
- **THEN** uploads subsequentes usam o novo provider e anexos existentes mantêm suas referências; o sistema não migra, reaponta ou apaga objetos automaticamente

#### Scenario: Falha ao acessar provider de anexo existente
- **WHEN** provider associado ao anexo está indisponível
- **THEN** API retorna erro recuperável sem apagar metadados ou tentar buscar o objeto em outro provider

### Requirement: Segurança no acesso a arquivos
O sistema SHALL garantir que apenas usuários com membership no projeto possam listar, baixar ou remover anexos dos cards daquele projeto. Toda consulta SHALL ser isolada por tenant, projeto e item. O sistema SHALL usar identificadores opacos, validar a associação do anexo ao card solicitado e responder com tipo determinado pelo servidor e política segura de disposição/conteúdo.

#### Scenario: Acesso a anexo por não-membro
- **WHEN** usuário sem membership no projeto tenta acessar URL/identificador de anexo diretamente
- **THEN** sistema retorna 403 ou 404 sem servir o arquivo

#### Scenario: Tentativa de acesso entre tenants
- **WHEN** usuário autenticado tenta consultar anexo pertencente a outro tenant ou projeto não acessível
- **THEN** sistema não revela metadados nem conteúdo e retorna 403 ou 404

#### Scenario: Tipo de conteúdo não confiável
- **WHEN** arquivo enviado contém tipo ativo ou Content-Type forjado
- **THEN** sistema não o renderiza inline e entrega-o como attachment com headers de segurança

## ADDED Requirements

### Requirement: Configuração de anexos habilitada por tenant
O sistema SHALL permitir ao administrador habilitar ou desabilitar anexos para o tenant e escolher o backend de armazenamento local ou S3-compatible por interface administrativa após a instalação. Quando desabilitada, a interface SHALL ocultar as ações/área de anexos e a API SHALL rejeitar novos uploads e remoções, mantendo listagem/download autorizado dos anexos existentes. A alteração SHALL preservar metadados e objetos existentes, sem migração ou exclusão automática. Credenciais remotas SHALL ser cifradas no backend com chave mestra fornecida por ambiente, nunca retornadas em claro nem registradas em logs.

#### Scenario: Ativar anexos e configurar provider
- **WHEN** administrador habilita anexos e salva configuração válida do provider no tenant
- **THEN** membros autorizados podem usar a funcionalidade e novos uploads passam a usar o provider selecionado

#### Scenario: Desativar anexos preserva leitura
- **WHEN** administrador desabilita anexos para o tenant
- **THEN** UI oculta a funcionalidade, API bloqueia novos uploads e remoções, membros autorizados ainda podem listar e baixar anexos existentes, e nenhum objeto ou metadado é removido

#### Scenario: Segredo de storage
- **WHEN** configuração de object storage é consultada por usuário ou registrada em log
- **THEN** credenciais secretas não são devolvidas ao cliente nem registradas em texto claro
