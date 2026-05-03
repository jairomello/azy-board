## 1. Backend — Novos endpoints de API Keys

- [x] 1.1 Criar rota `GET /api-keys` em `apps/api/src/routes/apiKeys.ts` filtrando por `tenantId + ownerId`
- [x] 1.2 Criar rota `POST /api-keys` em `apps/api/src/routes/apiKeys.ts` (mesma lógica da rota de projeto, sem `requireRole`)
- [x] 1.3 Criar rota `DELETE /api-keys/:id` com verificação anti-IDOR (`tenantId + ownerId + id`) retornando 404 se não encontrar
- [x] 1.4 Registrar o novo router em `apps/api/src/index.ts` no caminho `/api-keys`

## 2. Frontend — Componente ProfileDropdown

- [x] 2.1 Criar `apps/web/src/components/ProfileDropdown.tsx` usando `DropdownMenu` do shadcn/ui com opções "Configurações da conta" e "Sair"
- [x] 2.2 Substituir o `UserAvatar` estático em `ProjectsPage.tsx` pelo `ProfileDropdown` (remover botão "Sair" separado)
- [x] 2.3 Substituir o `UserAvatar` estático em `BoardPage.tsx` pelo `ProfileDropdown`

## 3. Frontend — Página de conta (`/account`)

- [x] 3.1 Criar `apps/web/src/pages/AccountPage.tsx` com cabeçalho (nome + e-mail do usuário) e botão de voltar para `/projects`
- [x] 3.2 Adicionar rota `/account` em `apps/web/src/App.tsx` protegida por autenticação
- [x] 3.3 Adicionar strings de i18n para a página de conta em `pt-BR/settings.json`, `en/settings.json` e `es/settings.json`

## 4. Frontend — Seção de API Keys

- [x] 4.1 Criar hook `useApiKeys` em `apps/web/src/hooks/useApiKeys.ts` com `list`, `create` e `revoke` chamando os novos endpoints
- [x] 4.2 Criar componente `ApiKeysSection.tsx` com listagem (nome, modelo de IA, criação, último uso) e estado vazio
- [x] 4.3 Criar Dialog de criação de chave: formulário com campo nome + modelo de IA opcional, botão confirmar
- [x] 4.4 Após criação bem-sucedida, exibir Dialog com valor completo da chave, botão de cópia e botão "Já copiei" (obrigatório para fechar)
- [x] 4.5 Implementar confirmação de revogação (AlertDialog do shadcn/ui) antes de chamar o endpoint DELETE
- [x] 4.6 Integrar `ApiKeysSection` na `AccountPage`
