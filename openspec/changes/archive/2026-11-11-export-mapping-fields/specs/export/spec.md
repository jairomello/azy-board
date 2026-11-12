# Spec Delta

## Purpose

Definir a exportação de itens do projeto em planilha ou CSV e a gestão de mapeamentos de campos reutilizáveis por projeto.

## ADDED Requirements

### Requirement: Exportar a população filtrada do projeto
O sistema SHALL permitir exportar os itens do projeto em XLSX ou CSV, aplicando os mesmos filtros de população do board. Itens arquivados SHALL ficar fora do resultado por padrão e SHALL ser incluídos somente com pedido explícito. O nome do arquivo SHALL identificar o projeto e a data.

#### Scenario: Exportação sem filtros
- **WHEN** o usuário exporta o projeto sem filtros
- **THEN** o arquivo contém os itens não arquivados do projeto

#### Scenario: Exportação com filtros do board
- **WHEN** o usuário exporta com módulo, status ou responsável selecionados
- **THEN** o arquivo contém apenas os itens que atendem a todos os filtros aplicados

#### Scenario: Incluir arquivados sob demanda
- **WHEN** o usuário solicita incluir arquivados
- **THEN** os itens arquivados também aparecem no arquivo

### Requirement: Exportação mapeada por campos
O sistema SHALL permitir exportar em modo mapeado, escolhendo campos de origem, nome de destino e tipo de destino opcional. Uma exportação mapeada SHALL exigir um mapeamento informado ou salvo. O sistema SHALL recusar mapeamentos com campo de origem desconhecido, destino vazio ou destino duplicado, sem gerar arquivo parcial.

#### Scenario: Mapeamento válido gera colunas de destino
- **WHEN** o usuário exporta com um mapeamento que renomeia e reordena campos
- **THEN** o arquivo exibe as colunas na ordem e com os nomes de destino definidos

#### Scenario: Tipo de destino sobrepõe o tipo de origem
- **WHEN** o usuário define um tipo no destino diferente do tipo do campo de origem
- **THEN** os valores são convertidos para o tipo escolhido e valores incompatíveis são tratados como vazios

#### Scenario: Mapeamento ausente
- **WHEN** o usuário pede exportação mapeada sem informar mapeamento
- **THEN** a API recusa a operação sem gerar arquivo

#### Scenario: Mapeamento inválido
- **WHEN** o mapeamento tem campo desconhecido, destino vazio ou dois destinos com o mesmo nome
- **THEN** a API rejeita com erro de mapeamento inválido e nenhum arquivo é gerado

### Requirement: Mapeamentos salvos por projeto
O sistema SHALL permitir listar, criar, atualizar e excluir mapeamentos de exportação por projeto. Usuários com papel VIEWER SHALL poder listar; MEMBER ou superior SHALL poder criar, alterar e excluir. O nome do mapeamento SHALL ser único dentro do projeto.

#### Scenario: Salvar um mapeamento
- **WHEN** um MEMBER salva um mapeamento com nome e campos válidos
- **THEN** o mapeamento fica disponível para as próximas exportações do mesmo projeto

#### Scenario: Reutilizar mapeamento salvo
- **WHEN** o usuário exporta escolhendo um mapeamento salvo
- **THEN** o arquivo usa os campos salvos naquele mapeamento

#### Scenario: Nome duplicado
- **WHEN** um MEMBER tenta salvar um mapeamento com nome já usado no projeto
- **THEN** a API recusa com conflito de nome

#### Scenario: Viewer não altera mapeamentos
- **WHEN** um VIEWER tenta criar, alterar ou excluir um mapeamento
- **THEN** a API rejeita a operação por permissão

#### Scenario: Isolamento entre projetos
- **WHEN** o usuário consulta mapeamentos de um projeto
- **THEN** somente os mapeamentos daquele projeto e tenant são retornados
