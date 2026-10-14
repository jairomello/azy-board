# Spec Delta

## MODIFIED Requirements

### Requirement: Campos de planejamento na modal

A modal SHALL exibir nome do projeto, Data de Início, Data de Fim Previsto,
Total de Pontos Previsto, Total de Horas Previsto e Escopo (texto rico). Para
ADMIN, os campos SHALL ser editáveis; para MEMBER e VIEWER, SHALL ser exibidos
em modo somente leitura. Nenhum campo SHALL ser persistido automaticamente: a
gravação ocorre apenas quando o ADMIN aciona o botão de salvar.

#### Scenario: Admin edita campos de planejamento

- **WHEN** um ADMIN altera um ou mais campos de planejamento e aciona o botão de salvar
- **THEN** o sistema persiste os campos alterados via `PATCH /projects/:id` e os reexibe atualizados

#### Scenario: Alteração não salva não é persistida

- **WHEN** um ADMIN altera um campo de planejamento e fecha ou cancela a modal sem acionar o botão de salvar
- **THEN** o projeto mantém os valores anteriores no servidor e na próxima abertura da modal

#### Scenario: MEMBER ou VIEWER em modo leitura

- **WHEN** um usuário com papel MEMBER ou VIEWER abre a modal
- **THEN** os campos de planejamento são exibidos em modo somente leitura, sem controles de edição

#### Scenario: Escopo com texto rico e expansão

- **WHEN** um ADMIN edita o Escopo usando o editor rico ou o botão de maximizar e aciona o botão de salvar
- **THEN** o conteúdo é editável em tela ampliada e persistido como HTML

## ADDED Requirements

### Requirement: Rodapé de ações com salvar e cancelar na modal

A modal SHALL oferecer, na aba de planejamento e apenas para usuários com permissão
de edição, um rodapé fixo com as ações de salvar e cancelar. O botão de salvar SHALL
ficar indisponível enquanto não houver alterações ou enquanto a gravação estiver em
andamento, e SHALL indicar o estado de gravação. Uma falha de gravação SHALL ser
informada no rodapé, preservando o rascunho para nova tentativa.

#### Scenario: Gravar todas as alterações pendentes

- **WHEN** um ADMIN altera nome, datas, estimativas e escopo e aciona o botão de salvar
- **THEN** o sistema persiste todas as alterações em uma única requisição `PATCH /projects/:id` e informa o resultado

#### Scenario: Salvar sem alterações

- **WHEN** um ADMIN abre a modal e não altera nenhum campo
- **THEN** o botão de salvar permanece indisponível e nenhuma requisição é enviada

#### Scenario: Gravação em andamento

- **WHEN** um ADMIN aciona o botão de salvar
- **THEN** os campos e o rodapé ficam desabilitados, o botão indica que está salvando e, ao concluir, a modal reflete os valores persistidos

#### Scenario: Falha ao gravar

- **WHEN** a requisição de gravação falha
- **THEN** o rodapé exibe a mensagem de erro, os valores digitados pelo usuário permanecem na tela e o botão de salvar volta a ficar disponível

#### Scenario: Cancelar descarta o rascunho

- **WHEN** um ADMIN altera um ou mais campos e aciona cancelar
- **THEN** a modal fecha e nenhuma alteração é enviada ao servidor

#### Scenario: Fechar descarta o rascunho

- **WHEN** um ADMIN altera um campo e fecha a modal pelo controle de fechamento, pelo ESC ou por clique fora
- **THEN** a modal fecha sem diálogo de confirmação e sem enviar alterações ao servidor

#### Scenario: Rodapé ausente sem permissão de edição

- **WHEN** um usuário MEMBER ou VIEWER abre a modal
- **THEN** o rodapé de ações com salvar e cancelar não é exibido

#### Scenario: Rodapé acessível e traduzido

- **WHEN** o usuário navega pelo rodapé por teclado ou troca o idioma da aplicação
- **THEN** os botões expõem rótulo acessível, recebem foco visível em ordem lógica e aparecem traduzidos em PT-BR, EN e ES

### Requirement: Rascunho local dos campos do projeto na modal

Enquanto a modal estiver aberta, o sistema SHALL manter um rascunho local de todos
os campos editáveis, incluindo o nome do projeto, e SHALL enviar ao servidor apenas
os campos que divergirem dos valores carregados.

#### Scenario: Alteração do nome do projeto

- **WHEN** um ADMIN altera o nome do projeto na modal e aciona o botão de salvar
- **THEN** o sistema envia o novo nome em `PATCH /projects/:id` e o nome atualizado passa a ser exibido no cabeçalho da modal

#### Scenario: Nome inválido

- **WHEN** um ADMIN apaga o nome do projeto e aciona o botão de salvar
- **THEN** o sistema não envia a gravação e indica que o nome do projeto é obrigatório

#### Scenario: Apenas campos alterados são enviados

- **WHEN** um ADMIN altera somente a Data de Início e aciona o botão de salvar
- **THEN** a requisição de gravação contém apenas a Data de Início alterada

#### Scenario: Reabrir a modal recarrega o servidor

- **WHEN** um ADMIN salva uma alteração, fecha a modal e a reabre
- **THEN** os campos exibem os valores persistidos, sem resíduo de rascunho anterior
