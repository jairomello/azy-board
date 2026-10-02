## Context

O Azy Board já possui anexos por item, incluindo metadados e operações autenticadas, mas o recurso pode ser desabilitado por tenant e atende arquivos enviados ao sistema. Links externos são referências independentes, não exigem armazenamento de objetos e precisam estar sempre disponíveis. O card T11 solicita nome, descrição e endereço, acesso simples pela área de links do item e abertura em nova guia.

## Goals / Non-Goals

**Goals:**
- Persistir vários links externos associados a um item, isolados por tenant e projeto.
- Disponibilizar operações para criar, listar, editar e excluir links com validação e autorização coerentes com os itens.
- Apresentar links em uma área própria do modal/detalhe do item, com controles de edição para quem pode escrever.
- Abrir endereços em nova guia sem permitir que a página externa manipule a janela do Azy Board.

**Non-Goals:**
- Buscar automaticamente metadados ou prévias do endereço, favicon ou conteúdo externo.
- Restringir a funcionalidade com a configuração de anexos.
- Fazer requisições do servidor ao URL cadastrado (preview, unfurl ou validação de disponibilidade).
- Adicionar links a entidades que não sejam itens do board.

## Decisions

- **Entidade própria de links:** criar tabela de links com identificador, tenant, projeto, item, nome, URL, descrição e timestamps. Isso mantém a relação simples e permite CRUD sem acoplar links à tabela de anexos.
- **Isolamento e autorização no servidor:** toda consulta e mutação filtra por tenant, item e projeto e verifica membership/RBAC, seguindo as rotas de itens e anexos. A UI não é fronteira de segurança.
- **CRUD sob o escopo do item:** expor rotas aninhadas ao item para listar/criar e identificar o link nas operações de edição/remoção. Contratos compartilhados permanecem tipados; validar tamanho e formato da URL no servidor.
- **URL externa sem fetch:** aceitar endereços HTTP/HTTPS válidos e não fazer requisição server-side. A interface renderiza o nome como link com `target="_blank"` e `rel="noopener noreferrer"`.
- **Área sempre visível no detalhe do item:** mostrar seção/aba de links independente da configuração de anexos; usuários sem permissão de escrita podem consultar e abrir links, mas não alterá-los.
- **Descrição em Markdown canônico:** reutilizar o padrão de rich text existente para permitir descrição formatada e manter consistência com outros metadados do item.
- **Área de links carregada sob demanda no web:** `ItemLinksArea` entra via `lazy`/`Suspense` no modal do item, seguindo o padrão de `RichTextEditor` e `DashboardVisuals`, para não inflar o chunk do Board (já acima do orçamento antes desta mudança).

Alternativas consideradas: guardar links como texto/JSON dentro do item (prejudica validação, edição individual e consultas); reutilizar a entidade de anexos (semântica e ciclo de vida incompatíveis); gerar preview buscando URLs no servidor (fora do escopo e cria dependência de serviços externos).

## Risks / Trade-offs

- [Links maliciosos ou esquemas executáveis] → aceitar apenas `http:` e `https:` e renderizar por link externo escapado, com `noopener noreferrer`.
- [Acesso indevido a dados de outro tenant/projeto] → consultas tenant-scoped, associação explícita item/projeto e testes negativos de autorização/IDOR.
- [Diferenças de migração SQLite/PostgreSQL] → seguir o padrão atual de migrações Drizzle e validar ambos os perfis suportados.
- [Excesso de links ou textos] → definir limites explícitos para nome, URL e descrição nos contratos e na API.

## Migration Plan

Adicionar migração aditiva para a tabela de links, sem alterar ou converter dados existentes. Implantar API e contratos antes/na mesma versão que a interface. Rollback consiste em reverter a versão e a migração conforme o procedimento do projeto; como a tabela é nova, remover a tabela só após confirmar que nenhum código da versão implantada a utiliza.

## Open Questions

Nenhuma pendência. Decisões confirmadas durante a implementação:

- Limites: `name` até 200 caracteres, `url` até 2048 e `description` até 20000 (Markdown), alinhados aos limites já praticados por itens e anexos; `url` aceita somente `http:`/`https:` sem credenciais embutidas.
- Ordenação da listagem por `createdAt` ascendente com desempate por `id` (ordem estável de criação).
- Exclusão de item/projeto remove os links na mesma transação (delete explícito nos dois adapters, além do `ON DELETE CASCADE` das FKs).

Board ref: cb1b516c-d2ed-4bab-9a29-8278611ec62d
