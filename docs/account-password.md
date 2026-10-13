# Troca de senha da conta

A página **Minha conta** (`/account`) oferece uma seção **Senha** para o usuário
alterar a própria senha de acesso. A seção pede a senha atual, a nova senha e a
confirmação; a troca só é aplicada depois que o servidor confirma a senha atual.

## Quando aparece

A seção só fica disponível quando a instalação autentica por **usuário e senha
do próprio Azy Board** (`AZYBOARD_AUTH_PROVIDER=LOCAL`, o padrão).

Quando a instalação usa um provedor integrado (**Microsoft** ou **Google**), a
página de conta não exibe os campos de troca: a senha é gerenciada pelo provedor
e a seção apenas informa isso. O servidor também recusa a operação nesse cenário,
mesmo que a requisição seja feita fora da interface.

## Política de senha

A nova senha precisa ter:

- no mínimo 8 caracteres;
- ao menos uma letra maiúscula;
- ao menos um número;
- ao menos um símbolo.

A nova senha também precisa ser diferente da atual. As regras são validadas no
servidor; a interface apenas repete a dica para orientar o usuário.

## Endpoint

`PATCH /api/users/me/password` (sessão autenticada), com o corpo:

```json
{
  "currentPassword": "senha atual",
  "newPassword": "nova senha",
  "confirmPassword": "confirmação"
}
```

Respostas:

- `200 { "ok": true }` — senha alterada;
- `401` — senha atual incorreta (a senha não é alterada);
- `400` — confirmação divergente, senha fora da política ou igual à atual;
- `403` — instalação com provedor integrado (`PASSWORD_CHANGE_DISABLED`).

O alvo da alteração é sempre o usuário da sessão (nenhum identificador de usuário
é aceito no corpo) e a nova senha é armazenada apenas como hash bcrypt. As sessões
já ativas permanecem válidas após a troca.
