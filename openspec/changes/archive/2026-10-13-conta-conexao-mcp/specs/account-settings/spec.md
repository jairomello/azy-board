# Spec Delta

## ADDED Requirements

### Requirement: Orientação de conexão do MCP na seção de API Keys

A página `/account` SHALL incluir, na seção de API Keys, a orientação de conexão do MCP do Azy Board (explicação da finalidade da chave, URL do MCP e instrução para o code agent), sem alterar as seções existentes de perfil, aparência e visibilidade de projetos.

#### Scenario: Orientação na seção de API Keys

- **WHEN** um usuário autenticado abre `/account`
- **THEN** a seção de API Keys exibe a orientação de conexão do MCP junto das demais seções da página
