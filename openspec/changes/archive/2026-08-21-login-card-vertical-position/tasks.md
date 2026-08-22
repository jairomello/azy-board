## 1. Ajuste do Layout

- [x] 1.1 Atualizar o wrapper da `LoginPage` para centralizar o card verticalmente com padding responsivo, sem forçar altura integral no card.
- [x] 1.2 Remover classes de altura mínima ou altura integral do grid que façam o card ocupar toda a viewport.
- [x] 1.3 Garantir que os dois painéis compartilhem a altura natural do conteúdo e que o painel do formulário mantenha `flex items-center justify-center`.
- [x] 1.4 Manter a estrutura de fundo absoluto existente sem aplicar imagem ou alterar a autenticação.

## 2. Responsividade E Validação

- [x] 2.1 Garantir margens horizontais e ausência de corte do formulário em mobile e tablet.
- [x] 2.2 Permitir rolagem vertical quando a altura da viewport for menor que o card.
- [x] 2.3 Executar `bun run typecheck` e `bun run build:web`.
- [x] 2.4 Verificar visualmente o posicionamento em desktop, tablet, mobile e viewport desktop baixa usando o servidor local.
