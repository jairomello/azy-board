---
title: Anexos
type: guide
order: 7
---

# Anexos

Anexos mantêm arquivos relevantes junto ao item de trabalho. Eles podem representar evidências, documentos, imagens, exemplos de entrada ou materiais de apoio.

## Situação atual

A camada de anexos está disponível pela **API REST** e pelo catálogo de ferramentas MCP (consulta), e ainda **não possui interface própria** na janela de detalhes do item. Integrações e agentes podem anexar e consultar arquivos; a visualização dentro do Board será oferecida em uma versão futura.

## Enviar um arquivo pela API

```text
POST /api/projects/{projectId}/items/{itemId}/attachments
Content-Type: multipart/form-data
```

- O campo do arquivo é enviado como `multipart/form-data`.
- A API valida item, projeto, tenant, papel e tamanho antes de persistir.
- O limite padrão é 10 MB por arquivo e pode ser configurado pela organização.
- Arquivos acima do limite são rejeitados sem criar um anexo incompleto.

## Consultar os anexos

```text
GET /api/projects/{projectId}/items/{itemId}/attachments
```

Cada anexo apresenta nome original, tipo MIME, tamanho e data de inclusão. Pelo MCP, a ferramenta `list_attachments` retorna a lista de anexos de um item.

## Baixar um arquivo

O download exige autenticação válida: compartilhar somente a URL não concede acesso a terceiros. O tenant e o item são verificados antes de servir o conteúdo.

## Excluir um anexo

A exclusão remove o registro e o objeto do armazenamento. O arquivo é removido da lista e dos metadados do item.

> [!warning] Remoção do arquivo
> Excluir um anexo não arquiva o arquivo. Para preservar uma evidência, mantenha o anexo ou registre-o em outro repositório autorizado antes da exclusão.

## Segurança

- Somente participantes do projeto podem consultar arquivos.
- O tenant e o item são verificados antes de listar ou servir anexos.
- O endereço do arquivo não substitui autenticação.
- Nomes internos de armazenamento não são usados como autorização.

## Regras e comportamentos

- O arquivo precisa estar associado a um item existente.
- O tamanho máximo é verificado antes do armazenamento definitivo.
- O nome original é preservado para apresentação.
- Excluir o item remove seus anexos.
- Arquivar o item preserva os anexos para restauração.

## Permissões

`Admin` e `Membro` podem adicionar e excluir anexos. `Visualizador` pode consultar e baixar arquivos de projetos aos quais possui acesso.

## Funcionalidades relacionadas

- [[06 - Tasks Bugs e Subtasks/Criar e Editar Tasks e Bugs|Criar e editar tasks e bugs]]
- [[09 - Agentes e Integracoes/Integrar pela API REST e Autenticar Agentes|Integrar pela API REST e autenticar agentes]]
- [[04 - Board e Visualizacoes/Arquivar Restaurar e Excluir Itens|Arquivar, restaurar e excluir itens]]

<details>
<summary><strong>Como funciona tecnicamente</strong></summary>

### Upload

O cliente envia `multipart/form-data`. A API valida item, projeto, tenant, papel e tamanho, entrega o conteúdo ao adaptador de storage e persiste os metadados.

### Storage

A camada de armazenamento abstrai filesystem local e provedores de objeto, como S3. O domínio trabalha com uma referência de storage sem depender do fornecedor.

### Acesso

Listagem e download exigem autenticação. O caminho servido inclui tenant e item, e a API impede acesso a arquivos fora do contexto permitido.

</details>
