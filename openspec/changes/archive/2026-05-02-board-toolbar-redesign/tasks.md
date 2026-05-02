## 1. Componente Tooltip

- [x] 1.1 Criar `apps/web/src/components/ui/Tooltip.tsx` — componente `<Tooltip label="...">` que envolve qualquer elemento e exibe um tooltip posicionado abaixo com delay de 500ms via `group-hover` do Tailwind e `transition-opacity delay-500`
- [x] 1.2 Exportar o componente via barrel ou uso direto nos arquivos consumidores

## 2. Toggles de visualização — converter para ícone com tooltip

- [x] 2.1 Em `BoardFilters.tsx`, substituir o botão de texto "Mostrar subtasks" por ícone `Layers` do lucide-react envolvido em `<Tooltip label="Mostrar subtasks">`, aplicando classes de estado ativo/inativo
- [x] 2.2 Substituir o botão de texto "Histórias no board" por ícone `LayoutList` envolvido em `<Tooltip label="Histórias no board">`
- [x] 2.3 Substituir o botão de texto "Ocultar épicos vazios" por ícone `EyeOff`/`Eye` (toggle) envolvido em `<Tooltip label="Ocultar épicos vazios">`

## 3. Ações de expansão — converter para ícone com tooltip

- [x] 3.1 Substituir o botão "Expandir tudo" por ícone `ChevronsDown` envolvido em `<Tooltip label="Expandir tudo">`
- [x] 3.2 Substituir o botão "Recolher tudo" por ícone `ChevronsUp` envolvido em `<Tooltip label="Recolher tudo">`

## 4. Ação "Arquivados" — remover label, manter ícone

- [x] 4.1 No botão "Arquivados" em `BoardPage.tsx`, remover o texto "Arquivados" mantendo apenas o ícone `Archive` existente, envolvendo em `<Tooltip label="Itens arquivados">`

## 5. Separadores e reorganização de zonas

- [x] 5.1 Em `BoardFilters.tsx` e `BoardPage.tsx`, adicionar separadores `<div className="w-px h-5 bg-border mx-1 flex-shrink-0" />` entre as três zonas: Visualização | Filtros | Ações de conteúdo
- [x] 5.2 Reordenar os elementos da toolbar conforme o layout proposto: [toggles de view + expand/collapse] | [Squad▼ Módulo▼ Responsável▼ pills de tipo] | [ocultar épicos + arquivados]

## 6. Botões de criação — labels compactas

- [x] 6.1 Em `BoardPage.tsx`, encurtar labels dos botões de criação: `Novo Épico` → `+ Épico`, `Nova História` → `+ História`, `Nova Task` → `+ Task`, `Novo Bug` → `+ Bug`
- [x] 6.2 Verificar que o padding/sizing dos botões ainda fica adequado com a label mais curta

## 7. Verificação visual e TypeScript

- [x] 7.1 Confirmar zero erros de TypeScript (`tsc --noEmit`)
- [ ] 7.2 Verificar no browser que todos os tooltips aparecem corretamente
- [ ] 7.3 Verificar que todos os toggles mantêm estado ativo/inativo correto com o novo estilo
- [ ] 7.4 Verificar que a toolbar não quebra linha em tela 1280px (resolução mínima esperada)
