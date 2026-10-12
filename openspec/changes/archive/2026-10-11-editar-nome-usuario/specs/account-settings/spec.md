## ADDED Requirements

### Requirement: Edição do nome de exibição na página de conta
A página `/account` SHALL permitir que o usuário autenticado edite seu próprio nome de exibição, mantendo o e-mail (login) imutável e somente leitura. O nome SHALL ser validado com remoção de espaços nas extremidades e tamanho entre 1 e 200 caracteres; nomes não SHALL ser únicos. A atualização SHALL ser escopada ao usuário autenticado e ao tenant ativo, e os textos novos SHALL existir nos três idiomas (pt-BR, en, es) no namespace `settings`.

#### Scenario: Salvar um novo nome válido
- **WHEN** o usuário altera o nome no campo de exibição e confirma
- **THEN** o sistema persiste o novo nome e o reflete imediatamente no perfil, no avatar por iniciais e demais exibições do usuário, sem exigir novo login

#### Scenario: Rejeitar nome vazio ou acima do limite
- **WHEN** o usuário confirma um nome vazio, apenas espaços ou com mais de 200 caracteres
- **THEN** o sistema rejeita a operação com mensagem de validação e não altera o nome atual

#### Scenario: E-mail permanece imutável
- **WHEN** o usuário abre a página de conta
- **THEN** o e-mail é apresentado como somente leitura e nenhuma requisição enviada pela página pode alterá-lo

#### Scenario: Tentativa de alterar o nome de outro usuário
- **WHEN** uma requisição tenta atualizar o nome de um usuário diferente do autenticado
- **THEN** o sistema ignora o alvo informado, aplica a alteração apenas ao usuário autenticado no tenant ativo e responde sem expor dados de outro usuário

#### Scenario: Falha ao persistir o nome
- **WHEN** a atualização remota do nome falha
- **THEN** o sistema mantém a aplicação utilizável, preserva o valor anterior e comunica a falha com nova tentativa possível

#### Scenario: Campo acessível por teclado
- **WHEN** o usuário navega por teclado pela seção de perfil
- **THEN** consegue focar o campo de nome, editar e acionar o salvamento, recebendo retorno de estado de foco e de sucesso ou erro
