## 1. Descoberta e contrato

- [ ] 1.1 Mapear todos os filtros e opções de visualização atualmente controlados pelo Board.
- [ ] 1.2 Definir formato versionado e chaves por projeto, incluindo fallback legado de densidade.
- [ ] 1.3 Criar helpers puros de leitura, normalização, validação e gravação segura do `localStorage`.

## 2. Implementação

- [ ] 2.1 Persistir e restaurar modo Kanban/Árvore por projeto.
- [ ] 2.2 Persistir e restaurar densidade por projeto com compatibilidade para `board-density`.
- [ ] 2.3 Persistir e restaurar módulo ativo por projeto após carregamento do catálogo.
- [ ] 2.4 Integrar hidratação sem flash e impedir que defaults sobrescrevam estado salvo.
- [ ] 2.5 Validar e limpar filtros, módulos, sprints, versões e centros removidos sem apagar campos válidos.
- [ ] 2.6 Preservar e validar chaves separadas de lanes recolhidas por projeto.

## 3. Qualidade

- [ ] 3.1 Testar troca entre projetos e navegação direta com estados distintos.
- [ ] 3.2 Testar JSON corrompido, campos parciais, chaves legadas e `SecurityError`.
- [ ] 3.3 Testar restauração de todos os controles e ausência de vazamento entre projetos.
- [ ] 3.4 Executar typecheck, lint, testes e build frontend.

## 4. Documentação

- [ ] 4.1 Atualizar documentação funcional sobre persistência local e escopo por projeto.
- [ ] 4.2 Registrar formato/chaves e comportamento de fallback para manutenção futura.
