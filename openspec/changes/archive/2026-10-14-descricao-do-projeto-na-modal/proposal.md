# Proposal

## Why

O card de projeto em **Projetos** mostra um resumo abaixo do nome
(`p.description || t('defaultProjectDescription')`), mas **não existe nenhum ponto
na interface para ver ou editar esse texto**: o formulário de novo projeto não tem
o campo e a modal de Planejamento do Projeto edita nome, datas, estimativas e
**Escopo** — que é outro campo. Na prática o usuário lê um texto no card, abre a
modal para conferir de onde ele vem e não encontra o campo.

O requisito já existe na spec `project-planning-modal` (adicionado pela change
`2026-10-14-descricao-do-projeto-na-modal-de-planejamento`, arquivada em
14/10/2026 **sem implementação**: as tasks nunca foram executadas e nenhum commit
tocou a modal). Ou seja: a spec está à frente do código. Quem criou o projeto por
MCP/agente informando `description` ficou com um dado que a interface não exibe
nem permite manter.

Agora que a modal de Planejamento tem gravação explícita (rodapé Salvar/Cancelar),
ela é o lugar natural para fechar essa lacuna: um campo a mais no mesmo rascunho,
gravado pelo mesmo botão.

## What Changes

- Implementar o campo **"Descrição do projeto"** na aba de planejamento da modal,
  logo abaixo do nome, como **texto simples** (textarea), com ajuda de preenchimento
  explicando que é o resumo exibido no card do projeto.
- Incluir a descrição no **rascunho local e na gravação explícita** já existentes:
  entra no mesmo `PATCH /projects/:id`, apenas quando divergir do valor carregado, e
  é descartada por Cancelar/cruz/ESC/clique fora como os demais campos.
- Gravar o texto **sem espaços nas pontas**; campo vazio (ou só com espaços) grava
  string vazia, fazendo o card voltar a exibir a descrição padrão; digitação limitada
  a **20.000 caracteres** (limite do contrato da API).
- Manter **MEMBER/VIEWER em modo somente leitura**, exibindo a descrição quando
  houver e com o mesmo traço dos demais campos vazios.
- Deixar explícita na modal a diferença entre **Descrição** (texto simples, resumo do
  card) e **Escopo** (texto rico, conteúdo de planejamento), ajustando o subtítulo da
  modal.
- Documentar na wiki do produto que a descrição do card é editada na modal.

**Fora de escopo:** editor rico para a descrição, campo de descrição no formulário de
criação de projeto, mudança na renderização do card, exposição na página de
Configurações, `list_projects`/MCP, schema da API ou banco (`projects.description`
já existe e já aceita `''`).

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `project-planning-modal`: refina o requisito **"Campo de descrição do projeto na
  modal"** (posição logo abaixo do nome e ajuda de preenchimento que liga o campo ao
  resumo do card) e acrescenta o requisito **"Distinção entre a Descrição e o
  Escopo"**. A exigência de existir o campo, com limite de caracteres, limpeza e modo
  leitura, já vale na spec atual e é o que esta change implementa.

## Impact

**Web**
- `apps/web/src/components/ProjectPlanningModal.tsx`: `Draft`, `draftFromProject` e
  `planningPatch` ganham `description`; novo `<textarea>` abaixo do nome; trim na
  comparação e na gravação; `maxLength` de 20.000.
- `apps/web/src/i18n/locales/{pt-BR,en,es}/common.json`: rótulo e ajuda do campo
  (chaves novas), com paridade nos três idiomas.
- `apps/web/src/i18n/locales/{pt-BR,en,es}/board.json`: subtítulo da modal passa a
  citar a descrição.
- `apps/web/src/components/project-planning-modal.test.tsx`: testes do fluxo de
  descrição (alterar/salvar, limpar, limite, descarte, modo leitura).

**Documentação**
- `docs/azyboard-wiki/07 - Configuracoes do Projeto/Configuracoes do Projeto.md`:
  registrar que a descrição do card é editada na modal, em texto simples.

**Sem impacto**
- `apps/api/src/routes/projects.ts`, `apps/api/src/validation.ts`, banco e migrations:
  `description` já é aceita em `POST`/`PATCH` de projeto.
- `ProjectsPage` (card), `ProjectPlanningFields`/seção "Planejamento" de Settings e as
  ferramentas MCP permanecem como estão.

**Rastreabilidade:** nenhum card do Azy Board vinculado a esta change (Board ref:
nenhum).
