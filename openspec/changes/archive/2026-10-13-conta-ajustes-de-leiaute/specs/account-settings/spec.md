# Spec Delta

## ADDED Requirements

### Requirement: Posição da seção de senha na página de conta

A página `/account` SHALL exibir a seção de senha imediatamente após o bloco de identidade (nome de exibição, e-mail e foto de perfil) e antes da seção de Aparência, mantendo as demais seções e a ordem relativa entre elas. A posição SHALL ser a mesma quando a seção apenas informa que a senha é gerenciada por um provedor de autenticação integrado.

#### Scenario: Senha logo após o bloco de identidade

- **WHEN** um usuário autenticado abre `/account`
- **THEN** a seção de senha aparece imediatamente após o bloco com nome, e-mail e foto de perfil, e antes de Aparência

#### Scenario: Demais seções preservadas

- **WHEN** a seção de senha muda de posição
- **THEN** Aparência, Visibilidade do projeto e Chaves de API continuam presentes e mantêm entre si a ordem anterior

#### Scenario: Mesma posição com provedor integrado

- **WHEN** a instalação usa provedor de autenticação integrado e a seção de senha apenas informa que a senha é gerenciada fora do Azy Board
- **THEN** essa indicação permanece na mesma posição, logo após o bloco de identidade
