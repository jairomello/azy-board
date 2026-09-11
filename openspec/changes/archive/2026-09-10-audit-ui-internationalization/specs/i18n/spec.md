## MODIFIED Requirements

### Requirement: Suporte a múltiplos idiomas (PT-BR, EN, ES)
O sistema SHALL suportar os idiomas Português do Brasil (PT-BR), Inglês (EN) e Espanhol (ES). PT-BR SHALL ser o idioma padrão. Toda string de produto visível na UI SHALL ser internacionalizada — nenhum texto fixo de produto pode permanecer em componentes, páginas, modais, toasts, validações, tooltips ou mensagens de acessibilidade. Conteúdo fornecido pelo usuário, identificadores técnicos e nomes próprios SHALL ser preservados.

#### Scenario: Seleção de idioma pelo usuário
- **WHEN** usuário seleciona um idioma no seletor de idioma
- **THEN** interface muda para o idioma selecionado imediatamente sem recarregar a página, incluindo shell, navegação, ações, estados vazios, feedbacks e conteúdo de acessibilidade

#### Scenario: Idioma persistido por usuário
- **WHEN** usuário autenticado altera o idioma
- **THEN** preferência é salva no banco (campo `language` do usuário) e carregada automaticamente em próximas sessões

#### Scenario: Fallback para PT-BR em chave ausente
- **WHEN** uma chave de tradução não existe no idioma selecionado
- **THEN** sistema exibe o texto em PT-BR como fallback, sem quebrar a UI, e o check de cobertura identifica a chave ausente durante o desenvolvimento

#### Scenario: Paridade de recursos de tradução
- **WHEN** os recursos de tradução são verificados localmente
- **THEN** cada namespace usado pela UI possui as mesmas chaves estruturais em PT-BR, EN e ES, salvo exceções explicitamente documentadas

#### Scenario: Conteúdo de usuário não é traduzido
- **WHEN** usuário seleciona outro idioma
- **THEN** nomes de projetos, cards, tags, descrições e Markdown armazenados permanecem inalterados

---

### Requirement: Arquitetura expansível para novos idiomas
O sistema SHALL organizar as traduções em namespaces por feature (`common`, `board`, `auth`, `settings`, `dashboard`, `assistant`) de forma que adicionar um novo idioma exija apenas criar novos arquivos JSON de tradução e registrar o locale, sem alteração de código de negócio. Componentes SHALL usar o namespace correspondente e não duplicar traduções em strings literais.

#### Scenario: Adição de novo idioma futuro
- **WHEN** desenvolvedor adiciona arquivos de tradução para um novo idioma (ex: FR) e registra o locale
- **THEN** o novo idioma aparece automaticamente no seletor de idioma da aplicação

#### Scenario: Chave no namespace correto
- **WHEN** uma feature renderiza texto de produto
- **THEN** componente consulta uma chave do namespace da feature, com interpolação e pluralização suportadas quando aplicável

#### Scenario: Auditoria de texto literal
- **WHEN** o check de internacionalização é executado
- **THEN** ocorrências conhecidas de texto de produto fora dos recursos de tradução são reportadas para correção, sem reportar conteúdo de usuário ou identificadores técnicos

---

### Requirement: Datas e números formatados por locale
O sistema SHALL formatar datas, horas, números, percentuais e mensagens relativas de acordo com o locale do idioma selecionado pelo usuário. Componentes SHALL usar helpers de formatação compartilhados ou APIs equivalentes baseadas no locale atual, sem formatos fixos para texto de produto.

#### Scenario: Data formatada em PT-BR
- **WHEN** usuário com idioma PT-BR visualiza uma data
- **THEN** data é exibida no formato `DD/MM/AAAA`

#### Scenario: Data formatada em EN
- **WHEN** usuário com idioma EN visualiza a mesma data
- **THEN** data é exibida no formato `MM/DD/YYYY`

#### Scenario: Números e percentuais formatados
- **WHEN** usuário alterna entre PT-BR, EN e ES e visualiza pontos, contagens ou percentuais
- **THEN** separadores e convenções numéricas correspondem ao locale selecionado

#### Scenario: Formatação atualizada após troca de idioma
- **WHEN** usuário troca o idioma enquanto uma data ou número está visível
- **THEN** valor é reformatado imediatamente sem recarregar a página
