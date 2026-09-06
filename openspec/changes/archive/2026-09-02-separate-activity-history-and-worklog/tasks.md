## 1. Modelo E Migração

- [x] 1.1 Mapear o uso atual de `item_logs`, endpoints, MCP e componentes para definir contrato de compatibilidade.
- [x] 1.2 Adicionar metadados de origem e executor/agente ao modelo de auditoria, incluindo migração SQLite aditiva e índices tenant/item/tipo/data.
- [x] 1.3 Definir classificação de registros existentes: `auto` permanece auditoria e `manual` permanece diário, com fallback de origem para dados antigos.
- [x] 1.4 Criar tipos compartilhados para auditoria, diário, origem e identidade do executor.

## 2. Auditoria Automática

- [x] 2.1 Centralizar a criação transacional de eventos automáticos com executor, origem, descrição textual e filtros de tenant.
- [x] 2.2 Garantir evento de auditoria para movimentação de coluna via Kanban, REST e MCP, sem duplicação em retries.
- [x] 2.3 Garantir eventos para alterações relevantes do card, criação, arquivamento e ações suportadas, preservando autor humano ou agente real.
- [x] 2.4 Normalizar diferenças de descrição rich text para texto/diff seguro, sem tags HTML cruas ou execução de markup.
- [x] 2.5 Separar endpoint de leitura de auditoria, com paginação, `total`, ordenação decrescente e retorno de autor/origem.

## 3. Diário De Trabalho

- [x] 3.1 Criar parser e formatador compartilhado de duração `H:MM`, aceitando horas ilimitadas e minutos de 00 a 59.
- [x] 3.2 Criar endpoints de listar, criar, editar e excluir registros manuais, com duração normalizada em minutos e validação server-side.
- [x] 3.3 Aplicar RBAC e isolamento tenant/projeto/card aos endpoints do diário; autor deve vir do contexto autenticado.
- [x] 3.4 Implementar totalização exclusiva dos registros manuais e resposta com contagem/total normalizados.
- [x] 3.5 Definir transição dos endpoints legados de logs manuais sem misturar seus dados com o endpoint de auditoria.

## 4. Interface Da Modal

- [x] 4.1 Separar `ActivityLogModal` em experiência de Histórico de alterações, removendo formulário manual e exibindo origem humano/agente.
- [x] 4.2 Criar componente/fluxo de Diário de trabalho com autor somente leitura, descrição, duração `H:MM`, validação, edição e exclusão conforme permissão.
- [x] 4.3 Atualizar `ItemModal` para accordions independentes, contagens próprias, total de horas do diário e estados vazios coerentes.
- [x] 4.4 Renderizar descrições de auditoria e diário como texto seguro e legível, incluindo conteúdo legado com HTML literal.
- [x] 4.5 Adicionar traduções PT-BR, EN e ES para auditoria, diário, origens, validações, totais e estados.
- [x] 4.6 Preservar acessibilidade, responsividade, foco, Escape, modais empilhadas e atualização das contagens após criar/editar/excluir.

## 5. Testes E Documentação

- [x] 5.1 Testar parser `H:MM`, normalização, limites, valores inválidos e totalização.
- [x] 5.2 Testar API de auditoria, movimentação, autoria humano/agente, origem, paginação, imutabilidade e isolamento tenant.
- [x] 5.3 Testar API e UI do diário, permissões, autor automático, edição/exclusão, contagens e separação dos accordions.
- [x] 5.4 Testar sanitização/formatação de rich text e compatibilidade com registros antigos.
- [x] 5.5 Atualizar documentação funcional e contratos MCP/API; executar typecheck, lint, testes e build.
