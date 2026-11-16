# Spec Delta

## MODIFIED Requirements

### Requirement: Diário de trabalho separado do histórico
O sistema SHALL oferecer um diário manual independente da auditoria automática, exibido diretamente no painel Diário de trabalho da área Histórico. O painel SHALL exibir registros manuais, quantidade de registros, total de duração registrada e formulário inline para criação, sem abrir outra modal. Cada registro SHALL identificar quem o criou.

#### Scenario: Abrir diário integrado
- **WHEN** usuário seleciona a área Histórico de um card
- **THEN** painel Diário de trabalho exibe somente registros manuais, quantidade, total de duração e ação Registrar trabalho

#### Scenario: Histórico não oferece registro manual
- **WHEN** usuário visualiza o painel Auditoria de alterações
- **THEN** painel exibe somente eventos automáticos e não apresenta formulário de diário

#### Scenario: Estado vazio acionável
- **WHEN** card não possui registros manuais
- **THEN** Diário mostra total zero ou ausência conforme o padrão visual e oferece ação clara para abrir o formulário inline

#### Scenario: Autor visível em cada registro
- **WHEN** painel Diário renderiza um registro manual
- **THEN** cada registro exibe o autor pela mesma regra do histórico — nome em duas partes e menção para pessoa, rótulo do agente para automação, e "Autor não identificado" quando não há autor resolvido

---

### Requirement: API de diário com isolamento
O sistema SHALL expor endpoints separados para listar, criar, editar e excluir registros manuais, sempre filtrando por projeto, tenant e permissões.

#### Scenario: Listar diário
- **WHEN** membro autenticado consulta o diário de um card
- **THEN** API retorna somente registros `manual`, paginados e com autor resolvido no tenant atual

#### Scenario: Criar diário
- **WHEN** membro envia descrição e duração válida para o endpoint de diário
- **THEN** API cria registro manual com `author_id` do contexto autenticado e `duration_min` normalizado

#### Scenario: Autor resolvido em qualquer perfil de instalação
- **WHEN** o diário do mesmo card é lido em instalação SIMPLE (SQLite) ou ADVANCED (PostgreSQL)
- **THEN** ambos devolvem `author` com id, nome e avatar quando `author_id` existe, sem depender do perfil para identificar quem registrou o trabalho
