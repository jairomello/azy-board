## Why

O MCP do Azy Board autentica agentes de IA via `EASYBOARD_API_KEY`, mas não existe interface para o usuário gerar ou revogar essas chaves — tornando o MCP inutilizável sem intervenção manual no banco. A funcionalidade de backend (`/api-keys`) já existe; falta apenas a UI de gerenciamento.

## What Changes

- Dropdown de perfil ao clicar no avatar do usuário nos headers de `ProjectsPage` e `BoardPage`
- Nova rota `/account` com página de configurações de conta do usuário
- Seção de API Keys na página de conta: listar chaves existentes, gerar nova chave (com exibição única do valor completo) e revogar
- Novo endpoint REST `GET /api-keys` e `DELETE /api-keys/:id` no nível do usuário (sem vínculo com projeto), substituindo a rota atual `/projects/:projectId/api-keys`

## Capabilities

### New Capabilities

- `account-settings`: Página `/account` acessível via dropdown do avatar; centraliza configurações pessoais do usuário (perfil, API Keys)
- `api-key-management`: UI completa para criar, listar e revogar API Keys do usuário; integra com o backend existente de `apiKeys`

### Modified Capabilities

- `mcp-server`: A documentação de configuração do MCP passará a referenciar a UI de geração de chaves em vez de instrução manual

## Impact

- **Frontend:** novos componentes `ProfileDropdown`, `AccountPage`, `ApiKeysSection`; ajustes nos headers de `ProjectsPage` e `BoardPage`; nova rota `/account` em `App.tsx`
- **Backend:** novos endpoints `GET /api-keys` e `DELETE /api-keys/:id` no nível do usuário (apenas `authMiddleware`, sem `requireRole` de projeto); rota existente `/projects/:projectId/api-keys` mantida por compatibilidade no curto prazo
- **Sem novas dependências:** usa shadcn/ui (já instalado) para Dropdown e Dialog
