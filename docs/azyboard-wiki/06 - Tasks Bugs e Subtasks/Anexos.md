---
title: Anexos
type: guide
order: 7
---

# Anexos

Anexos mantêm arquivos relevantes junto ao item de trabalho. Eles podem representar evidências, documentos, imagens, exemplos de entrada ou materiais de apoio.

## Onde encontrar

A seção **Anexos** fica na janela de detalhes do item e apresenta os arquivos já vinculados, a ação de upload e os controles de visualização ou remoção.

## Adicionar um arquivo

1. Abra o item.
2. Localize **Anexos**.
3. Selecione a ação de upload.
4. Escolha um arquivo do dispositivo.
5. Aguarde a conclusão.
6. Confirme o arquivo na lista.

Vários arquivos podem ser adicionados ao mesmo item, um após o outro.

## Informações apresentadas

Cada anexo mostra:

- Nome original.
- Tipo ou ícone correspondente.
- Tamanho.
- Data de inclusão.
- Ação para abrir ou baixar.
- Ação de exclusão, quando permitida.

## Limite de tamanho

O limite padrão é 10 MB por arquivo. A organização pode configurar outro valor.

Quando o arquivo ultrapassa o limite, o upload é rejeitado sem criar um anexo incompleto.

## Tipos de arquivo

O Azy Board aceita arquivos de diferentes formatos. A forma de abertura depende do tipo:

- Imagens podem ser visualizadas diretamente.
- Outros formatos oferecem abertura ou download.

## Visualizar imagens

1. Selecione uma imagem anexada.
2. A imagem abre em lightbox.
3. Use as setas para navegar entre imagens do mesmo item.
4. Pressione `Escape` ou clique fora para fechar.

## Baixar um arquivo

Selecione o nome ou a ação de download. O acesso utiliza sua sessão atual; compartilhar somente a URL não concede acesso a terceiros.

## Excluir um anexo

1. Localize o arquivo.
2. Selecione a ação de exclusão.
3. Confirme quando solicitado.

O arquivo é removido da lista, do armazenamento e dos metadados do item.

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
- [[04 - Board e Visualizacoes/Arquivar Restaurar e Excluir Itens|Arquivar, restaurar e excluir itens]]

<details>
<summary><strong>Como funciona tecnicamente</strong></summary>

### Upload

O frontend envia `multipart/form-data`. A API valida item, projeto, tenant, papel e tamanho, entrega o conteúdo ao adaptador de storage e persiste os metadados.

### Storage

A camada de armazenamento abstrai filesystem local e provedores de objeto, como S3. O domínio trabalha com uma referência de storage sem depender do fornecedor.

### Acesso

Listagem e download exigem autenticação. O caminho servido inclui tenant e item, e a API impede acesso a arquivos fora do contexto permitido.

</details>

