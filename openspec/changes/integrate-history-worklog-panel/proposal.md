## Why

A guia Histórico atualmente funciona apenas como uma ponte para duas submodais: uma para auditoria e outra para registrar trabalho. Quando não há lançamentos, o usuário encontra uma área vazia e precisa abrir outra camada para entender ou executar o próximo passo. Isso interrompe o fluxo e torna difícil comparar alterações automáticas com o trabalho efetivamente registrado.

## What Changes

- Transformar a guia Histórico da `ItemModal` em um workspace persistente com dois painéis lado a lado no desktop.
- Exibir diretamente no painel esquerdo todos os eventos automáticos de auditoria, com autor/origem, data, descrição legível, estado vazio, loading e paginação/carregamento incremental.
- Exibir diretamente no painel direito os registros manuais de trabalho, total de horas e estado vazio.
- Disponibilizar o formulário de novo registro de trabalho dentro do painel direito, inicialmente recolhido ou em estado de ação clara, sem abrir outra modal.
- Permitir editar e excluir registros manuais no próprio painel conforme as permissões existentes do autor e ADMIN.
- Manter auditoria automática e diário manual como listas e contratos independentes, sem misturar duração ou eventos.
- Atualizar contagens da guia, totais e listas imediatamente após criar, editar ou excluir registros.
- Em telas estreitas, empilhar os painéis verticalmente mantendo a ordem Auditoria → Diário de trabalho e ações acessíveis.
- Remover do fluxo principal os botões que abrem `ActivityLogModal` e `WorkLogModal`; as submodais antigas deixam de ser necessárias para esta guia.

## Capabilities

### New Capabilities

Nenhuma. A mudança reorganiza capacidades já existentes dentro da guia Histórico.

### Modified Capabilities

- `card-edit-ui`: a área Histórico passa a renderizar auditoria e diário diretamente em painéis integrados, com formulário inline e sem exigir submodal.
- `card-activity-log`: eventos automáticos continuam isolados e paginados, mas passam a ser exibidos inline no painel esquerdo da área Histórico.
- `card-work-log`: registros manuais continuam separados e sujeitos às mesmas permissões/validações, mas passam a ser listados e editados inline no painel direito.

## Impact

- Frontend: `ItemModal`, `ActivityLogModal`, `WorkLogModal` ou novos componentes de painel reutilizáveis, estados de loading/paginação/formulário e testes de contrato.
- API: reutilização dos endpoints existentes de auditoria e work log; nenhuma mudança de modelo ou endpoint prevista.
- Permissões: manter regras atuais de `VIEWER` para leitura, `MEMBER` para registrar trabalho e autor/`ADMIN` para editar ou excluir diário.
- Internacionalização: novos textos para cabeçalhos, ações, estados vazios, paginação, validação e acessibilidade em PT-BR, EN e ES.
- Responsividade e acessibilidade: layout em duas colunas no desktop, empilhado no mobile, foco, teclado, `aria-*` e feedback de operações.
- Dependências: nenhuma dependência nova.
