## 1. Inventário E Contrato

- [x] 1.1 Mapear páginas, componentes compartilhados, modais, toasts, validações, tooltips, mensagens de erro e textos de acessibilidade do frontend.
- [x] 1.2 Classificar cada texto encontrado como texto de produto, conteúdo do usuário, identificador técnico, mensagem externa ou valor formatável.
- [x] 1.3 Comparar recursivamente as chaves dos namespaces `common`, `auth`, `board`, `settings`, `dashboard` e `assistant` entre PT-BR, EN e ES e registrar as lacunas.
- [x] 1.4 Definir convenções de nomes, interpolação, pluralização e localização de enumerações para as chaves que serão adicionadas ou corrigidas.

## 2. Shell E Projetos

- [x] 2.1 Internacionalizar o shell da aplicação, breadcrumb/workspace, navegação lateral, seletor de idioma, tema, perfil e status de conexão.
- [x] 2.2 Internacionalizar a página de projetos, incluindo título, saudação, descrição, criação/edição, ações, abertura do board, estados vazios e mensagens de erro.
- [x] 2.3 Completar e revisar as traduções PT-BR, EN e ES dos namespaces usados pelo shell e pelos projetos.

## 3. Board E Dashboard

- [x] 3.1 Auditar e internacionalizar board, colunas, cards, filtros, chips, busca, ordenação, swimlanes, árvore e estados de carregamento/vazio.
- [x] 3.2 Internacionalizar modais e formulários de item, story, epic, checklist, tags, versões, sprints, anexos, logs e work log.
- [x] 3.3 Auditar dashboard e visualizações, incluindo métricas, legendas, descrições, tooltips, percentuais, datas e mensagens sem dados.
- [x] 3.4 Completar e revisar as traduções dos namespaces `board` e `dashboard` nos três idiomas.

## 4. Autenticação, Conta, Configurações E Agente

- [x] 4.1 Auditar login, sessão expirada, autorização, mensagens de API e estados de erro para eliminar texto de produto fora do i18n.
- [x] 4.2 Internacionalizar conta, configurações, usuários, membros, squads, chaves de API, provedores de IA e preferências.
- [x] 4.3 Internacionalizar o Azy Agent, incluindo drawer, histórico, aprovação, cancelamento, importação CSV, limites, falhas e estados de execução.
- [x] 4.4 Completar e revisar as traduções dos namespaces `auth`, `settings` e `assistant` nos três idiomas.

## 5. Formatação E Infraestrutura De I18n

- [x] 5.1 Criar ou consolidar helpers compartilhados para datas, horas, números, percentuais e tempo relativo usando o locale atual.
- [x] 5.2 Substituir formatos fixos e formatações locais espalhadas pelos helpers ou APIs baseadas no locale.
- [x] 5.3 Verificar que a troca de idioma atualiza traduções e valores formatados sem recarregar a página e preserva o conteúdo fornecido pelo usuário.
- [x] 5.4 Adicionar tratamento de chaves ausentes que mantenha o fallback PT-BR em runtime sem esconder falhas no desenvolvimento.

## 6. Checks E Testes

- [x] 6.1 Adicionar check automatizado de paridade estrutural entre os arquivos de tradução PT-BR, EN e ES, com exceções explícitas quando necessário.
- [x] 6.2 Adicionar check ou inventário automatizado para detectar texto de produto literal em superfícies do frontend sem sinalizar conteúdo de usuário e identificadores técnicos.
- [x] 6.3 Criar testes representativos de troca de idioma para shell, projetos, board, dashboard, conta/configurações, autenticação e Azy Agent.
- [x] 6.4 Validar traduções, interpolação, pluralização, fallback e formatação de datas/números nos três idiomas.
- [x] 6.5 Executar typecheck, testes frontend e build de produção; corrigir regressões antes de concluir a mudança.
