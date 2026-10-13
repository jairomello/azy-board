# Spec Delta

## ADDED Requirements

### Requirement: Troca de senha pelo próprio usuário no login local
Quando o provedor de autenticação da instalação for local, o sistema SHALL permitir que o usuário autenticado altere a própria senha informando a senha atual, uma nova senha e a confirmação. O sistema SHALL verificar a senha atual no servidor antes de gravar, SHALL definir o alvo da alteração exclusivamente a partir da sessão e SHALL armazenar a nova senha como hash bcrypt, nunca em texto plano.

#### Scenario: Troca de senha bem-sucedida
- **WHEN** um usuário autenticado no login local envia a senha atual correta, uma nova senha válida e a confirmação idêntica
- **THEN** o sistema atualiza o hash da senha, responde com sucesso e o usuário passa a autenticar com a nova senha

#### Scenario: Senha atual incorreta
- **WHEN** o usuário envia a senha atual incorreta
- **THEN** o sistema responde 401 com mensagem genérica e não altera a senha

#### Scenario: Confirmação divergente
- **WHEN** a nova senha e a confirmação não coincidem
- **THEN** o sistema responde 400 e não altera a senha

#### Scenario: Nova senha igual à atual
- **WHEN** a nova senha informada é idêntica à senha atual
- **THEN** o sistema rejeita a troca com erro de validação e não altera a senha

#### Scenario: Alvo derivado da sessão
- **WHEN** a requisição manipula identificadores para tentar alterar a senha de outro usuário
- **THEN** o sistema ignora o identificador externo e aplica a alteração somente ao usuário autenticado

#### Scenario: Provedor da instalação é integrado
- **WHEN** o provedor configurado é Microsoft ou Google e uma requisição tenta trocar a senha
- **THEN** o sistema recusa a operação informando que a autenticação por senha não se aplica a esta instalação

---

### Requirement: Política de senha para a nova senha
O sistema SHALL validar a nova senha no servidor e SHALL exigir no mínimo 8 caracteres, com pelo menos uma letra maiúscula, um dígito numérico e um caractere símbolo. A validação SHALL ocorrer antes da gravação do hash.

#### Scenario: Nova senha dentro da política
- **WHEN** a nova senha tem no mínimo 8 caracteres e contém maiúscula, número e símbolo
- **THEN** o sistema aceita a senha e prossegue com a troca

#### Scenario: Nova senha fora da política
- **WHEN** a nova senha não atende a um ou mais critérios de comprimento ou composição
- **THEN** o sistema responde com erro de validação, indica os critérios não atendidos e não altera a senha
