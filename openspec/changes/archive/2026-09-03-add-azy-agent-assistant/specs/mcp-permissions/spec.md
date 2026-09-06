## MODIFIED Requirements

### Requirement: Contexto efetivo do Owner
O MCP SHALL resolver o Owner humano da API Key no servidor, validando hash da chave, `owner_id`, `tenant_id`, grupo global persistido e estado de revogação/expiração antes de executar qualquer ferramenta. O agente SHALL herdar o grupo do Owner e nunca poderá informar outro grupo no payload. O harness interno do Azy Agent SHALL aplicar, em vez desse Owner de API Key, o contexto do usuário humano autenticado na sessão e suas permissões efetivas.

#### Scenario: Agente herda grupo de Membro de Equipe
- **WHEN** API Key válida pertence a um usuário `TEAM_MEMBER`
- **THEN** toda ferramenta MCP aplica as permissões de Membro de Equipe desse usuário

#### Scenario: Grupo enviado pelo agente é ignorado
- **WHEN** uma chamada MCP inclui grupo global ou papel local diferente do persistido
- **THEN** o servidor ignora o valor enviado e usa somente a identidade persistida do Owner

#### Scenario: Owner inexistente ou chave inválida
- **WHEN** a API Key não possui Owner válido no tenant indicado, está expirada ou revogada
- **THEN** o servidor rejeita a chamada antes de consultar ou alterar qualquer recurso

#### Scenario: Azy Agent usa identidade humana
- **WHEN** usuário autenticado solicita uma tool pelo chat
- **THEN** o harness usa userId, tenantId, grupo e membership da sessão atual, sem conceder privilégios Root derivados da configuração do provider
