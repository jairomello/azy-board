# Spec Delta

## Purpose

Oferecer, dentro do produto, uma central de ajuda autenticada que apresenta o manual funcional do Azy Board como páginas navegáveis, servidas a partir da documentação versionada.

## ADDED Requirements

### Requirement: Navegação lateral por tópicos

A central de ajuda SHALL apresentar, ao lado do conteúdo, um índice de tópicos derivado da estrutura da documentação (módulos e páginas, com título e ordem da fonte) e SHALL permitir abrir qualquer página do manual exposto a partir desse índice ou por acesso direto à rota da página.

#### Scenario: Índice reflete a estrutura da documentação

- **WHEN** o usuário abre a central de ajuda
- **THEN** o índice exibe os módulos na ordem definida pela fonte, cada um com suas páginas e títulos

#### Scenario: Abrir página pelo índice

- **WHEN** o usuário seleciona uma página no índice
- **THEN** o conteúdo dessa página é exibido e o item correspondente do índice aparece como ativo

#### Scenario: Acesso direto por rota

- **WHEN** o usuário acessa diretamente a rota de uma página específica
- **THEN** a central abre nessa página e o índice é posicionado nela

### Requirement: Leitura de página fiel à documentação

A central de ajuda SHALL renderizar cada página a partir do markdown versionado, convertendo wikilinks, callouts e links relativos em navegação para as páginas da própria ajuda, sem alterar o texto funcional do documento.

#### Scenario: Wikilink vira link interno

- **WHEN** uma página contém um wikilink com rótulo
- **THEN** a ajuda exibe o rótulo como link que abre a página correspondente dentro da ajuda

#### Scenario: Callout preservado como destaque

- **WHEN** uma página contém um callout de aviso ou informação
- **THEN** a ajuda o apresenta como destaque legível, sem expor a sintaxe bruta

#### Scenario: Link relativo resolvido

- **WHEN** uma página referencia outra página por link relativo
- **THEN** a navegação abre o destino dentro da central de ajuda

#### Scenario: Conteúdo sem reescrita paralela

- **WHEN** uma página é exibida
- **THEN** o texto funcional corresponde ao documento versionado, sem uma cópia editada à mão

### Requirement: Escopo do conteúdo exposto

A central de ajuda SHALL expor apenas o manual funcional do produto. Documentos internos de controle editorial, documentos de padronização de escrita, arquivos de configuração do cofre de markdown e as seções técnicas recolhíveis das páginas SHALL NOT ser expostos.

#### Scenario: Documento interno não aparece

- **WHEN** o índice de tópicos é construído
- **THEN** os documentos das pastas internas `controle/` e `modelos/` não estão presentes

#### Scenario: Bloco técnico não aparece

- **WHEN** uma página que possui uma seção técnica recolhível em `<details>` é exibida
- **THEN** apenas o conteúdo funcional da página é mostrado

#### Scenario: Configuração do cofre ignorada

- **WHEN** o conteúdo da ajuda é gerado
- **THEN** os arquivos de configuração do editor de markdown (`.obsidian/`) não são considerados páginas

### Requirement: Disponibilidade apenas autenticada

A central de ajuda e o recurso que fornece seu conteúdo SHALL exigir sessão autenticada. O conteúdo SHALL NOT ser servido como recurso estático público.

#### Scenario: Sem sessão não há conteúdo

- **WHEN** uma requisição ao conteúdo da ajuda não apresenta sessão válida
- **THEN** a resposta indica não autorizado e nenhum conteúdo de página é retornado

#### Scenario: Sessão válida recebe a página

- **WHEN** um usuário autenticado solicita uma página do escopo exposto
- **THEN** a resposta contém o conteúdo dessa página

#### Scenario: Página fora do escopo

- **WHEN** é solicitada uma página que não pertence ao escopo exposto
- **THEN** a resposta indica não encontrado, sem revelar o conteúdo interno

### Requirement: Conteúdo servido a partir da documentação versionada

A central de ajuda SHALL servir o conteúdo a partir da documentação versionada que acompanha a instalação, identificando por página o documento de origem e uma versão ou hash do conteúdo, sem manter uma cópia paralela editada à mão.

#### Scenario: Origem e hash por página

- **WHEN** a central de ajuda fornece uma página
- **THEN** a resposta identifica o documento de origem e uma versão ou hash do conteúdo

#### Scenario: Documentação alterada é refletida

- **WHEN** um documento do escopo exposto é alterado
- **THEN** a central de ajuda passa a servir o conteúdo atualizado, sem edição em uma cópia paralela

#### Scenario: Documentação indisponível não derruba a aplicação

- **WHEN** a documentação não está disponível na instalação
- **THEN** a central de ajuda responde com um erro explícito e o restante da aplicação permanece funcional

### Requirement: Estados de carregamento e erro da ajuda

A central de ajuda SHALL indicar carregamento enquanto busca o conteúdo e SHALL exibir um estado de erro recuperável quando a busca falhar, mantendo a navegação utilizável.

#### Scenario: Conteúdo em carregamento

- **WHEN** o conteúdo de uma página está sendo buscado
- **THEN** a central exibe um estado de carregamento no lugar do conteúdo

#### Scenario: Falha recuperável

- **WHEN** a busca do conteúdo falha
- **THEN** a central exibe uma mensagem de erro com ação de tentar novamente e mantém o índice de tópicos navegável
