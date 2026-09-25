## MODIFIED Requirements

### Requirement: Nível mínimo por ferramenta

Cada ferramenta SHALL declarar e verificar seu nível mínimo de grupo global e, quando aplicável, o nível mínimo de papel local, via `MCP_TOOL_POLICIES` em `packages/tool-registry` (`@azy-board/tool-registry`). Ferramentas de conteúdo SHALL respeitar o papel local; criação de projetos SHALL exigir `MANAGER`; configurações e administração SHALL exigir o nível correspondente da política REST.

#### Scenario: Membro usa operação de conteúdo permitida

- **WHEN** Membro de Equipe usa ferramenta de leitura ou mutação de conteúdo em projeto membro
- **THEN** o MCP permite somente a operação equivalente autorizada pela API REST

#### Scenario: Membro tenta configurar projeto

- **WHEN** API Key de Membro de Equipe invoca ferramenta de configuração, membros, squads ou administração do projeto
- **THEN** o MCP retorna 403 antes da mutação

#### Scenario: Gerente cria projeto

- **WHEN** API Key de Gerente invoca ferramenta de criação de projeto
- **THEN** o MCP permite a criação dentro do tenant do Owner

#### Scenario: Gerente tenta administração global

- **WHEN** API Key de Gerente invoca ferramenta de usuários ou outra ferramenta do módulo Admin
- **THEN** o MCP retorna 403 sem executar a operação

#### Scenario: Policy consultada do package

- **WHEN** o MCP ou o harness do Azy Agent verifica permissões de uma ferramenta
- **THEN** a policy é lida de `MCP_TOOL_POLICIES` em `packages/tool-registry`, não de arquivo interno do app
