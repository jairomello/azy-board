# Spec Delta

## ADDED Requirements

### Requirement: Seção de senha na página de conta
A página `/account` SHALL apresentar uma seção **Senha** para o usuário alterar a própria senha, com campos de senha atual, nova senha e confirmação, e uma ação de salvar. A seção SHALL ficar visível apenas quando o provedor de autenticação da instalação for local e SHALL exibir, quando o provedor for integrado, uma indicação de que a senha é gerenciada por esse provedor, sem campos de troca.

#### Scenario: Observar a seção com login local
- **WHEN** o usuário autenticado abre `/account` em uma instalação com provedor local
- **THEN** a página mostra a seção Senha com os campos senha atual, nova senha, confirmação e a ação de salvar

#### Scenario: Seção oculta com provedor integrado
- **WHEN** o usuário autenticado abre `/account` em uma instalação com provedor Microsoft ou Google
- **THEN** a página não exibe campos de troca de senha e informa que a senha é gerenciada pelo provedor integrado

#### Scenario: Troca de senha pela página de conta
- **WHEN** o usuário preenche senha atual, nova senha e confirmação válidas e aciona salvar
- **THEN** o sistema envia a troca ao servidor, exibe confirmação de sucesso e limpa os campos do formulário

#### Scenario: Erro exibido no formulário
- **WHEN** o servidor rejeita a troca por senha atual incorreta, política de senha ou confirmação divergente
- **THEN** a página exibe a mensagem de erro correspondente e mantém os campos editáveis

#### Scenario: Estado de envio
- **WHEN** a troca de senha está em andamento
- **THEN** a ação de salvar fica indisponível durante o envio, impedindo envios duplicados
