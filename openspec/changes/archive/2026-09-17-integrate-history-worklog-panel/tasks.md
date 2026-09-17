## 1. Preparação E Contratos

- [x] 1.1 Inventariar consumidores de `ActivityLogModal` e `WorkLogModal` e confirmar se a lógica pode ser extraída sem quebrar outros fluxos.
- [x] 1.2 Definir os estados independentes da área Histórico: auditoria, diário, formulário de criação, edição, loading, erro, paginação e retry.
- [x] 1.3 Atualizar testes de contrato para validar dois painéis inline, APIs separadas, ausência de gatilhos de submodal e preservação das permissões.

## 2. Painel De Auditoria

- [x] 2.1 Extrair ou adaptar `ActivityLogModal` para um `ActivityLogPanel` inline sem backdrop, título de modal ou fechamento próprio.
- [x] 2.2 Preservar normalização segura de HTML, autor/origem, data/hora, ordenação e estado somente leitura dos eventos automáticos.
- [x] 2.3 Preservar carregamento paginado de 20 eventos e implementar Carregar mais dentro do painel, mantendo eventos já renderizados.
- [x] 2.4 Implementar estados visuais distintos de loading, lista vazia, erro localizado e retry.

## 3. Painel De Diário De Trabalho

- [x] 3.1 Extrair ou adaptar `WorkLogModal` para um `WorkLogPanel` inline com lista, contagem e total de duração.
- [x] 3.2 Implementar ação Registrar trabalho e formulário inline com descrição obrigatória, duração opcional `H:MM`, Salvar e Cancelar.
- [x] 3.3 Preservar parsing/validação de duração, autor autenticado e payloads existentes de POST/PATCH/DELETE.
- [x] 3.4 Preservar regras de edição/exclusão: autor do registro ou ADMIN, com controles ocultos/desabilitados para outros membros.
- [x] 3.5 Atualizar lista, contagem e total imediatamente após criar, editar ou excluir, sem fechar a guia Histórico.
- [x] 3.6 Implementar estados de loading, vazio, erro e retry independentes do painel de auditoria.

## 4. Integração Na ItemModal

- [x] 4.1 Substituir os botões de abrir histórico/diário na área `activity` por um layout de dois painéis com títulos, ícones e contagens.
- [x] 4.2 Carregar auditoria e diário de forma independente ao entrar na área, sem uma falha impedir o outro painel.
- [x] 4.3 Conectar callbacks de contagem e total ao estado da `ItemModal`, mantendo o badge da guia e o cabeçalho atualizados.
- [x] 4.4 Remover `showActivityLog` e `showWorkLog` do caminho integrado e excluir componentes modais antigos somente se não houver consumidores.
- [x] 4.5 Preservar Escape, fechamento da `ItemModal`, stack de subtasks, valores de edição e ausência de mistura entre auditoria e diário.

## 5. Responsividade, Acessibilidade E Idiomas

- [x] 5.1 Implementar duas colunas desktop com rolagem interna independente e empilhamento Auditoria → Diário em telas estreitas, sem overflow horizontal.
- [x] 5.2 Adicionar traduções PT-BR, EN e ES para títulos, contagens, estados vazios, retry, formulário, validação, ações e labels acessíveis.
- [x] 5.3 Validar `aria-labelledby`, labels de campos, foco visível, ordem de tabulação, foco no formulário inline e feedback de erro.
- [x] 5.4 Garantir que cores não sejam a única indicação de tipo de evento, estado ou permissão.

## 6. Testes E Verificação

- [x] 6.1 Testar auditoria com lista, estado vazio, erro, retry, paginação e normalização de conteúdo.
- [x] 6.2 Testar diário vazio, criação válida, duração inválida, edição, exclusão, permissões e totalização.
- [x] 6.3 Testar criação/edição de trabalho sem abrir overlay e atualização das contagens/totais na guia.
- [x] 6.4 Testar integração com Detalhes, Subtasks e Checklists, incluindo Escape e modais empilhadas.
- [x] 6.5 Testar desktop, tablet e mobile, incluindo rolagem e foco do formulário.
- [x] 6.6 Executar `bun run check` e `bun run test:smoke`.
