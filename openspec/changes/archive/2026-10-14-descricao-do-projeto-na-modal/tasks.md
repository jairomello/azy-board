# Tasks

## 1. Campo de descrição no rascunho da modal

- [x] 1.1 Adicionar as chaves `projectDescription` e `projectDescriptionPlaceholder` em `common` nos três idiomas (pt-BR, en, es), com a ajuda de preenchimento dizendo que o texto é o resumo exibido no card do projeto; verificar com `bun run check:i18n` que a paridade entre os locales é mantida e nenhum texto fixo novo entrou no código
- [x] 1.2 Incluir `description` no `Draft`, em `draftFromProject` e em `planningPatch` do `ProjectPlanningModal`, comparando e gravando o texto sem espaços nas pontas (`trim()` contra `project.description ?? ''`); verificar com teste novo em `apps/web/src/components/project-planning-modal.test.tsx` que alterar só a descrição gera um `PATCH /projects/project-1` com `{ description: 'texto' }`
- [x] 1.3 Renderizar o campo como `<textarea id="project-planning-description">` de texto simples logo abaixo do Nome do projeto, com `maxLength` de 20.000 caracteres, ajuda de preenchimento associada ao campo e desabilitado durante a gravação; verificar com teste que o campo aparece depois do nome, expõe o limite e fica desabilitado enquanto salva
- [x] 1.4 Tratar campo vazio ou só com espaços como remoção do texto, gravando string vazia em vez de `null` (o schema estrito da API rejeita `null`); verificar com teste que o `PATCH` leva `description: ''` e que a modal reabre com o campo vazio
- [x] 1.5 Descartar alterações não salvas da descrição ao cancelar, fechar pela cruz, ESC ou clique fora; verificar com teste que nenhum `PATCH` é enviado e que reabrir a modal exibe a descrição do servidor

## 2. Modo leitura e distinção entre Descrição e Escopo

- [x] 2.1 Exibir a descrição em modo somente leitura para MEMBER/VIEWER, com o mesmo traço "—" dos demais campos vazios e sem controles de edição; verificar com teste que não há campo de descrição editável para esses papéis e que o texto aparece quando existe
- [x] 2.2 Ajustar o subtítulo da modal (`board:projectPlanningSubtitle`) nos três idiomas para citar a descrição junto de nome, datas, estimativas e escopo; verificar com `bun run check:i18n` que a paridade dos locales segue válida

## 3. Documentação

- [x] 3.1 Documentar na seção "Planejamento do projeto (modal)" de `docs/azyboard-wiki/07 - Configuracoes do Projeto/Configuracoes do Projeto.md` que a descrição do card é editada na modal, em texto simples, que ela é o resumo exibido no card e que limpar o campo restaura a descrição padrão; verificar com `bun run check:docs` que os links internos e os artefatos gerados continuam íntegros

## 4. Verificação de integração

- [x] 4.1 Rodar `bun run check` (typecheck, lint, fronteiras, testes e build) e corrigir o que aparecer
- [x] 4.2 Rodar `bun run test:smoke` para o fluxo web/API e confirmar que a modal segue carregando e gravando sem regressão
- [x] 4.3 Validar no app em execução (API/Web no ar): abrir a modal pelo header do board e pelo card de Projetos, salvar uma descrição, conferir o texto no card e depois limpar o campo confirmando o retorno da descrição padrão

## Workflow follow-up

- Archivar a change depois da implementação validada (`openspec archive descricao-do-projeto-na-modal`), aplicando o delta em `project-planning-modal`.
- Nenhum card do Azy Board vinculado (Board ref: nenhum). Se um card for criado para rastrear a execução, registrar `Board ref: <itemId>` aqui e fechá-lo em coluna `DONE` (`complete_task` + confirmação no board).
