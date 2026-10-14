# Tasks

## 1. Campo de descrição no rascunho da modal

- [ ] 1.1 Adicionar as chaves de rótulo e placeholder da descrição do projeto em `common` nos três idiomas; verificar com `bun run check:i18n` que a paridade estrutural é mantida e nenhum texto fixo novo entrou no código
- [ ] 1.2 Incluir `description` no `Draft`, em `draftFromProject` e em `planningPatch` do `ProjectPlanningModal`, comparando e gravando o texto sem espaços nas pontas; verificar com teste novo em `apps/web/src/components/project-planning-modal.test.tsx` que alterar só a descrição gera um `PATCH /projects/project-1` com `{ description: 'texto' }`
- [ ] 1.3 Renderizar o campo como textarea de texto simples abaixo do nome, com `maxLength` de 20.000 caracteres e desabilitado durante a gravação; verificar com teste que o campo expõe o limite e fica desabilitado enquanto salva
- [ ] 1.4 Exibir a descrição em modo somente leitura para MEMBER/VIEWER, com o mesmo traço do escopo quando vazia; verificar com teste que não há campo de edição de descrição para esses papéis e que o texto aparece
- [ ] 1.5 Tratar campo vazio ou só com espaços como remoção do texto, gravando string vazia em vez de `null` (o schema estrito da API rejeita `null`); verificar com teste que o `PATCH` leva `description: ''` e que a modal reabre com o campo vazio
- [ ] 1.6 Descartar alterações não salvas da descrição ao cancelar, fechar pela cruz, ESC ou clique fora; verificar com teste que nenhum `PATCH` é enviado e que reabrir a modal exibe a descrição do servidor

## 2. Card do projeto e documentação

- [ ] 2.1 Garantir por teste que o card de Projetos volta a exibir `common:defaultProjectDescription` quando a descrição é `null` ou string vazia; verificar rodando o teste do card
- [ ] 2.2 Documentar na seção "Planejamento do projeto (modal)" de `docs/azyboard-wiki/07 - Configuracoes do Projeto/Configuracoes do Projeto.md` que a descrição do card é editada na modal, em texto simples, e que limpar o campo restaura a descrição padrão; verificar com `bun run check:docs`

## 3. Verificação de integração

- [ ] 3.1 Rodar `bun run check` (typecheck, lint, fronteiras, testes e build) e corrigir o que aparecer
- [ ] 3.2 Validar no app em execução (API/Web no ar): abrir a modal pelo header do board e pelo card, salvar uma descrição, conferir o texto no card, e depois limpar o campo confirmando o retorno da descrição padrão

## Workflow follow-up

- Arquivar esta change **depois** de `botao-salvar-no-modal-de-planejamento`: as duas mexem na capability `project-planning-modal` e esta foi escrita apenas com requisitos adicionados para não sobrescrever a gravação explícita no arquivamento.
- Nenhum card do Azy Board vinculado a esta change; criar um no board se quiser rastrear a execução.
