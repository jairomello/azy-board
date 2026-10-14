# Proposal

## Why

Na modal de Planejamento do Projeto o usuário edita nome, datas, estimativas e escopo e **não encontra onde gravar**: não existe botão Salvar. O que existe é um salvamento automático pouco perceptível — nas datas e estimativas, `onBlur`; no escopo rico, um debounce de 800 ms — sem nenhum indicador de que algo foi persistido. Quem edita o escopo e fecha em seguida pode perder a alteração sem qualquer aviso.

Pior: o nome do projeto **nunca é persistido** nesse caminho. Em `ProjectPlanningModal`, o `onBlur` do nome compara o valor já ecoado no rascunho (`value !== draft.name`) e, como o `onChange` já atualizou `draft.name`, a condição é falsa e o `PATCH` não é enviado. Ou seja, o campo mais óbvio da modal é o único que silenciosamente não salva.

A própria especificação da capacidade já descreve o comportamento pretendido — "um ADMIN altera um ou mais campos de planejamento **e salva**" e "fechar a modal [...] sem alterar os dados do projeto" —, mas a implementação optou por autosave. O contrato e o código divergiram.

## What Changes

- Adicionar **rodapé de ações com "Salvar" e "Cancelar"** à modal de Planejamento do Projeto, tornando explícita e visível a gravação dos campos de planejamento (nome, Data de Início, Data de Fim Previsto, Total de Pontos Previsto, Total de Horas Previsto e Escopo).
- **Substituir o autosave por gravação explícita** apenas na modal: as alterações ficam no rascunho local e só vão para `PATCH /projects/:id` quando o usuário aciona "Salvar"; "Cancelar" descarta o rascunho.
- Persistir **somente os campos alterados** em um único `PATCH`, preservando o contrato parcial existente da rota; corrigir de tabela o nome do projeto, que hoje não persiste pela modal.
- **Fechar a modal** (X, ESC ou clique no pano de fundo) descarta silenciosamente o rascunho não salvo, sem diálogo de confirmação — decisão tomada com o usuário.
- Manter o campo **desabilitado durante a gravação** e exibir o erro de gravação no próprio rodapé, reaproveitando as mensagens já existentes de carregamento/erro.
- Manter **inalterado** o comportamento da seção "Planejamento" na página de Settings, que continua salvando automaticamente ao sair do campo — decisão tomada com o usuário.

**Fora de escopo:** mudanças no formato dos dados, na rota `PATCH /projects/:id`, no editor rico em si, ou na aba de links/anexos da modal.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `project-planning-modal`: a persistência dos campos de planejamento passa a ser explícita — novo requisito de rodapé com "Salvar"/"Cancelar", gravação apenas no acionamento do botão, rascunho local descartado ao cancelar ou fechar, e ausência de salvamento automático na modal (inclusive para o nome do projeto).

## Impact

**Web**
- `apps/web/src/components/ProjectPlanningModal.tsx`: passa a manter rascunho local de todos os campos (inclusive nome), controlar o estado "alterado/não alterado", montar o `PATCH` apenas com os campos sujos e renderizar o rodapé com "Salvar"/"Cancelar"; remove o autosave (`onBlur` do nome e persistência por campo).
- `apps/web/src/components/ProjectPlanningFields.tsx`: componente compartilhado com a página de Settings; ganha um modo de gravação explícita (sem `onBlur` e sem debounce de escopo) sem alterar o modo automático usado por Settings.
- `apps/web/src/components/project-planning-modal.test.tsx`: testes hoje acoplados ao `PATCH` por `blur` passam a exercitar o fluxo de rodapé (alterar → Salvar / Cancelar / fechar).
- `apps/web/src/i18n/locales/{pt-BR,en,es}/board.json` (ou `common.json`): rótulos dos botões e do estado de gravação, com paridade entre os três idiomas.

**Sem impacto**
- `apps/api/src/routes/projects.ts` e o schema `updateProjectSchema`: a rota já aceita atualização parcial dos campos usados.
- Banco, migrations e contratos HTTP.
- Seção "Planejamento" da página de Settings e demais consumidores do componente compartilhado.
