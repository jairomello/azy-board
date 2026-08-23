## 1. Modelo E Seed

- [x] 1.1 Adicionar ao modelo de usuário o grupo global enumerado com `TEAM_MEMBER` como valor padrão e criar a migração compatível com SQLite e o adapter futuro PostgreSQL/Supabase.
- [x] 1.2 Atualizar consultas de usuário para sempre aplicar `tenant_id`, incluindo comentários `// [TENANT]` e `// [DB-SWAP]` nos pontos exigidos pelo projeto.
- [x] 1.3 Atualizar o setup/seed para definir `jairo.silva@ntconsult.com.br` como `ROOT` sem hardcode de senha.
- [x] 1.4 Criar validação central da precedência `TEAM_MEMBER < MANAGER < ADMIN < ROOT` e dos grupos aceitos.

## 2. Sessão E Autorização

- [x] 2.1 Incluir o grupo global na identidade autenticada e atualizar a resolução de sessão sem confiar em valores enviados pelo cliente.
- [x] 2.2 Implementar middleware/predicados de autorização para níveis globais e proteção das rotas do módulo Administração.
- [x] 2.3 Implementar resolução de escopo de projetos: membership ativa para Membro de Equipe/Gerente e tenant completo para Admin/Root.
- [x] 2.4 Aplicar filtros obrigatórios de `tenant_id` e `userId` nas queries de projetos e recursos relacionados, cobrindo cenários anti-IDOR.
- [x] 2.5 Garantir que alterações de grupo invalidem ou renovem a sessão afetada e que não produzam autoelevação.

## 3. APIs De Usuários

- [x] 3.1 Criar endpoint protegido para listar usuários do tenant ativo, acessível somente a Admin e Root.
- [x] 3.2 Criar endpoint protegido para cadastrar usuário no tenant ativo com grupo válido.
- [x] 3.3 Criar endpoint protegido para alterar o grupo de usuário, proibindo Admin de atribuir `ROOT` e qualquer usuário de elevar o próprio privilégio.
- [x] 3.4 Validar alvos por `tenant_id` e retornar 403/404 sem permitir enumeração de usuários de outro tenant.

## 4. Regras De Projetos

- [x] 4.1 Ajustar criação e listagem de projetos para aplicar os grupos globais e manter as colunas padrão e demais regras existentes.
- [x] 4.2 Ajustar autorização de configurações, membros, squads e demais operações para distinguir Membro de Equipe, Gerente, Admin e Root.
- [x] 4.3 Preservar os papéis de membership `ADMIN`, `MEMBER` e `VIEWER` como camada complementar dentro do escopo global.
- [x] 4.4 Cobrir endpoints de projeto com testes de acesso por grupo, membership, tenant e tentativa de acesso direto por ID.

## 5. Interface

- [x] 5.1 Adicionar o grupo de menu lateral `Admin` e exibi-lo somente para usuários Admin ou Root.
- [x] 5.2 Criar a tela de administração de usuários com listagem, cadastro e seleção de grupo sem opção Root para Admin.
- [x] 5.3 Atualizar navegação e controles de projetos para ocultar Administração e Configurações de projeto para Membros de Equipe e Administração para Gerentes.
- [x] 5.4 Exibir feedback de 403, falha de validação e sucesso nas operações de usuários, mantendo acessibilidade e i18n.
- [x] 5.5 Garantir que a interface funcione em desktop e mobile sem depender dela para segurança.

## 6. Verificação

- [x] 6.1 Adicionar testes de unidade para precedência, grupos válidos e regras contra elevação de privilégios.
- [x] 6.2 Adicionar testes de integração para APIs administrativas, isolamento multi-tenant e escopo de projetos.
- [x] 6.3 Adicionar testes de frontend para visibilidade do menu, configurações e controles por grupo.
- [x] 6.4 Executar checagem TypeScript strict, lint, testes e build; corrigir regressões antes de concluir.
