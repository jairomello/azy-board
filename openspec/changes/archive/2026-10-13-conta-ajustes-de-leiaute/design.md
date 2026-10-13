# Design

## Context

- `apps/web/src/pages/AccountPage.tsx` monta, nesta ordem: `ProfilePhotoSection` (identidade: avatar, nome, foto), seção Aparência (inline), seção Visibilidade do projeto (`ShowHiddenProjectsSwitch`) e `PasswordSection`, depois o card de Chaves de API.
- `PasswordSection` é um card autossuficiente (comentário `change account-password-change`), visível apenas com provedor `LOCAL`; com provedor integrado mostra uma indicação de que a senha é gerenciada fora.
- `McpConnectionGuide.tsx`: o botão "Copiar instrução para o agente" e o link "Baixar skill (.zip)" são irmãos, cada um com `mt-2` e `display:flex` — por isso empilham em largura cheia. O requisito vigente de `api-key-management` pede o download **ao lado** do copiar instrução.
- `ProfileNameField.tsx`: `<div className="flex gap-2">` com o input (`px-3 py-2 text-sm`) e o botão "Salvar nome" (`px-3 py-2 text-xs font-semibold`). Como o container não define `align-items`, o padrão `stretch` faz o botão assumir a altura do input.
- `ProfilePhotoSection.tsx`: a linha dos botões de foto usa `mt-5` (altura do rótulo "Nome de exibição") para alinhar o **topo** com o input; os botões de foto têm altura de conteúdo (ícone `w-3.5` + `text-xs`), diferente da altura esticada do "Salvar nome" — daí a base desencontrada.
- O happy-dom **não calcula layout**, então alinhamento só é verificável medindo `getBoundingClientRect()` em navegador real (o repo já usa contrato estrutural com marcador para o que não é observável no ambiente de teste).

## Goals / Non-Goals

**Goals:**
- Senha junto dos dados de identidade, na posição definida pelo delta de `account-settings`.
- Download da skill ao lado do copiar instrução, cumprindo o requisito vigente.
- Controles do bloco de identidade com a mesma altura, fechando topo e base.

**Non-Goals:**
- Não redesenhar o bloco de identidade (não unificar cards, não mudar a ordem interna de nome/e-mail/foto).
- Não alterar textos, i18n, contratos de API ou o comportamento do download.
- Não transformar o alinhamento em requisito de spec: é polimento do bloco já especificado.

## Decisions

### D1. Mover a seção, não duplicar o card de identidade
`<PasswordSection />` passa a ser renderizado logo após `<ProfilePhotoSection />`, mantendo o card próprio e o comentário que explica a origem da seção. Alternativa: embutir o formulário de senha dentro do card de identidade — rejeitada por misturar duas responsabilidades (foto/nome × credencial) e por exigir reposicionar campos internos.

### D2. Linha única para os dois controles do guia
"Copiar instrução para o agente" e "Baixar skill (.zip)" ficam dentro de uma linha `flex flex-wrap items-center gap-2 mt-2`, com `mt-2` removido de cada controle. Mantém a largura natural dos dois (mesmo padrão da linha da URL, que já usa `flex items-center gap-2`) e quebra a linha no mobile em vez de estourar a largura. Alternativa: largura 50%/50% sem quebra — rejeitada por espremer os rótulos em telas estreitas.

### D3. Altura explícita compartilhada nos controles de identidade
Input de nome, "Salvar nome", "Alterar foto" e "Remover foto" recebem a mesma altura explícita (`h-9`) em vez de depender de `stretch`/conteúdo. Como o desalinhamento vem de alturas intrínsecas diferentes (botão esticado pelo input × botão com ícone), fixar a altura é o que garante topo **e** base coincidindo. Alternativa: trocar o container para `items-start` — resolveria o esticão, mas deixaria as alturas diferentes mesmo assim (as bases continuariam desencontradas quando houver ícone).

### D4. Testes: estrutura onde o layout não é observável
Ordem das seções vira contrato estrutural com o marcador `[CONTRATO-ESTRUTURAL]` (precedente: `item-modal-layout-contract.test.ts`, `app-shell-layout-contract.test.ts`), porque ordem de JSX não é comportamento observável no ambiente sem DOM. A adjacência dos dois controles do guia é verificável no DOM (mesmo pai) e entra no teste de componente do guia. O alinhamento de altura é verificado **medindo os retângulos** na tela com navegador real.

## Risks / Trade-offs

- **`h-9` brigar com o texto** → a altura fixa acomoda `text-sm`/`text-xs` com folga (`py-2` cabe em 36px); a conferência mede topo e base dos quatro controles.
- **Contrato estrutural virar amarra frágil** → o teste afirma apenas a relação de ordem entre seções existentes, não o markup interno de cada uma.
- **Quebra da linha no mobile mudar o visual do guia** → é o comportamento desejado (empilha só quando não couber); a conferência cobre a largura ampla.
- **Seção de senha depender do provedor** → mover o componente preserva a lógica de visibilidade; o delta cobre explicitamente o caso do provedor integrado.

## Migration Plan

Sem migração de dados e sem mudança de backend. Deploy normal da imagem web. Rollback: reverter o commit; nada persiste estado novo.

## Open Questions

Nenhuma que altere specs, abordagem ou tarefas.
