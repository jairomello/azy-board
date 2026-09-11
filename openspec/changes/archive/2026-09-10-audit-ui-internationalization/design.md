## Context

O frontend já usa `i18next` e `react-i18next`, com recursos para PT-BR, EN e ES separados por namespaces. A imagem evidencia que a troca para EN funciona apenas parcialmente: a página de projetos ainda renderiza títulos, navegação, ações e textos auxiliares em português. O problema pode ocorrer tanto por strings literais em componentes quanto por chaves ausentes, namespaces incorretos, valores vindos de dados sem tradução ou formatação independente do locale.

A mudança é transversal ao frontend e deve preservar o idioma padrão PT-BR, a persistência da preferência e o fallback existente. A auditoria deve cobrir todos os caminhos visíveis, não apenas a tela apresentada na imagem.

## Goals / Non-Goals

**Goals:**

- Inventariar strings visíveis em páginas, componentes compartilhados, modais, toasts, validações, estados vazios, erros, tooltips e acessibilidade.
- Garantir que todos os idiomas tenham as mesmas chaves para cada namespace usado pela UI.
- Substituir texto literal por `t()` ou mecanismo equivalente, mantendo interpolação, pluralização e labels dinâmicos corretos.
- Garantir que troca de idioma atualize a interface sem recarregar a página.
- Centralizar a formatação de datas, horas, números, percentuais e mensagens relativas em helpers baseados no locale atual.
- Criar verificações automatizadas para paridade de chaves e regressões representativas de troca de idioma.

**Non-Goals:**

- Alterar a biblioteca de i18n ou introduzir um novo sistema de tradução.
- Traduzir nomes e descrições fornecidos pelo usuário, títulos de projetos, cards, tags ou conteúdo Markdown armazenado.
- Alterar contratos da API, persistência de idioma ou modelo de dados sem evidência encontrada na auditoria.
- Fazer tradução automática de documentação fora da interface web.

## Decisions

### 1. Auditar por superfície da UI e por namespace

Será feito um inventário dos componentes em `apps/web/src/pages`, `components`, `contexts` e utilitários que produzem texto. Cada ocorrência será classificada como texto de produto, conteúdo de usuário, enum técnico, erro externo ou valor formatável. Textos de produto serão associados ao namespace da feature; conteúdo de usuário permanecerá intacto.

**Alternativa considerada:** corrigir somente os textos destacados na imagem. Foi rejeitada porque deixaria o mesmo defeito em outras rotas e estados.

### 2. Usar paridade estrutural dos arquivos JSON como contrato

Um check local comparará recursivamente as chaves de PT-BR, EN e ES por namespace, falhando quando uma tradução estiver ausente ou quando houver chave extra não intencional. O PT-BR continuará sendo o fallback de runtime, mas não será usado para ocultar lacunas nos idiomas suportados.

**Alternativa considerada:** depender apenas do fallback do i18next. Foi rejeitada porque a interface pareceria traduzida parcialmente sem revelar a cobertura incompleta durante o desenvolvimento.

### 3. Separar tradução de conteúdo e de apresentação

Strings de domínio como status, tipos de card, papéis e ações terão chaves de tradução. Valores livres do usuário continuarão sendo exibidos como foram salvos. Datas, números e percentuais serão formatados por helpers que recebem o locale ativo, evitando `toLocaleString` espalhado e formatos fixos.

**Alternativa considerada:** traduzir valores no backend. Foi rejeitada porque o idioma é uma preferência da interface e agentes/API não devem receber texto dependente da locale do navegador.

### 4. Validar troca de idioma em componentes representativos

Os testes existentes de contrato do frontend serão complementados com cenários que renderizam superfícies críticas em EN e ES, verificam ausência de texto PT-BR conhecido e confirmam atualização após mudança de locale. A cobertura incluirá shell, projetos, board, dashboard, conta/configurações, autenticação, modais, toasts e Azy Agent.

**Alternativa considerada:** validar somente os arquivos JSON. Foi rejeitada porque não detecta strings literais nem componentes que usam a chave errada.

## Risks / Trade-offs

- **[Risco]** A auditoria encontrar muitas strings e aumentar o escopo da alteração. → Priorizar todas as superfícies acessíveis e agrupar chaves por namespace, registrando casos não visíveis ou fora do produto como follow-up.
- **[Risco]** Renomear chaves quebrar componentes ou testes existentes. → Preferir adicionar/corrigir chaves com mudanças pequenas e executar typecheck/testes após cada grupo de feature.
- **[Risco]** Texto técnico ou enum de domínio ser traduzido indevidamente. → Manter uma classificação explícita entre conteúdo de produto, conteúdo do usuário e identificadores técnicos.
- **[Risco]** Paridade estrita bloquear uma chave intencionalmente específica de um locale. → Documentar exceções e permitir apenas diferenças justificadas, sem ignorar namespaces inteiros.
- **[Risco]** Dados antigos ou mensagens da API permanecerem em português. → Traduzir códigos estáveis no frontend quando possível e preservar mensagens externas apenas quando não houver código traduzível.

## Migration Plan

1. Inventariar as superfícies e estabelecer o relatório inicial de chaves ausentes e strings literais.
2. Corrigir recursos e componentes por domínio, começando pelo shell/projetos mostrado na imagem e seguindo para board, dashboard, conta, configurações, autenticação e agente.
3. Adicionar os checks de paridade e testes de troca de idioma.
4. Executar typecheck, testes frontend e build de produção.
5. Publicar normalmente; não há migração de banco prevista. Em caso de regressão, reverter o commit da feature, pois os recursos de tradução são carregados no build.

## Open Questions

- Mensagens de erro retornadas pela API possuem códigos estáveis suficientes para o frontend traduzir sem depender do texto original?
- A lista de idiomas deve continuar mostrando PT/EN/ES enquanto a cobertura da auditoria estiver sendo concluída, ou algum idioma deve ser temporariamente ocultado caso falte tradução crítica?
