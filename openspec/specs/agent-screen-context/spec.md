# agent-screen-context Specification

## Purpose
TBD - created by archiving change add-agent-screen-context. Update Purpose after archive.
## Requirements
### Requirement: Fotografia do contexto da tela
O frontend SHALL capturar e transportar, no envio de cada pedido ao Azy Agent, uma fotografia versionada do contexto de trabalho contendo: tela, projeto (id e nome), modo de visualização (Kanban ou árvore), aba de módulo ativa, grupos recolhidos, filtros ativos com semântica explícita de ausência de valor e o modo de escopo (`scope: 'ALL' | 'FILTERED'`) que determina se IDs viajam. IDs de agrupadores e histórias virtuais NÃO SHALL ser enviados como IDs persistidos de cards. O transporte é opcional: clientes sem fotografia continuam funcionando.

#### Scenario: Sem filtro nenhum, a ação vale para todos sem enviar IDs
- **WHEN** usuário envia mensagem no board sem nenhum filtro aplicado
- **THEN** a fotografia declara `scope: 'ALL'` e NÃO envia a lista de IDs; o agente sabe que a ação é aplicável a todos os cards do projeto

#### Scenario: Envio com filtro declara o conjunto específico
- **WHEN** usuário envia mensagem no board Kanban com filtros ativos
- **THEN** a fotografia declara `scope: 'FILTERED'` e inclui os IDs reais apresentados (inclusive de grupos recolhidos e da aba de módulo ativa), `displayedCount` e `isComplete`

#### Scenario: Conjunto enorme acima do limite vira referência
- **WHEN** o conjunto capturado excede o limite definido
- **THEN** o snapshot é persistido no servidor e os args apenas o referenciam — sem truncamento silencioso

#### Scenario: Agrupadores e histórias virtuais não entram no conjunto
- **WHEN** o board apresenta histórias/épicos como agrupadores e histórias virtuais
- **THEN** a fotografia não os lista em `displayedItemIds`

#### Scenario: Ausência de valor é expressa por operador
- **WHEN** usuário aplica os filtros “sem sprint” e “sem versão”
- **THEN** a fotografia expressa a ausência por operador tipado, e não como ID, nome de entidade ou sentinela da interface

### Requirement: Fixação do snapshot na execução e na aprovação
O servidor SHALL validar a fotografia recebida e fixá-la na execução do run, persistindo-a junto do run e incluindo-a no contexto autoritativo do modelo. A execução enfileirada e a retomada do worker SHALL usar o mesmo snapshot. Navegar ou alterar filtros após o envio MUST NOT alterar o escopo pendente.

#### Scenario: Escopo não muda com navegação posterior
- **WHEN** usuário envia o pedido e, em seguida, altera filtros ou navega entre telas
- **THEN** a execução pendente continua usando a fotografia capturada no envio

#### Scenario: Snapshot presente no prompt autoritativo
- **WHEN** o servidor processa a mensagem
- **THEN** o contexto formatado para o modelo inclui a fotografia do resultado exibido

#### Scenario: Retomada da fila preserva o snapshot
- **WHEN** o run é retomado após reinício do processo ou expiração de lease
- **THEN** o mesmo snapshot é usado na continuação

### Requirement: Escopo travado para mutação em lote
Com fotografia presente, o servidor SHALL aplicar a mutação conforme o modo de escopo: `scope: 'ALL'` (nenhum filtro aplicado) usa o `matchAll` já imposto pelo harness com a população resolvida e contada server-side; `scope: 'FILTERED'` aplica a mutação somente aos IDs fixados, bloqueando re-filtragem que busque população além do conjunto. Sprint e versão SHALL ser resolvidas no catálogo do projeto correto; destino ambíguo ou sprint fechada NÃO SHALL gerar associação indevida. O servidor SHALL validar acesso a cada ID antes da mutação.

#### Scenario: Sem filtro, mutação em tudo resolvida no servidor
- **WHEN** usuário aprova aplicar sprint/versão sem nenhum filtro ativo
- **THEN** o servidor aplica a mutação com `matchAll`, resolve e conta a população no servidor e retorna o resultado por item

#### Scenario: Aplica somente aos cards capturados
- **WHEN** usuário aprova aplicar sprint e versão ao resultado exibido
- **THEN** apenas os IDs da fotografia são alterados

#### Scenario: Card novo correspondente não entra na operação
- **WHEN** um card passa a corresponder ao filtro após o envio
- **THEN** ele não entra na operação aprovada

#### Scenario: Sprint fechada ou destino ambíguo
- **WHEN** o destino de sprint é híbrido fechado/ambíguo ou a versão não existe no projeto
- **THEN** o servidor recusa a associação e explica o motivo

#### Scenario: IDs sem acesso ou de outro projeto
- **WHEN** a fotografia carrega IDs de outro projeto/tenant ou sem acesso do autor
- **THEN** o servidor recusa antes de executar qualquer mutação

### Requirement: Prévia com contagem e alterações por card
A prévia de aprovação de `update_items` SHALL exibir a quantidade do conjunto capturado e as alterações por card/campo (ex.: “N cards do resultado exibido; sprint vazia → Sprint 1; versão vazia → v1.0.0”), com lista completa acessível. Limites excedidos MUST NOT produzir truncamento silencioso; a finalização SHALL distinguir atualizados, conflitos e falhas.

#### Scenario: Prévia mostra quantidade e diferenças
- **WHEN** a prévia é gerada para uma mutação escopada pela fotografia
- **THEN** ela informa a quantidade do conjunto e as diferenças por campo/item

#### Scenario: Execução única e rastreável
- **WHEN** a execução é repetida ou retomada
- **THEN** nenhum efeito é duplicado e o resultado por item é registrado

### Requirement: Conflito concorrente visível
Divergência entre as revisões capturadas na fotografia e o estado corrente SHALL gerar conflito visível na execução, seguido de recálculo de prévia com o mesmo conjunto — sem ampliar a população silenciosamente.

#### Scenario: Escrita de terceiros entre prévia e aprovação
- **WHEN** um card capturado é alterado por outra pessoa antes da aprovação/execução
- **THEN** o servidor sinaliza o conflito dos itens divergentes e o chat recalcula a prévia com o mesmo conjunto

### Requirement: Resultado vazio não amplia escopo
Zero cards capturados ou correspondidos NÃO SHALL produzir mutação nem fallback para todo o projeto; o chat explica o resultado. O board atualizado SHALL deixar claro quando cards desaparecem por deixarem de corresponder aos filtros.

#### Scenario: Filtro sem resultados
- **WHEN** a fotografia captura zero cards
- **THEN** nenhuma mutação ocorre e o chat explica

#### Scenario: Board explica desaparecimento
- **WHEN** os cards atualizados deixam de corresponder aos filtros ativos
- **THEN** a interface informa o motivo do desaparecimento

### Requirement: Semântica da apresentação para o escopo
O sistema SHALL definir e testar a semântica do escopo por apresentação: aba de módulo ativa, grupos recolhidos, árvore (nós de agrupamento × itens que recebem ação), paginação e virtualização do DOM. A captura MUST NOT depender da janela de rolagem. Quando a população exibida for parcial, o snapshot SHALL declarar `isComplete = false` com contagem total server-side.

#### Scenario: Aba de módulo ativa
- **WHEN** a visualização usa abas de módulo
- **THEN** a fotografia inclui o módulo ativo e o conjunto correspondente à aba

#### Scenario: Grupos recolhidos continuam no resultado
- **WHEN** um grupo do board está recolhido
- **THEN** seus cards continuam contando no conjunto capturado

#### Scenario: Virtualização não exclui cards
- **WHEN** a interface virtualiza a renderização fora da janela de rolagem
- **THEN** o conjunto capturado não fica restrito aos pixels visíveis

#### Scenario: Parcialidade declarada
- **WHEN** a população exibida é parcial (paginação)
- **THEN** o snapshot declara `isComplete = false` com `totalMatchingCount` completo

### Requirement: Internacionalização do escopo
O sistema SHALL fornecer traduções em PT-BR, EN e ES para os rótulos de escopo interpretado, prévia e mensagens de conflito/vazio no chat.

#### Scenario: Idioma do chat
- **WHEN** usuário troca o idioma da interface
- **THEN** os rótulos de escopo, prévia e conflito são exibidos no idioma selecionado

