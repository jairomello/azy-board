## Context

O backend já possui a tabela `apiKeys` com `tenantId`, `ownerId`, `keyHash`, `name`, `aiModelName`, `createdAt` e `lastUsedAt`. Existe uma rota `/projects/:projectId/api-keys` (POST + GET) que, apesar do caminho, filtra por `tenantId + ownerId` — portanto as chaves são de fato por usuário, não por projeto. O `projectId` na rota atual serve apenas para validar membership via `requireRole`.

O frontend não possui dropdown de perfil nem página de conta. As strings de i18n para `apiKeys`, `newApiKey`, `apiKeyName` e `apiKeyWarning` já existem em `pt-BR/settings.json`.

## Goals / Non-Goals

**Goals:**
- Dropdown de perfil acessível via clique no `UserAvatar` em todos os headers
- Rota `/account` protegida com página de configurações de conta
- Seção de API Keys: listar, criar (com exibição única do valor completo) e revogar
- Endpoints REST de usuário: `GET /api-keys`, `POST /api-keys`, `DELETE /api-keys/:id` — sem vínculo de projeto

**Non-Goals:**
- Edição de nome/e-mail/senha do usuário (escopo futuro)
- Upload de avatar (escopo futuro)
- Rotação automática de chaves
- Remoção da rota legada `/projects/:projectId/api-keys` neste sprint

## Decisions

**1. Novos endpoints no nível do usuário (`/api-keys`)**
A rota atual vincula a chave a um projeto por convenção de URL, mas a lógica real é por usuário. Criar `/api-keys` no nível raiz torna a semântica correta e permite acesso sem projeto ativo.
_Alternativa descartada:_ reutilizar a rota existente passando um `projectId` arbitrário — confuso e não reflete o modelo de dados.

**2. Dropdown via `DropdownMenu` do shadcn/ui**
Já instalado, consistente com o design system do projeto. Extrair um componente `ProfileDropdown` reutilizável usado em todos os headers.
_Alternativa descartada:_ modal de perfil diretamente — dropdown é menos invasivo e já é padrão em SaaS.

**3. Página `/account` como rota própria (não modal)**
Configurações de conta têm conteúdo suficiente para justificar uma página inteira. URL própria facilita deep-link e torna o fluxo de "gerar chave → configurar MCP" mais claro.
_Alternativa descartada:_ modal/sheet — limitaria espaço para conteúdo futuro (perfil, preferências).

**4. Exibição única do valor completo da chave**
O backend já retorna o valor completo apenas no `POST`. A UI deve capturar esse retorno, exibi-lo em um Dialog com botão de cópia e instruir o usuário a salvá-lo — nunca é possível recuperá-lo depois.

**5. DELETE `/api-keys/:id` com anti-IDOR**
O endpoint deve verificar `ownerId === userId` no servidor antes de deletar — nunca confiar apenas no `id` recebido.

## Risks / Trade-offs

- **Duas rotas para API Keys** durante a transição → Mitigação: documentar deprecação da rota de projeto; remover em sprint futuro.
- **Usuário fecha o Dialog sem copiar a chave** → Mitigação: confirmação "Já copiei" obrigatória antes de fechar; após fechar não há como recuperar.
- **Proliferação de chaves sem uso** → Mitigação: exibir `lastUsedAt` na lista para o usuário identificar chaves obsoletas e revogar.
