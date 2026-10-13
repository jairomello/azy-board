# Proposal

## Why

Três ajustes de leiaute na página `/account`, todos na mesma área:

1. A seção **Senha** está hoje entre "Visibilidade do projeto" e "Chaves de API", longe dos dados de identidade (nome, e-mail e foto). Quem vai trocar a senha procura por ela junto dos dados da conta.
2. O controle **"Baixar skill (.zip)"** está empilhado abaixo de "Copiar instrução para o agente", mas o requisito **já vigente** em `api-key-management` ("Download da skill oficial na seção de API Keys") exige que ele fique **ao lado** do controle de copiar. A UI atual não cumpre o spec — é correção de conformidade, não comportamento novo.
3. No bloco de identidade, **"Alterar foto" e "Remover foto" não fecham a base com "Salvar nome"**: o container do campo de nome (`flex gap-2`) usa `align-items: stretch`, então o botão "Salvar nome" estica até a altura do input, enquanto os botões de foto ficam com a altura natural do conteúdo. Resultado: topo alinhado (via `mt-5`) e bases desencontradas.

## What Changes

- Mover a seção de senha para **imediatamente após o bloco de identidade** (Perfil), antes de Aparência: ordem final Perfil → Senha → Aparência → Visibilidade do projeto → Chaves de API.
- Colocar o controle de download da skill **na mesma linha** do controle de copiar instrução (linha com quebra no mobile), cumprindo o requisito vigente.
- Igualar a altura dos três controles do bloco de identidade (**input de nome, "Salvar nome", "Alterar foto", "Remover foto"**) com uma altura explícita compartilhada, para que topo e base coincidam independentemente de haver ícone no conteúdo.
- Cobrir a ordem das seções com contrato estrutural e a adjacência dos dois controles do guia com teste de componente; o alinhamento de altura é verificado **medindo os retângulos na tela** (o happy-dom não calcula layout).

Sem **BREAKING**: nenhuma seção é removida ou muda de significado; não há texto novo, rota ou contrato de API alterado.

## Capabilities

### New Capabilities
<!-- Nenhuma capability nova: são ajustes de posição/alinhamento em capacidades existentes. -->

### Modified Capabilities
- `account-settings`: novo requisito de posição da seção de senha na página de conta (imediatamente após o bloco de identidade).
- `api-key-management`: **sem alteração de spec** — o requisito de download da skill já exige o controle ao lado do copiar instrução.
- O alinhamento de altura dos controles de identidade não gera requisito novo (polimento visual do bloco já especificado em `account-settings`/`api-key-management`); fica coberto por verificação na tela.

## Impact

- `apps/web/src/pages/AccountPage.tsx` (posição da seção de senha).
- `apps/web/src/components/McpConnectionGuide.tsx` (linha com copiar instrução + baixar skill).
- `apps/web/src/components/ProfileNameField.tsx` e `apps/web/src/components/ProfilePhotoSection.tsx` (altura compartilhada dos controles).
- Testes: contrato estrutural da ordem das seções da conta, caso de adjacência no teste do guia e medição de retângulos na tela para o alinhamento.
- Sem i18n novo, sem backend, sem migração e sem mudança de `DEPLOY.md`.
