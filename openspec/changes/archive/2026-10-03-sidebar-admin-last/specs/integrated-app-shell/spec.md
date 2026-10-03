## ADDED Requirements

### Requirement: Ordem dos itens globais de navegação da sidebar

O sistema SHALL apresentar, na sidebar do `AppShell`, o item `Conta` antes do grupo `Admin`, de forma que `Admin` seja o **último** item da navegação quando visível. O grupo `Admin` SHALL continuar condicionado a `canAccessAdmin(user.globalGroup)`, permanecendo visível apenas para os grupos `ADMIN` e `ROOT`, e SHALL permanecer ausente para os demais grupos.

#### Scenario: Admin e Root veem Conta antes de Admin

- **WHEN** um usuário com grupo global `ADMIN` ou `ROOT` acessa a aplicação
- **THEN** o item `Conta` é renderizado antes do grupo `Admin`
- **AND** o grupo `Admin` é o último item da sidebar

#### Scenario: Submenu de Admin permanece agrupado ao final

- **WHEN** um usuário com grupo global `ADMIN` ou `ROOT` expande o grupo `Admin`
- **THEN** os sub-itens `Usuários` e `Anexos` são renderizados sob o grupo `Admin`
- **AND** para `ROOT`, o sub-item `Config. Tenant` (`/admin/assistant`) também é renderizado sob o grupo `Admin`
- **AND** o grupo `Admin` continua sendo o último item da sidebar, após `Conta`

#### Scenario: Grupo sem permissão não vê Admin

- **WHEN** um usuário com grupo global `TEAM_MEMBER` ou `MANAGER` acessa a aplicação
- **THEN** o grupo `Admin` não é renderizado
- **AND** o item `Conta` permanece visível na navegação
