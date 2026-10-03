# item-description-draft Specification

## Purpose
TBD - created by archiving change autosave-card-description. Update Purpose after archive.
## Requirements
### Requirement: Gravação automática do rascunho da descrição

O sistema SHALL gravar automaticamente em `localStorage`, sob uma chave escopada por projeto e item (`item-draft:<projectId>:<itemId>:description`), o Markdown da descrição editada na `ItemModal` enquanto o usuário digita, com debounce trailing e sem depender de rede ou do clique em Salvar. A gravação NÃO SHALL ocorrer na montagem da modal, NÃO SHALL gravar valor idêntico à descrição do servidor e NÃO SHALL ocorrer para itens novos (`item.id === '__new__'`).

#### Scenario: Digitação grava rascunho após debounce
- **WHEN** o usuário edita a descrição de um item existente e pausa a digitação
- **THEN** o Markdown atual é gravado no `localStorage` na chave do projeto e do item, com o timestamp da última edição

#### Scenario: Abertura não cria rascunho espúrio
- **WHEN** o usuário abre a modal de um item sem rascunho e não edita a descrição
- **THEN** nenhum rascunho é criado para esse item

#### Scenario: Item novo não gera rascunho
- **WHEN** a modal está em modo de criação (`item.id === '__new__'`)
- **THEN** nenhum rascunho é gravado no `localStorage`

#### Scenario: Isolamento por projeto e item
- **WHEN** existem rascunhos para itens ou projetos distintos
- **THEN** cada rascunho permanece na sua própria chave, sem que a edição de um item sobrescreva o rascunho de outro

### Requirement: Restauração e descarte do rascunho ao reabrir

Ao sincronizar com um item existente, o sistema SHALL ler o rascunho da descrição: se ausente, usar a descrição do servidor; se idêntico à descrição do servidor, remover silenciosamente; se divergente, restaurar o rascunho no editor e exibir um aviso não bloqueante de "rascunho recuperado" com ação de descartar. Descartar SHALL remover a chave e restaurar a descrição do servidor no editor.

#### Scenario: Reabrir com rascunho divergente
- **WHEN** o usuário reabre a modal de um item que possui rascunho local diferente da descrição do servidor
- **THEN** o editor é preenchido com o rascunho e um aviso não bloqueante de rascunho recuperado é exibido com a ação de descartar

#### Scenario: Rascunho igual ao servidor é descartado
- **WHEN** o rascunho local é idêntico à descrição do servidor
- **THEN** o rascunho é removido silenciosamente e a descrição do servidor é exibida, sem aviso

#### Scenario: Descartar rascunho manualmente
- **WHEN** o usuário aciona a ação de descartar no aviso
- **THEN** a chave do rascunho é removida e o editor volta a exibir a descrição do servidor

#### Scenario: Recuperação após refresh ou crash
- **WHEN** o usuário perde a aba por refresh, queda de conexão ou crash após ter editado a descrição sem salvar
- **THEN** ao reabrir o mesmo item, o texto digitado é recuperado a partir do rascunho

### Requirement: Limpeza do rascunho após salvar e preservação em falha

O sistema SHALL remover o rascunho do item quando o salvamento for confirmado com sucesso pelo servidor. O rascunho NÃO SHALL ser removido quando o salvamento falhar (validação ou conflito de concorrência) nem quando o usuário fechar a modal sem salvar.

#### Scenario: Salvamento confirmado limpa o rascunho
- **WHEN** o usuário clica em Salvar e a API confirma a atualização do item
- **THEN** a chave de rascunho do item é removida do `localStorage` antes de a modal fechar

#### Scenario: Falha de salvamento preserva o rascunho
- **WHEN** o salvamento falha por validação ou conflito de concorrência (HTTP 409)
- **THEN** o rascunho permanece no `localStorage` para nova tentativa

#### Scenario: Fechar sem salvar preserva o rascunho
- **WHEN** o usuário fecha a modal por Cancelar ou Escape sem salvar
- **THEN** o rascunho da descrição permanece recuperável na próxima abertura do mesmo item

### Requirement: Resiliência do armazenamento e privacidade

O sistema SHALL tratar `localStorage` indisponível (`SecurityError`), JSON inválido e `QuotaExceededError` como "sem rascunho", sem erro visível e sem bloquear a edição. O sistema SHALL remover as chaves de rascunho de item do usuário no logout.

#### Scenario: localStorage indisponível
- **WHEN** o acesso ao `localStorage` lança `SecurityError` (modo privado ou bloqueado)
- **THEN** a edição da descrição continua funcionando e nenhum erro é exibido ao usuário

#### Scenario: Rascunho corrompido
- **WHEN** o valor persistido não é um JSON válido ou não contém o campo esperado
- **THEN** o sistema ignora o valor, remove a chave inválida e usa a descrição do servidor

#### Scenario: Quota excedida
- **WHEN** a gravação do rascunho lança `QuotaExceededError`
- **THEN** a falha é silenciosa e a edição continua sem bloqueio

#### Scenario: Expurgo no logout
- **WHEN** o usuário encerra a sessão
- **THEN** as chaves `item-draft:` do usuário são removidas do `localStorage`

### Requirement: Internacionalização do aviso de rascunho

O aviso de rascunho recuperado e a ação de descartar SHALL estar disponíveis em PT-BR, EN e ES.

#### Scenario: Idioma ativo
- **WHEN** o idioma da interface é trocado
- **THEN** o texto do aviso e da ação de descartar aparecem no idioma selecionado

