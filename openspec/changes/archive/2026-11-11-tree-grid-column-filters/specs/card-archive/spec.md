# Spec Delta

## MODIFIED Requirements

### Requirement: Ação de arquivamento acessível nos cards e na tree view
O sistema SHALL expor a ação "Arquivar" nos menus de contexto de cards no board e nos menus de ação na tree view hierárquica. Após o arquivamento, o sistema SHALL oferecer uma janela curta de desfazer, que restaura o item ao status anterior.

#### Scenario: Arquivar via menu de contexto do card
- **WHEN** membro clica no menu "..." de um card no board e seleciona "Arquivar"
- **THEN** sistema exibe confirmação (se item tem descendentes) e executa o arquivamento em cascata

#### Scenario: Arquivar via ação na tree view
- **WHEN** membro clica no menu de ação de qualquer item na tree view e seleciona "Arquivar"
- **THEN** sistema exibe confirmação (se item tem descendentes) e executa o arquivamento em cascata

#### Scenario: Somente ADMIN e MEMBER podem arquivar
- **WHEN** usuário com papel VIEWER tenta arquivar item via API
- **THEN** sistema retorna 403

#### Scenario: Desfazer arquivamento pelo toast
- **WHEN** o usuário aciona "Desfazer" no toast exibido após arquivar um item
- **THEN** o item é restaurado ao status anterior e o board e a Tree View são atualizados
