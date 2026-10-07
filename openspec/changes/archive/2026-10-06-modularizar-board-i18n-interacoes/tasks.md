Board ref: 25667747-2b18-43b6-badc-a2e461527c44

## 1. Cobertura antes da extração

- [x] 1.1 Inventariar responsabilidades de `BoardScreen.tsx` e contratos estruturais web; separar invariantes legítimos dos testes de texto que alegam comportamento.
- [x] 1.2 Criar substitutos DOM por papel/rótulo para filtros, edição e modais antes de remover qualquer contrato comportamental legado.
- [x] 1.3 Completar jornadas determinísticas de login, Board/criação/edição/movimento/reordenação, Settings/permissões e agente, com stack isolado e traces de falha.
- [x] 1.4 Fixar fixtures dos contratos de revisão/erro T38 `garantir-mutacoes-idempotentes-transacionais` e resync T39 `sincronizar-eventos-entre-instancias` sem implementar mecanismos do servidor.

## 2. Fronteiras coesas do Board

- [x] 2.1 Extrair controller de filtros/população reusando `useBoardPreferences` e modelos, preservando filtros por projeto e Leaf Rule.
- [x] 2.2 Extrair fluxo de DnD/mutações usando `model/mutation.ts`, sem duplicar regras ou trasladar tudo para mega-hook.
- [x] 2.3 Extrair edição/carregamento de modais/arquivamento com cancelamento de respostas antigas e estado explícito de erro.
- [x] 2.4 Extrair sessão/fotografia/reveal/foco do agente com cleanup por projeto e schema existente preservado.
- [x] 2.5 Reduzir `BoardScreen` à composição sem HTTP/regras inline, documentar fronteiras e eliminar contratos legados somente após substitutos verdes.

## 3. Falhas e acessibilidade

- [x] 3.1 Testar 409 de edição/movimento com refetch e feedback localizado, sem sucesso aparente nem retry permanente automático.
- [x] 3.2 Testar rollback após evento mais recente, resposta tardia e troca de projeto, preservando estado novo.
- [x] 3.3 Testar 403/revogação, VIEWER e falhas transitórias nos componentes/jornadas.
- [x] 3.4 Testar lacuna/reconexão e estado sincronizado somente após reconciliação, consumindo contrato de T39.
- [x] 3.5 Verificar teclado/alternativa acessível ao drag, foco de modais e rótulos/feedback em PT-BR/EN/ES com auditoria sem violações críticas/sérias.

## 4. Validação i18n

- [x] 4.1 Evoluir `scripts/check-i18n.ts` para análise AST com licença permitida e fixtures de JSXText/atributos/expressões/toast/validação sem acento.
- [x] 4.2 Resolver chaves com namespace/alias/keyPrefix/Trans/pluralização/interpolação e manter paridade dos três idiomas.
- [x] 4.3 Definir conjuntos finitos/manifesto de chaves dinâmicas, falha para expressão opaca e exceções estreitas justificadas com diagnóstico arquivo/posição.
- [x] 4.4 Corrigir ocorrências de texto/chave reportadas sem traduzir conteúdo do usuário e tornar o scanner ampliado reprovativo após saneamento.

## 5. Aceite e documentação

- [x] 5.1 Verificar dependências/cleanup com TypeScript strict e funções pequenas; adicionar comentários `// [TENANT]` quando houver resolução de escopo e `// [DB-SWAP]` somente se aplicável à composição alterada.
- [x] 5.2 Executar jornadas/baselines antes e depois, build web e `check:bundle` sem elevar `apps/web/bundle-budget.json`.
- [x] 5.3 Atualizar `TESTING.md` com contratos mantidos/substituídos, exceções i18n, acessibilidade e rollback do frontend; entregar comandos a T43.
- [x] 5.4 Na futura implementação, executar `bun run check`, `bun run test:smoke`, `bun run test:e2e`, `check:i18n` e `check:frontend-tests`, registrando evidência.
