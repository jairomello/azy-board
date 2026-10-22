## Purpose

Definir os requisitos da capacidade file attachments.

## Requirements

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

---

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

---

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

---

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

---

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

---

### Requirement: Metadados opcionais de anexos

Cada anexo SHALL suportar três metadados opcionais: `label` (nome amigável de exibição, até 200 caracteres), `referenceDate` (data de referência do documento em formato ISO `YYYY-MM-DD`) e `description` (descrição em rich text armazenada em Markdown canônico, até 20000 caracteres). Nenhum dos três SHALL ser obrigatório para gravar o anexo.

#### Scenario: Upload sem metadados explícitos aplica sugestões automáticas

- **WHEN** o usuário envia um arquivo sem informar label, data ou descrição
- **THEN** o sistema grava o anexo com `label` igual ao nome original do arquivo, `referenceDate` igual à data do upload e `description` vazia

#### Scenario: Upload com metadados explícitos

- **WHEN** o cliente envia o multipart com `label`, `referenceDate` e/ou `description`
- **THEN** o sistema grava os valores informados em vez dos defaults

#### Scenario: Usuário mantém sugestões automáticas

- **WHEN** o usuário abre o formulário de metadados e salva sem alterar os valores sugeridos
- **THEN** o sistema grava os metadados com os valores sugeridos sem exigir preenchimento adicional

#### Scenario: Listagem expõe os metadados

- **WHEN** o cliente lista os anexos de um card
- **THEN** cada anexo retornado inclui `label`, `referenceDate`, `description` e `originalName`, além dos campos já existentes

---

### Requirement: Edição de metadados do anexo

O sistema SHALL disponibilizar edição parcial dos metadados de um anexo via `PATCH` no escopo do card, exigindo papel mínimo MEMBER no projeto, anexos habilitados no tenant e respeito ao isolamento tenant/projeto/item. Campos ausentes no corpo da requisição não SHALL ser alterados; `null` SHALL limpar o campo.

#### Scenario: Editar nome, data e descrição

- **WHEN** um usuário com papel MEMBER envia PATCH com novos valores de `label`, `referenceDate` e `description`
- **THEN** o sistema atualiza os campos informados, retorna o anexo atualizado e notifica os clientes conectados

#### Scenario: Limpar um metadado

- **WHEN** o usuário envia `label: null` no PATCH
- **THEN** o sistema grava `label` nulo e a interface passa a exibir o nome original do arquivo como fallback visual

#### Scenario: Validação de campos

- **WHEN** o PATCH envia `label` com mais de 200 caracteres, `referenceDate` em formato inválido ou `description` acima de 20000 caracteres
- **THEN** o sistema rejeita com erro de validação acionável e nenhuma alteração é persistida

#### Scenario: Usuário sem permissão de escrita

- **WHEN** um usuário com papel VIEWER tenta editar metadados de um anexo
- **THEN** o sistema retorna 403 sem alterar dados

#### Scenario: Anexos desabilitados no tenant bloqueiam edição

- **WHEN** o administrador desabilitou anexos no tenant e um usuário tenta editar metadados
- **THEN** o sistema retorna erro de conflito (409) e a leitura dos anexos e metadados existentes continua permitida

#### Scenario: Acesso cruzado é bloqueado

- **WHEN** um usuário de outro tenant ou não membro do projeto tenta editar metadados de um anexo
- **THEN** o sistema retorna 403/404 sem revelar a existência do anexo

---

### Requirement: Compatibilidade e backfill de anexos existentes

Os novos metadados SHALL ser opcionais nos contratos de API e tipos compartilhados, mantendo compatibilidade com clientes que não os conhecem. Anexos criados antes da funcionalidade SHALL receber `label` igual ao `original_name` no backfill da migração, com `referenceDate` e `description` nulos.

#### Scenario: Anexo legado após migração

- **WHEN** a migração é aplicada sobre anexos existentes
- **THEN** cada anexo legado passa a ter `label` igual ao nome original gravado, sem alteração dos demais dados

#### Scenario: Cliente antigo continua funcionando

- **WHEN** um cliente que não envia nem lê os novos campos faz upload e listagem de anexos
- **THEN** as operações continuam funcionando com o comportamento anterior e os campos novos são ignorados ou retornados como opcionais

---

### Requirement: Listagem agregada de anexos por projeto

O sistema SHALL disponibilizar uma leitura somente leitura que retorna todos os anexos vinculados a qualquer card de um projeto, sem filtro por item. A leitura SHALL ser escopada por tenant e projeto, exigir membership no projeto e expor, para cada anexo, o card de origem e seus metadados, mantendo a leitura preservada mesmo quando a capacidade de anexos está desabilitada.

#### Scenario: Listar todos os anexos do projeto

- **WHEN** um usuário com acesso de leitura requisita os anexos agregados de um projeto
- **THEN** o sistema retorna os anexos dos cards do projeto no tenant, cada um com o card de origem

#### Scenario: Anexos desabilitados para o tenant

- **WHEN** a capacidade de anexos está desabilitada para o tenant e o usuário abre a modal do projeto
- **THEN** a aba "Todos os anexos" não é exibida, mantendo-se apenas links e demais informações
- **AND** a leitura agregada de anexos permanece disponível a usuários autorizados, consistente com a leitura de conteúdo do item

#### Scenario: Projeto sem anexos

- **WHEN** o projeto não possui anexos em nenhum card
- **THEN** o sistema retorna uma lista vazia

#### Scenario: Isolamento entre projetos e tenants

- **WHEN** um usuário sem membership requisita os anexos agregados de um projeto não autorizado
- **THEN** o sistema rejeita a operação sem revelar anexos de outro tenant, projeto ou card

#### Scenario: Download a partir da lista agregada

- **WHEN** o usuário aciona o download de um anexo a partir da lista agregada do projeto
- **THEN** o sistema entrega o arquivo pela rota autenticada, validando membership e associação ao card de origem

---

### Requirement: Miniaturas de imagem na lista de anexos do card

A lista de anexos do card SHALL exibir uma miniatura para anexos de imagem raster
aprovados para exibição inline, carregada de forma assíncrona e independente por
item. A miniatura SHALL usar o arquivo original pela rota autenticada, sem gerar
imagem no servidor, e SHALL abrir o lightbox ao ser acionada.

#### Scenario: Miniatura exibida para imagem

- **WHEN** o card possui um anexo de imagem aprovada para exibição inline
- **THEN** a lista mostra uma miniatura legível que aparece assim que o arquivo termina de carregar

#### Scenario: Carregamento assíncrono não bloqueia a lista

- **WHEN** a lista de anexos é aberta com um ou mais anexos de imagem
- **THEN** a lista e os demais itens aparecem imediatamente e cada miniatura é carregada de forma independente, reservando um espaço/estado de carregamento até ficar pronta

#### Scenario: Clique abre o lightbox

- **WHEN** o usuário aciona a miniatura de uma imagem na lista do card
- **THEN** o lightbox abre na imagem correspondente, com a navegação entre as imagens do card

#### Scenario: Formato não exibível inline

- **WHEN** o anexo é SVG, PDF ou outro formato sem miniatura aprovada
- **THEN** a lista exibe um ícone de arquivo no lugar da miniatura, sem executar o conteúdo na origem

#### Scenario: Falha ao carregar a miniatura

- **WHEN** o carregamento da miniatura falha
- **THEN** o item exibe um estado de falha (ícone) sem quebrar a lista nem os demais anexos

### Requirement: Indicador de anexos no card do board
O card do Kanban SHALL exibir um ícone de clipe acompanhado do contador de anexos do item, somente quando o item tiver ao menos um anexo e a capacidade de anexos estiver habilitada no tenant. O contador SHALL refletir a quantidade real de anexos do item, derivado de leitura agregada por projeto, sem consulta individual por item.

#### Scenario: Card com anexos mostra o contador
- **WHEN** o board é exibido em um tenant com anexos habilitados e um card tem N anexos, com N maior ou igual a 1
- **THEN** o card mostra o clipe com o número N

#### Scenario: Card sem anexos não mostra o indicador
- **WHEN** o card não tem nenhum anexo
- **THEN** o card não mostra nem o clipe nem o contador

#### Scenario: Capacidade de anexos desabilitada no tenant
- **WHEN** a capacidade de anexos está desabilitada no tenant
- **THEN** nenhum card mostra o indicador de anexos, mesmo que existam anexos registrados no projeto

#### Scenario: Contagem sem consulta por item
- **WHEN** o board é carregado com vários cards
- **THEN** a contagem de anexos de cada card vem de uma única leitura agregada por projeto, sem consulta individual por item

#### Scenario: Anúncio acessível do indicador
- **WHEN** o indicador de anexos é lido por tecnologia assistiva
- **THEN** ele expõe rótulo traduzido com a quantidade de anexos do card
