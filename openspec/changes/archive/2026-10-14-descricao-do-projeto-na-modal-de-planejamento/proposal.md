# Proposal

## Why

O card de projeto em Projetos exibe uma descrição abaixo do nome (`p.description || t('defaultProjectDescription')`), mas **não existe nenhum lugar no web para ver ou editar esse texto**. O formulário de novo projeto envia apenas nome, formato, visibilidade, ícone e cor; a modal de Planejamento edita nome, datas, estimativas e **Escopo** — que é outro campo; e a página de Configurações não tem seção de descrição. Resultado prático: o usuário lê um texto no card, abre a modal de edição e não encontra de onde ele vem, nem onde corrigi-lo.

O campo existe no modelo há tempos (`projects.description`) e a API já o aceita em `POST /projects` e `PATCH /projects/:id`, além das ferramentas do agente (`create_project`, `create_project_structure`, `update_project`). Quem criou o projeto por MCP/agente informando `description` acabou com um dado que a interface não mostra nem permite manter.

Agora que a modal de Planejamento tem gravação explícita (rodapé Salvar/Cancelar), ela é o lugar natural para fechar essa lacuna: um campo a mais no mesmo rascunho, gravado pelo mesmo botão.

## What Changes

- Adicionar o campo **"Descrição do projeto"** à aba de planejamento da modal, logo abaixo do nome, como **texto simples** (textarea), com placeholder explicando que é o resumo exibido no card.
- Incluir a descrição no **rascunho local e na gravação explícita** já existentes: entra no mesmo `PATCH /projects/:id`, apenas quando divergir do valor carregado, e é descartada por Cancelar/fechar como os demais campos.
- Gravar o texto **sem espaços nas pontas**; campo vazio (ou só com espaços) grava string vazia, fazendo o card voltar a exibir a descrição padrão.
- Respeitar o **limite de 20.000 caracteres** do contrato da API, limitando a digitação no próprio campo.
- Manter **MEMBER/VIEWER em modo somente leitura**, exibindo a descrição quando houver e sem controles de edição.

**Fora de escopo:** editor rico para a descrição (o campo é texto simples, como o card o exibe), expor a descrição na página de Configurações ou no formulário de criação, alterar a renderização do card, `list_projects`/MCP, schema da API ou banco (o campo já existe e já aceita `''`).

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `project-planning-modal`: ganha requisitos de descrição do projeto na modal — campo em texto simples gravado pela gravação explícita, com limpeza do valor e limite de caracteres.

  A capability é alterada **apenas por adição**: o requisito existente "Campos de planejamento na modal" enumera os campos exibidos e permanece verdadeiro com um campo a mais, e reescrevê-lo aqui conflitaria com a change `botao-salvar-no-modal-de-planejamento` (ainda não arquivada), que modifica esse mesmo requisito. Na ordem de arquivamento, um MODIFIED escrito agora sobrescreveria a gravação explícita que acabou de entrar.

## Impact

**Web**
- `apps/web/src/components/ProjectPlanningModal.tsx`: `Draft`, `draftFromProject` e `planningPatch` ganham `description`; novo `<textarea>` na aba de planejamento; trim na comparação e na gravação; `maxLength` de 20.000.
- `apps/web/src/i18n/locales/{pt-BR,en,es}/common.json`: rótulo e placeholder do campo (novas chaves), com paridade nos três idiomas.
- `apps/web/src/components/project-planning-modal.test.tsx`: testes do fluxo de descrição (alterar/salvar, limpar, limite, modo leitura).

**Sem impacto**
- `apps/api/src/routes/projects.ts`, `apps/api/src/validation.ts`, banco e migrations: `description` já é aceita em `POST`/`PATCH` de projeto.
- `ProjectsPage` (card) e as ferramentas MCP: comportamento atual preservado.
- Seção "Planejamento" da página de Configurações e o componente compartilhado `ProjectPlanningFields` permanecem como estão.
