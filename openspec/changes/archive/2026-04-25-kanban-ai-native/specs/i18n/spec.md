## ADDED Requirements

### Requirement: Suporte a múltiplos idiomas (PT-BR, EN, ES)
O sistema SHALL suportar os idiomas Português do Brasil (PT-BR), Inglês (EN) e Espanhol (ES). PT-BR SHALL ser o idioma padrão. Toda string visível na UI SHALL ser internacionalizada — nenhum texto fixo em código.

#### Scenario: Seleção de idioma pelo usuário
- **WHEN** usuário seleciona um idioma no seletor de idioma
- **THEN** interface muda para o idioma selecionado imediatamente sem recarregar a página

#### Scenario: Idioma persistido por usuário
- **WHEN** usuário autenticado altera o idioma
- **THEN** preferência é salva no banco (campo `language` do usuário) e carregada automaticamente em próximas sessões

#### Scenario: Fallback para PT-BR em chave ausente
- **WHEN** uma chave de tradução não existe no idioma selecionado
- **THEN** sistema exibe o texto em PT-BR como fallback, sem quebrar a UI

---

### Requirement: Arquitetura expansível para novos idiomas
O sistema SHALL organizar as traduções em namespaces por feature (`common`, `board`, `auth`, `settings`) de forma que adicionar um novo idioma exija apenas criar novos arquivos JSON de tradução, sem alteração de código.

#### Scenario: Adição de novo idioma futuro
- **WHEN** desenvolvedor adiciona arquivos de tradução para um novo idioma (ex: FR) e registra o locale
- **THEN** o novo idioma aparece automaticamente no seletor de idioma da aplicação

---

### Requirement: Datas e números formatados por locale
O sistema SHALL formatar datas, horas e números de acordo com o locale do idioma selecionado pelo usuário.

#### Scenario: Data formatada em PT-BR
- **WHEN** usuário com idioma PT-BR visualiza uma data
- **THEN** data é exibida no formato `DD/MM/AAAA`

#### Scenario: Data formatada em EN
- **WHEN** usuário com idioma EN visualiza a mesma data
- **THEN** data é exibida no formato `MM/DD/YYYY`
