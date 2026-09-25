## Why

Hoje o Azy Board inicia facilmente com SQLite, inclusive no deploy atual, mas o card T1 pede que essa experiência continue sendo o padrão e que a mesma codebase também ofereça um caminho avançado com PostgreSQL e Redis. A troca de banco ainda não existe: driver, schema, migrations, SQL, testes e operação são específicos de SQLite. Apresentar apenas uma variável de ambiente como solução criaria uma opção avançada que não funciona.

Board ref: 732e4f5b-872e-4a29-9958-d66ed0b43e0d (inclui o antigo Item 9).

## What Changes

- Criar **perfis de instalação**, independentes do `boardMode` dos projetos: `SIMPLE` (padrão, SQLite local, sem Redis) e `ADVANCED` (PostgreSQL e Redis explicitamente configurados), escolhidos **uma única vez no setup de cada instalação**, nunca automaticamente pelo número de usuários.
- Manter o caminho simples de desenvolvimento, avaliação e produção pequena com poucos comandos e sem novos serviços obrigatórios. A recomendação de até aproximadamente 20 pessoas orienta a escolha, mas não é uma restrição de conta nem uma promessa de desempenho.
- Implementar suporte real ao PostgreSQL com schema, migrations, queries e testes equivalentes ao SQLite; não afirmar que o banco muda por uma linha. Provisionar e usar Redis para coordenação transitória necessária ao perfil avançado, com falha explícita em caso de configuração/indisponibilidade, sem torná-lo dependência do perfil simples.
- Permitir uma instalação avançada **nova, com banco novo e volume persistente próprio**. O perfil de uma instalação existente não pode ser alterado, nem de SIMPLE para ADVANCED nem no sentido contrário. Para escolher outro perfil, o operador deve fazer um novo setup em uma nova instância; dados da instância antiga não são transportados pela aplicação. Marcadores na instância e no banco impedem que trocar apenas `DATABASE_URL` contorne a decisão.
- Deixar explícito que **migração de dados entre perfis não faz parte do produto**: uma avaliação em SQLite pode ser descartada; quem precisar conservar dados de uma instalação SQLite em produção deverá planejar uma migração própria fora deste escopo. Migrations normais de schema dentro do perfil escolhido continuam existindo.
- Documentar o limite da entrega: `ADVANCED` não implica alta disponibilidade nem múltiplas instâncias liberadas; a fila/worker do Azy Agent (Item 4) e o protocolo de reconciliação WebSocket (Item 20) têm seus próprios cards. Não publicar uma topologia multi-instância antes de tratar essas dependências e validá-la.
- Adicionar testes de paridade e um gate de CI com PostgreSQL/Redis, preservando o `bun run check` e o fluxo local sem serviços extras.

## Capabilities

### New Capabilities

- `installation-profiles`: Seleção definitiva e validação de perfil por instalação, runtime SQLite/PostgreSQL, Redis no perfil avançado, setup de bancos novos, compatibilidade funcional e limites operacionais explícitos, sem migração de dados entre perfis.

### Modified Capabilities

- `continuous-integration`: Exigir matriz de testes dos dois perfis e verificação de migrations/paridade no PostgreSQL sem tornar PostgreSQL/Redis obrigatórios para o check local simples.

## Impact

- API: `apps/api/src/db/{index,schema,migrate,integrity}.ts`, SQL nas rotas/serviços, setup, inicialização, WebSocket, limitações de coordenação do agente; novos adapters e migrations PostgreSQL separados dos artefatos SQLite.
- Configuração: `apps/api/.env.example`, scripts do monorepo, lockfile, dependências permissivas de PostgreSQL/Redis e exemplos de deploy por perfil.
- Operação: instalação nova por perfil, recusa de reconfiguração de perfil em instâncias existentes e orientação sobre destino dos dados antigos; backups e migrations **de schema** seguem a rotina normal de cada instalação, sem importação/cutover entre bancos.
- Verificação: testes API/MCP/E2E em ambos os perfis, smoke e jobs de CI; README, `DEPLOY.md` e documentação de compatibilidade.
- Não altera o modo SIMPLE/HIERARCHICAL de um projeto nem inicia o Item 4, Item 14, Item 20 ou Item 31 por conta própria.
