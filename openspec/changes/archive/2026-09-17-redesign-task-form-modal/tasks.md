## 1. Preparação E Contratos

- [x] 1.1 Mapear no `BoardPage` os fluxos de abertura, criação, edição, stack de filhos e callbacks usados pelo `ItemModal`, confirmando que não há endpoint novo necessário.
- [x] 1.2 Definir o modelo local de áreas (`details`, `subtasks`, `checklists`, `activity`) e os estados de loading, erro, criação e edição sem persistir preferência visual.
- [x] 1.3 Atualizar os testes de contrato existentes para deixar de exigir o layout vertical antigo e passar a validar modal amplo, painel de propriedades, navegação e payloads preservados.

## 2. Estrutura Visual Do Modal

- [x] 2.1 Reestruturar o container da `ItemModal` com backdrop, diálogo acessível, largura ampla, altura limitada e rolagem exclusiva do conteúdo.
- [x] 2.2 Implementar cabeçalho contextual com tipo, prioridade, código, breadcrumb/status, botão de fechar e retorno seguro para modais filhas.
- [x] 2.3 Implementar navegação acessível entre Detalhes, Subtasks, Checklists e Histórico com contagens e estado ativo.
- [x] 2.4 Criar o painel de propriedades com Status, Responsável, Prioridade, Sprint, Versão, Pontos, Início, Fim, Código e Autor, reutilizando os estados atuais.
- [x] 2.5 Criar o rodapé fixo com Cancelar e Salvar alterações, incluindo loading, disabled, foco visível e mensagens de erro sem deslocar as ações.
- [x] 2.6 Implementar composição responsiva: duas áreas no desktop e áreas empilhadas ou colapsáveis em mobile, sem overflow horizontal.

## 3. Migração Dos Campos E Persistência

- [x] 3.1 Mover descrição rica, História pai, Tags e Centro de custo para Detalhes, mantendo edição, placeholders e valores controlados.
- [x] 3.2 Garantir que `handleSave` continue enviando título, prioridade, status, tipo, parentId, responsável, pontos, versão, sprint, centro de custo, datas, descrição, código e tags com os mesmos valores nulos/opcionais.
- [x] 3.3 Preservar defaults de criação pela toolbar: `TASK`/`BUG`, status `NOT_STARTED`, prioridade `MEDIUM`, sem responsável e sem vínculos opcionais, incluindo pré-seleção de centro de custo quando já existente.
- [x] 3.4 Preservar validação de título, bloqueio de duplo salvamento, tratamento de erro e fechamento somente após sucesso.
- [x] 3.5 Confirmar que `AddCardForm` da criação por coluna permanece compacto, inline e com seu contrato independente do modal amplo.

## 4. Recursos Relacionados E Navegação

- [x] 4.1 Integrar `CardChildrenSection` na área Subtasks, mantendo criação, refresh de contagem, estados vazios, abertura de subtask e limite de profundidade.
- [x] 4.2 Integrar `ChecklistSection` na área Checklists, mantendo carregamento, progresso, criação, edição, conclusão e exclusão.
- [x] 4.3 Integrar histórico de alterações e work log na área Histórico, mantendo contagens, soma de duração e modais sobrepostos.
- [x] 4.4 Preservar valores locais ao alternar áreas e ao abrir/fechar `RichTextEditor` expandido.
- [x] 4.5 Preservar Escape, clique no backdrop, fechamento do nível superior e foco ao trabalhar com modais empilhadas.
- [x] 4.6 Garantir que falhas de consultas auxiliares não impeçam visualizar/editar/salvar os campos principais e que estados vazios sejam explícitos.

## 5. Integração E Internacionalização

- [x] 5.1 Validar a abertura do novo modal pela toolbar de `BoardPage` para TASK e BUG, sem alterar os fluxos de Módulo, Épico e História.
- [x] 5.2 Adicionar ou ajustar chaves PT-BR, EN e ES para áreas, propriedades, contagens, estados vazios, ações, erros, labels acessíveis e responsividade.
- [x] 5.3 Garantir que labels não dependam apenas de cor e que tipo, status, prioridade, autor e campos somente leitura tenham indicação textual.
- [x] 5.4 Validar `role="dialog"`, `aria-modal`, título acessível, tabs/controls, foco visível, ordem de tabulação e foco de retorno.

## 6. Testes E Verificação

- [x] 6.1 Testar estado inicial em Detalhes, alternância de cada área, contagens, estados vazios e navegação global quando aplicável.
- [x] 6.2 Testar criação de TASK e BUG pela toolbar e confirmar payload/defaults, enquanto a criação inline por coluna continua funcionando.
- [x] 6.3 Testar edição, cancelamento, Escape, backdrop, erro de salvamento, duplo clique e preservação dos valores não salvos.
- [x] 6.4 Testar subtasks, checklists, histórico, work log, editor rico expandido e stack de modais filhas.
- [x] 6.5 Testar desktop, tablet e mobile, incluindo ausência de rolagem horizontal e ações fixas acessíveis.
- [x] 6.6 Executar `bun run check` e `bun run test:smoke`, corrigindo regressões antes de concluir a implementação.
