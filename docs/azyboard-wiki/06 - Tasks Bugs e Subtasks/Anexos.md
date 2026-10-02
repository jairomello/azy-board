---
title: Anexos
type: guide
order: 7
---

# Anexos

Anexos mantêm arquivos relevantes junto ao item de trabalho. Eles podem representar evidências, documentos, imagens, exemplos de entrada ou materiais de apoio.

## Situação atual

A funcionalidade de anexos é **configurável por organização (tenant)**. O administrador define, na aba de Anexos das configurações do projeto, se os anexos ficam habilitados e qual estratégia de armazenamento será usada. A janela de detalhes do item ganhou a aba **Anexos**, com envio, listagem, download, remoção e pré-visualização de imagens. A configuração também continua disponível pela **API REST** e pelo catálogo de ferramentas MCP (consulta).

## Habilitar e configurar anexos

Na seção **Arquivos anexados** das configurações, o administrador escolhe:

- **Permitir anexos** — liga ou desliga a funcionalidade por tenant. Desligada, a aba some da janela do item e a API bloqueia novos envios e remoções; anexos já existentes continuam podendo ser listados e baixados.
- **Armazenamento** — `Pasta local (simples)` para instalações simples, ou `Object storage S3-compatível` (o formato genérico aceita S3, MinIO e serviços equivalentes). Para o object storage, informe endpoint (opcional), região, bucket, prefixo e credenciais. A credencial secreta é guardada cifrada no backend e nunca é devolvida ao navegador.

A configuração pode ser alterada a qualquer momento. Novos envios passam a usar o armazenamento escolhido, mas **nada é migrado ou apagado automaticamente**: mover arquivos entre estratégias e reapontar vínculos antigos é uma operação externa ao produto.

## Enviar um arquivo pela API

```text
POST /api/projects/{projectId}/items/{itemId}/attachments
Content-Type: multipart/form-data
```

- O campo do arquivo é enviado como `multipart/form-data`.
- A API valida item, projeto, tenant, papel e tamanho antes de persistir.
- O limite padrão é 10 MB por arquivo e pode ser configurado pela organização.
- Só tipos previamente aprovados são aceitos (imagens raster, PDF, texto/Markdown/CSV/JSON, documentos Office, arquivos compactados e mídias de áudio/vídeo), e o **conteúdo real** é verificado — informar um tipo MIME diferente do conteúdo é rejeitado.
- Arquivos acima do limite ou com tipo/conteúdo inválido são rejeitados sem criar um anexo incompleto.

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

A interface `StorageAdapter` abstrai filesystem local e provedores S3-compatíveis. Cada anexo guarda o provedor que o criou e uma referência de storage opaca; o domínio não depende do fornecedor nem de caminhos do cliente. No modo local, o diretório fica fora de qualquer raiz pública e fora de arquivos estáticos. Trocar de provedor não migra nem reaponta objetos existentes.

### Configuração e segredos

A configuração do tenant (`tenant_attachment_settings`) guarda habilitado, provedor, endpoint, região, bucket, prefixo e access key. A secret key é cifrada com a chave mestra do ambiente (`ASSISTANT_ENCRYPTION_KEY`) e nunca retorna nas respostas nem aparece em logs. Sem essa chave, salvar credenciais remotas falha com erro acionável.

### Acesso e renderização

Listagem, download e remoção exigem autenticação e membership no projeto; a consulta é isolada por tenant, projeto e item. Downloads passam por rota autorizada — não por URLs públicas. Apenas imagens raster aprovadas são renderizadas inline (lightbox); SVG e demais tipos ativos são entregues como `attachment`, com `X-Content-Type-Options: nosniff`. Remoções limpam o objeto físico de forma idempotente após o commit (outbox de limpeza).

</details>
