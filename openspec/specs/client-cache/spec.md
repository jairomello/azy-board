## Purpose

Definir a camada de cache e sincronização do estado remoto no web, cobrindo chaves de cache, cancelamento, invalidação por eventos WebSocket e política de validade.

## Requirements

### Requirement: Camada única de cache de estado remoto
O web SHALL manter o estado remoto em uma camada de cache única, com chaves escopadas por identidade autenticada e por projeto, de modo que telas que consomem os mesmos dados compartilhem a mesma entrada de cache e não busquem dados duplicados.

#### Scenario: Mesmos dados não são buscados duas vezes
- **WHEN** duas telas consomem a mesma consulta (mesma identidade e mesmo projeto) dentro da janela de validade
- **THEN** o sistema reaproveita a entrada de cache e não dispara uma nova requisição

#### Scenario: Isolamento entre projetos
- **WHEN** o usuário alterna do Projeto A para o Projeto B
- **THEN** os dados do Projeto A não são exibidos para o Projeto B e cada projeto tem entrada de cache própria

#### Scenario: Isolamento entre identidades
- **WHEN** o usuário faz logout e outra conta autentica no mesmo navegador
- **THEN** o cache da identidade anterior é descartado e não vaza para a nova conta

### Requirement: Cancelamento e descarte de respostas obsoletas
O sistema SHALL cancelar requisições em andamento quando os parâmetros de uma consulta mudam ou o componente deixa de consumi-la, e SHALL descartar respostas de requisições obsoletas para que não sobrescrevam o estado atual. O cancelamento SHALL NOT ser apresentado ao usuário como erro.

#### Scenario: Troca de projeto durante o carregamento
- **WHEN** o usuário troca de projeto enquanto uma requisição do projeto anterior está em andamento
- **THEN** a requisição anterior é cancelada e a resposta antiga não sobrescreve o estado do projeto novo

#### Scenario: Mudança de filtros no dashboard
- **WHEN** o usuário altera filtros que mudam a consulta do dashboard rapidamente
- **THEN** apenas o resultado da consulta mais recente é aplicado ao estado

#### Scenario: Cancelamento não é erro
- **WHEN** uma requisição é cancelada por mudança de parâmetros
- **THEN** o sistema não exibe mensagem de erro nem registra falha para o usuário

### Requirement: Invalidação e sincronização por eventos WebSocket
O sistema SHALL reconciliar o cache com eventos WebSocket do projeto ativo, aplicando atualizações incrementais quando possível e invalidando/refazendo a consulta quando necessário. Ao reconectar após uma queda, o sistema SHALL refazer as consultas ativas do projeto para sincronizar mudanças perdidas.

#### Scenario: Evento do board atualiza o cache
- **WHEN** um evento de card do projeto ativo é recebido
- **THEN** a entrada de cache do board do projeto é atualizada sem exigir recarregamento manual da tela

#### Scenario: Evento invalida o dashboard
- **WHEN** um evento que altera métricas do projeto ativo é recebido
- **THEN** a consulta do dashboard do projeto é invalidada e refeita de forma coerente

#### Scenario: Reconexão ressincroniza o estado
- **WHEN** a conexão WebSocket é restabelecida após uma queda
- **THEN** as consultas ativas do projeto são refeitas para reconciliar mudanças ocorridas durante a desconexão

### Requirement: Estado remoto separado e mutações otimistas com rollback
O sistema SHALL manter o estado de servidor na camada de cache, separado do estado de UI, e SHALL aplicar mutações otimistas com rollback quando a operação falhar, sem deixar o cache divergente.

#### Scenario: Atualização otimista revertida em falha
- **WHEN** uma mutação otimista do board falha na API
- **THEN** o cache retorna ao estado anterior e o usuário é informado do erro

#### Scenario: Estado de UI não é persistido como dado de servidor
- **WHEN** o usuário altera um filtro ou abre um modal
- **THEN** esse estado permanece local e não é tratado como dado remoto

### Requirement: Política de validade e revalidação explícita
O sistema SHALL definir de forma explícita, em um ponto único, a política de validade (`staleTime`/`gcTime`), retentativas e revalidação no foco para as consultas migradas, evitando requisições repetidas desnecessárias.

#### Scenario: Consulta reutilizada dentro da validade
- **WHEN** uma consulta é remontada dentro do tempo de validade
- **THEN** o cache é servido imediatamente sem nova requisição

#### Scenario: Revalidação no foco apenas onde configurada
- **WHEN** a janela recebe foco
- **THEN** somente as consultas configuradas para revalidar no foco são refeitas
