# installation-profiles Specification

## Purpose
Definir os perfis de instalação SIMPLE e ADVANCED, a configuração imutável por instalação e seus limites operacionais.

## Requirements

### Requirement: Perfil de instalação explícito e independente do modo do board

O Azy Board SHALL suportar os perfis `SIMPLE` e `ADVANCED` por instalação, usando a mesma codebase. Na ausência de escolha, SHALL selecionar `SIMPLE`. A escolha SHALL ser feita no setup/configuração do servidor, não no cadastro do projeto nem por contagem de usuários; o limite aproximado de 20 pessoas SHALL ser apenas orientação de capacidade, sem bloqueio de acesso.

#### Scenario: Instalação sem perfil informado
- **WHEN** o operador instala o sistema sem indicar perfil
- **THEN** o setup inicia no perfil SIMPLE com SQLite e sem exigir PostgreSQL ou Redis

#### Scenario: Projeto simples em instalação avançada
- **WHEN** um usuário cria projeto `boardMode = SIMPLE` em uma instalação ADVANCED
- **THEN** o board continua simples e o banco da instalação continua PostgreSQL

#### Scenario: Mais usuários no perfil simples
- **WHEN** o número de usuários ultrapassa a recomendação documentada de tamanho
- **THEN** o sistema não muda de perfil nem bloqueia usuários automaticamente

### Requirement: Configuração segura e imutável durante a operação

O bootstrap da API, setup e migrations SHALL validar perfil, URL do banco, credenciais, disponibilidade de serviços e **marcadores associados no volume persistente da instância e no banco** antes de aceitar gravações. Os marcadores SHALL registrar identidade, perfil e revisão sem guardar segredos. SIMPLE SHALL aceitar apenas SQLite e ADVANCED SHALL exigir PostgreSQL e serviço Redis-compatível. O perfil registrado de uma instalação SHALL ser permanente: alterar apenas configuração, URL ou ambiente não SHALL converter a instalação, mesmo quando a nova URL aponta para banco vazio. Erros de configuração SHALL omitir credenciais das mensagens/logs.

#### Scenario: Configuração cruzada inválida
- **WHEN** o perfil SIMPLE recebe URL PostgreSQL, ou ADVANCED recebe URL SQLite/Redis ausente
- **THEN** o comando falha antes da primeira mutação e informa quais parâmetros são incompatíveis sem imprimir segredos

#### Scenario: Redis indisponível no avançado
- **WHEN** PostgreSQL está acessível, mas o serviço Redis-compatível não responde
- **THEN** o perfil ADVANCED não é considerado pronto para atender solicitações que dependem da coordenação

#### Scenario: Banco de perfil diferente
- **WHEN** o operador aponta a API para um banco com marcador de perfil/schema incompatível
- **THEN** o startup é recusado sem converter dados implicitamente

#### Scenario: Instância existente apontada para banco novo
- **WHEN** o operador altera o perfil ou a URL para banco vazio mas reutiliza o volume persistente de uma instalação já marcada
- **THEN** o startup/setup recusa a troca sem criar tenant, migrar dados ou substituir marcadores

#### Scenario: SQLite legado sem marcador
- **WHEN** uma instalação SQLite existente não tem marcador de perfil
- **THEN** o bootstrap identifica e valida a base como SIMPLE antes de registrar marcadores vinculados no banco e no volume, sem criar outro tenant ou reescrever cards

#### Scenario: Marcador do volume desaparece
- **WHEN** uma instalação com banco populada perde o marcador do volume persistente após o setup
- **THEN** o startup é recusado até a recuperação operacional verificada, sem tratar o banco como instalação nova

### Requirement: SQLite local funcional sem infraestrutura avançada

No perfil SIMPLE o sistema SHALL conservar setup, migrations, autenticação, projetos, board, MCP, agente e anexos com SQLite e storage local, sem inicializar Redis nem PostgreSQL. Um operador SHALL conseguir testar a aplicação a partir de clone e poucos comandos documentados, sem contas em provedores externos além das já necessárias a funcionalidades opcionais.

#### Scenario: Primeira execução local
- **WHEN** o operador segue o guia padrão num ambiente com Bun e sem Redis/PostgreSQL
- **THEN** migração, setup de tenant/admin e API iniciam com SQLite, e o fluxo web/API continua funcional

#### Scenario: Produção pequena
- **WHEN** o operador escolhe SIMPLE para uma instância pequena com volumes persistentes e backups configurados
- **THEN** o sistema permite a instalação sem impor Redis/PostgreSQL

### Requirement: Persistência por ports tipados e adapters de dialect

Rotas, serviços de domínio, API REST e MCP SHALL consumir ports/repositórios tipados independentes do dialect. Implementações SQLite e PostgreSQL SHALL satisfazer os mesmos ports e SHALL manter driver, schema Drizzle, SQL e migrations específicos dentro dos respectivos adapters. A seleção do adapter SHALL ocorrer após validar perfil e marcadores, antes de aceitar operações. O código de domínio SHALL NOT converter um adapter no outro com cast nem importar tabelas SQLite diretamente para consultas PostgreSQL.

#### Scenario: SIMPLE seleciona adapter SQLite
- **WHEN** uma instalação SIMPLE passa a validação de perfil e marcadores
- **THEN** o factory injeta o adapter SQLite aos ports e não inicializa pool PostgreSQL nem cliente Redis

#### Scenario: ADVANCED seleciona adapter PostgreSQL
- **WHEN** uma instalação ADVANCED passa validação de PostgreSQL, Redis e marcadores
- **THEN** o factory injeta o adapter PostgreSQL aos mesmos ports usados pelos fluxos REST e MCP

#### Scenario: Regras de domínio não dependem de tabela Drizzle
- **WHEN** um handler executa autenticação, hierarquia, autorização ou mutação transacional
- **THEN** ele usa o contrato tipado do repositório/UnitOfWork e não importa tabela nem sessão do driver

#### Scenario: Transação aborta atomicamente nos dois adapters
- **WHEN** uma operação de domínio falha após iniciar uma mutação multi-tabela
- **THEN** o UnitOfWork reverte todas as gravações no adapter SQLite e no PostgreSQL

### Requirement: PostgreSQL equivalente no perfil avançado

No perfil ADVANCED o sistema SHALL usar realmente PostgreSQL, com schema/migrations próprios e execução de todos os fluxos persistentes da API e do MCP. O resultado observável das regras de domínio, isolamento por tenant, identidade global por e-mail, Leaf Rule, constraints, histórico, anexos, credenciais cifradas e contratos HTTP SHALL permanecer equivalente ao SIMPLE. SQL dependente de SQLite SHALL ser convertido por dialect e SHALL NOT ser executado no PostgreSQL.

#### Scenario: Instalação avançada nova
- **WHEN** um operador provisiona PostgreSQL vazio e executa migrations/setup no perfil ADVANCED
- **THEN** tenant/admin, projetos e cartões persistem no PostgreSQL e continuam disponíveis após reinício

#### Scenario: Integridade entre tenants nos dois bancos
- **WHEN** uma operação tenta associar item, membro ou anexo a recurso de outro tenant em qualquer perfil
- **THEN** o banco e a API rejeitam o vínculo sem gravação parcial

#### Scenario: Contratos de domínio equivalentes
- **WHEN** as jornadas de autenticação, criação, hierarquia, exclusão e MCP são executadas em SIMPLE e ADVANCED
- **THEN** ambas preservam IDs, timestamps/valores expostos e os mesmos resultados ou códigos de erro relevantes

#### Scenario: Migration avançada reexecutada
- **WHEN** migrations PostgreSQL são aplicadas a uma base já na mesma versão
- **THEN** são idempotentes e não alteram dados válidos nem reaplicam journal SQLite

### Requirement: Redis-compatível usado como coordenação transitória

ADVANCED SHALL exigir e usar efetivamente um serviço Redis-compatível permissivo (Valkey é a referência comunitária) para rate limiting transitório do agente e publicação de eventos do board; SIMPLE SHALL usar seus mecanismos locais existentes. Chaves e canais SHALL manter escopo de tenant/projeto, e operações protegidas SHALL falhar de modo seguro se o limite não puder ser verificado. Redis/pub-sub SHALL NOT ser apresentado como persistência da fila do agente nem como replay de eventos.

#### Scenario: Execução avançada com coordenação
- **WHEN** a API executa rate limiting do agente ou broadcast do board em ADVANCED
- **THEN** usa o adapter Redis-compatível com chaves/canais escopados e sem expor credenciais

#### Scenario: Execução simples sem Redis
- **WHEN** a API inicia em SIMPLE sem `REDIS_URL`
- **THEN** o chat e o board permanecem operacionais sem tentar conectar ao serviço avançado

#### Scenario: Falha de coordenação durante requisição
- **WHEN** o Redis fica indisponível ao validar um limite de escrita do agente
- **THEN** a mutação não é liberada por fallback permissivo

### Requirement: Escolha definitiva no setup e nova instalação para outro perfil

O sistema SHALL registrar o perfil no primeiro setup de cada instalação, vinculando seu banco ao volume persistente da instância. Quem desejar usar o outro perfil SHALL executar um novo setup em outra instância, com banco e volume novos e sem transferência automática de usuários, tenants, cards, anexos ou histórico. O produto SHALL NOT fornecer migração de dados, assistente de upgrade, importação/cutover SQLite → PostgreSQL ou retorno PostgreSQL → SQLite. Migrations de **schema dentro do perfil escolhido** continuam permitidas; elas SHALL NOT alterar o perfil registrado nem converter o banco entre dialects.

#### Scenario: Avaliação em SQLite seguida de nova instalação avançada
- **WHEN** o operador decide descartar os dados de testes do perfil SIMPLE e escolhe ADVANCED
- **THEN** faz setup em outra instância com PostgreSQL novo e usa o ADVANCED do zero, sem importar automaticamente os dados do SQLite

#### Scenario: SQLite em produção com dados a preservar
- **WHEN** um operador de SIMPLE quer começar a usar ADVANCED e manter os dados existentes
- **THEN** o Azy Board não promete transporte dos dados nem oferece ferramenta de migração; o operador precisa de um projeto externo de migração para a nova instalação

#### Scenario: Tentativa de mudar SIMPLE para ADVANCED na mesma instalação
- **WHEN** o operador configura ADVANCED sobre uma instalação marcada como SIMPLE, mesmo com novo `DATABASE_URL`
- **THEN** o startup/setup é recusado sem alterar a base nem importar dados

#### Scenario: Tentativa de mudar ADVANCED para SIMPLE na mesma instalação
- **WHEN** o operador configura SIMPLE sobre uma instalação marcada como ADVANCED
- **THEN** o startup/setup é recusado; caso deseje SQLite, precisa de outra instalação com banco novo

#### Scenario: Migration de schema no perfil atual
- **WHEN** o operador atualiza a versão da aplicação e executa migrations no banco do perfil já registrado
- **THEN** o schema é atualizado conforme o dialect desse perfil, sem alterar seu marcador nem fazer migração de dados entre perfis

### Requirement: Limites operacionais publicados sem prometer alta disponibilidade

Os guias SHALL explicar recursos e backups necessários **para cada instalação**, inclusive o marcador persistido no volume, a diferença entre perfil da instalação e modo do board, a recomendação aproximada de capacidade e o caráter definitivo da escolha: para mudar de perfil é preciso nova instalação, sem migração de dados fornecida pelo produto. ADVANCED SHALL ser publicado inicialmente com uma instância de API; múltiplas instâncias/HA SHALL permanecer desabilitadas até que a fila/worker do agente (Item 4), a reconciliação do board (Item 20) e os controles distribuídos restantes sejam implementados e verificados.

#### Scenario: Guia da instalação leve
- **WHEN** alguém procura o caminho mais curto para avaliar o Azy Board
- **THEN** encontra SIMPLE como padrão, com passos completos sem PostgreSQL/Redis

#### Scenario: Guia avançado
- **WHEN** alguém escolhe ADVANCED
- **THEN** encontra dependências, configuração por variável de ambiente, backups e restore do próprio PostgreSQL, TLS, limitações de réplicas e aviso de que o setup começa com banco novo e não importa dados de outra instalação

#### Scenario: Tentativa de múltiplas réplicas antes dos dependentes
- **WHEN** um operador tenta habilitar topologia multi-instância ainda não suportada
- **THEN** a configuração ou documentação bloqueia essa operação em vez de anunciá-la como segura
