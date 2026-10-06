Board ref: 25667747-2b18-43b6-badc-a2e461527c44

## 1. Cobertura antes da extração

- [ ] 1.1 Inventariar responsabilidades de `BoardScreen.tsx` e contratos estruturais web; separar invariantes legítimos dos testes de texto que alegam comportamento.
- [ ] 1.2 Criar substitutos DOM por papel/rótulo para filtros, edição e modais antes de remover qualquer contrato comportamental legado.
- [ ] 1.3 Completar jornadas determinísticas de login, Board/criação/edição/movimento/reordenação, Settings/permissões e agente, com stack isolado e traces de falha.
- [ ] 1.4 Fixar fixtures dos contratos de revisão/erro T38 `garantir-mutacoes-idempotentes-transacionais` e resync T39 `sincronizar-eventos-entre-instancias` sem implementar mecanismos do servidor.

## 2. Fronteiras coesas do Board

- [ ] 2.1 Extrair controller de filtros/população reusando `useBoardPreferences` e modelos, preservando filtros por projeto e Leaf Rule.
- [ ] 2.2 Extrair fluxo de DnD/mutações usando `model/mutation.ts`, sem duplicar regras ou trasladar tudo para mega-hook.
- [ ] 2.3 Extrair edição/carregamento de modais/arquivamento com cancelamento de respostas antigas e estado explícito de erro.
- [ ] 2.4 Extrair sessão/fotografia/reveal/foco do agente com cleanup por projeto e schema existente preservado.
- [ ] 2.5 Reduzir `BoardScreen` à composição sem HTTP/regras inline, documentar fronteiras e eliminar contratos legados somente após substitutos verdes.

## 3. Falhas e acessibilidade

- [ ] 3.1 Testar 409 de edição/movimento com refetch e feedback localizado, sem sucesso aparente nem retry permanente automático.
- [ ] 3.2 Testar rollback após evento mais recente, resposta tardia e troca de projeto, preservando estado novo.
- [ ] 3.3 Testar 403/revogação, VIEWER e falhas transitórias nos componentes/jornadas.
- [ ] 3.4 Testar lacuna/reconexão e estado sincronizado somente após reconciliação, consumindo contrato de T39.
- [ ] 3.5 Verificar teclado/alternativa acessível ao drag, foco de modais e rótulos/feedback em PT-BR/EN/ES com auditoria sem violações críticas/sérias.

## 4. Validação i18n

- [ ] 4.1 Evoluir `scripts/check-i18n.ts` para análise AST com licença permitida e fixtures de JSXText/atributos/expressões/toast/validação sem acento.
- [ ] 4.2 Resolver chaves com namespace/alias/keyPrefix/Trans/pluralização/interpolação e manter paridade dos três idiomas.
- [ ] 4.3 Definir conjuntos finitos/manifesto de chaves dinâmicas, falha para expressão opaca e exceções estreitas justificadas com diagnóstico arquivo/posição.
- [ ] 4.4 Corrigir ocorrências de texto/chave reportadas sem traduzir conteúdo do usuário e tornar o scanner ampliado reprovativo após saneamento.

## 5. Aceite e documentação

- [ ] 5.1 Verificar dependências/cleanup com TypeScript strict e funções pequenas; adicionar comentários `// [TENANT]` quando houver resolução de escopo e `// [DB-SWAP]` somente se aplicável à composição alterada.
- [ ] 5.2 Executar jornadas/baselines antes e depois, build web e `check:bundle` sem elevar `apps/web/bundle-budget.json`.
- [ ] 5.3 Atualizar `TESTING.md` com contratos mantidos/substituídos, exceções i18n, acessibilidade e rollback do frontend; entregar comandos a T43.
- [ ] 5.4 Na futura implementação, executar `bun run check`, `bun run test:smoke`, `bun run test:e2e`, `check:i18n` e `check:frontend-tests`, registrando evidência.
