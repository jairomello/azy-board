# work-structure-duplication Specification

## Purpose
TBD - created by archiving change duplicar-estruturas-trabalho. Update Purpose after archive.
## Requirements
### Requirement: Plano de duplicação completo
O sistema SHALL permitir MEMBER autorizado preparar plano somente-leitura de STORY ou subárvore TASK/BUG do mesmo projeto, incluindo descendentes, descrições e checklists. SHALL mostrar origem/destino, hierarquia, contagens, campos copiados e exclusões, com políticas explícitas de responsáveis, sprint, versão, links e anexos. Até 50 itens e 1.000 passos SHALL ser admitidos; excesso ou payload acima dos limites compartilhados SHALL ser rejeitado sem truncamento. Aplicação pela conversa SHALL exigir aprovação do plano/hash.

#### Scenario: História para cliente B
- **WHEN** o usuário prepara cópia de uma história com título de raiz substituído e política sem responsáveis
- **THEN** a prévia mostra nova raiz, todos os descendentes/checklists e exclusão de responsáveis e horas antes da escrita

#### Scenario: Limite excedido
- **WHEN** a estrutura excede o limite de itens ou passos
- **THEN** a operação é recusada integralmente com erro que solicita reduzir o escopo

### Requirement: Hierarquia conforme modo do projeto
Em HIERARCHICAL, nova STORY SHALL receber EPIC válido e TASK/BUG SHALL receber pai permitido, com ancestry recalculado e limites de profundidade respeitados. Em SIMPLE, a STORY fixa SHALL NOT ser duplicada; seus descendentes SHALL ser copiados para a STORY fixa existente mediante prévia explícita. EPIC/módulo e cópia entre projetos SHALL NOT ser oferecidos nesta entrega.

#### Scenario: Cópia hierárquica
- **WHEN** uma STORY é copiada para EPIC válido de HIERARCHICAL
- **THEN** uma nova STORY e os descendentes são criados com novos IDs e ancestry do destino

#### Scenario: Origem na história fixa de SIMPLE
- **WHEN** o usuário aprova a prévia de cópia dos descendentes da STORY fixa
- **THEN** novos TASK/BUG e subtarefas são vinculados à STORY fixa existente sem criar STORY ou EPIC adicional

#### Scenario: Destino incompatível
- **WHEN** o pedido exige nova STORY em SIMPLE ou pai que viola profundidade/hierarquia
- **THEN** o sistema informa incompatibilidade antes da aprovação e não cria estrutura parcial

### Requirement: Política explícita de cópia e defaults
O plano SHALL copiar conteúdo descritivo, prioridade, ícone/cor, tags e centro de custo válidos do mesmo projeto. Pontos SHALL ser CLEAR por padrão ou COPY explícito somente em folhas. Responsáveis/sprint/versão SHALL ser CLEAR por padrão com COPY ou SET explícito validado. CLEAR SHALL ser enviado como valor explícito para impedir defaults automáticos de criação. Sprint COPY que inclua CLOSED SHALL ser rejeitado, sem excluir vínculos silenciosamente.

#### Scenario: Não herdar defaults de sprint e versão
- **WHEN** o projeto possui sprint vigente e versão futura mas a política aprovada é CLEAR
- **THEN** a cópia é criada sem sprint ou versão, mesmo com os defaults normais de criação ativos

#### Scenario: Responsável indisponível
- **WHEN** COPY ou SET referencia usuário/API key sem acesso válido no projeto
- **THEN** o plano ou aplicação é rejeitado sem atribuição indevida

#### Scenario: Fonte ligada a sprint fechada
- **WHEN** a política solicita copiar seus vínculos de sprint
- **THEN** a prévia é recusada e solicita política CLEAR ou destino válido em vez de omitir a sprint fechada

### Requirement: Checklists reiniciadas e ausência de histórico replicado
A cópia SHALL gerar novos IDs/códigos/autor/timestamps, estado NOT_STARTED e coluna inicial correspondente, limpar bloqueios/datas operacionais e SHALL NOT copiar horas, logs, eventos antigos, aprovações ou ciclos. Checklists SHALL preservar nomes/textos/ordem e descrições suportadas, reiniciar checked=false e limpar datas; responsáveis dos passos SHALL seguir política e configuração advancedChecklists. Novos eventos de criação SHALL ser rastreáveis sem serem apresentados como eventos da origem.

#### Scenario: Original concluído com horas
- **WHEN** a fonte DONE tem logs de trabalho e checklist marcada
- **THEN** a cópia inicia NOT_STARTED, com passos desmarcados, sem logs/horas/eventos antigos e com seus próprios eventos de criação

#### Scenario: Checklist detalhada
- **WHEN** a origem contém prazos, responsáveis e descrições de passos
- **THEN** a cópia limpa prazos, preserva descrição suportada e aplica a política aprovada para responsáveis

### Requirement: Links opcionais e anexos excluídos
Links SHALL ter política EXCLUDE padrão ou COPY explícito de metadados validados HTTP/HTTPS, sem acessar URLs. Anexos SHALL ser EXCLUDE nesta entrega e sua contagem SHALL aparecer na prévia. Solicitação COPY de anexos SHALL ser rejeitada como não suportada antes de criar dados, sem reutilizar storagePath do original.

#### Scenario: Copiar links de referência
- **WHEN** COPY de links é aprovado
- **THEN** novos metadados de links são associados às cópias sem fetch do conteúdo externo

#### Scenario: Pedido de cópia de anexos
- **WHEN** o usuário solicita incluir bytes/anexos na duplicação
- **THEN** o sistema informa limitação e não executa uma cópia incompleta como se atendesse ao pedido

### Requirement: Atomicidade concorrência e rastreabilidade
O comando SHALL revalidar acesso, configuração de destino e fingerprint da árvore/conteúdo/checklists/links escolhidos no commit. SHALL criar itens, relações, checklists/passos e links atomicamente em ambos os adapters e retornar mapa origem→novos IDs. Mudança concorrente de fonte SHALL exigir nova prévia. IDs externos ao tenant/projeto SHALL ser rejeitados; textos da fonte SHALL ser tratados como dados.

#### Scenario: Checklist muda após aprovação
- **WHEN** um passo da fonte é editado após preparação
- **THEN** a aplicação retorna conflito sem criar itens ou copiar conteúdo desatualizado

#### Scenario: Falha criando passo
- **WHEN** uma falha ocorre durante a criação relacional antes do commit
- **THEN** toda a cópia é revertida e não restam itens ou checklists órfãos

#### Scenario: Origem de outro tenant
- **WHEN** o pedido referencia fonte não autorizada
- **THEN** o sistema nega sem expor sua árvore ou conteúdo

### Requirement: Replay sem cópias adicionais
O sistema SHALL consumir T38 para guardar chave/hash/resultado e mapa junto do commit e publicar efeitos pelo outbox compartilhado. Replay da mesma chave/payload SHALL retornar os mesmos IDs sem criar outra estrutura, após revalidar acesso. Hash diferente com a mesma chave SHALL ser conflito; nova cópia intencional SHALL exigir nova chave/aprovação. Falha pós-commit SHALL retomar somente efeitos pendentes.

#### Scenario: Resposta perdida após commit
- **WHEN** o cliente retenta com a mesma chave e plano
- **THEN** recebe o mesmo mapa/resultado e a quantidade de itens/checklists não aumenta

#### Scenario: Outbox interrompido
- **WHEN** a publicação falha após a cópia persistida
- **THEN** o resultado informa cópia aplicada e efeitos pendentes, retomados sem duplicar dados

