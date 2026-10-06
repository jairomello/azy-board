# attachment-content-reading Specification

## Purpose
TBD - created by archiving change ler-anexos-propor-trabalho. Update Purpose after archive.
## Requirements
### Requirement: Leitura autorizada de conteúdo de anexo

O sistema SHALL permitir ao agente ler o conteúdo de um anexo existente por `projectId`, `itemId` e `attachmentId`, reutilizando a mesma autorização do acesso a arquivos: membership no projeto (papel mínimo `VIEWER`), ancoragem do anexo ao item solicitado e isolamento por tenant, projeto e item. A leitura SHALL resolver o objeto pelo `StorageAdapter` do provider registrado no anexo, NUNCA por URL/caminho informado pelo cliente, e NÃO SHALL expor caminho físico nem credenciais de armazenamento. A leitura SHALL permanecer disponível quando os anexos estiverem desabilitados no tenant, sem permitir upload, edição ou remoção.

#### Scenario: Leitura de anexo por membro autorizado

- **WHEN** membro autorizado solicita a leitura de conteúdo de um anexo vinculado ao card informado
- **THEN** o sistema resolve o anexo por tenant/projeto/item, lê o objeto pelo provider registrado e devolve o conteúdo extraído com os metadados do arquivo, sem revelar caminho físico

#### Scenario: Leitura de anexo por não-membro

- **WHEN** usuário sem membership no projeto tenta ler o conteúdo de um anexo
- **THEN** o sistema retorna 403 ou 404 sem revelar metadados nem conteúdo do arquivo

#### Scenario: Acesso cruzado entre tenants ou projetos

- **WHEN** usuário autenticado tenta ler um anexo pertencente a outro tenant ou a um projeto não acessível
- **THEN** o sistema não lê o objeto e retorna 403 ou 404 sem revelar a existência do anexo

#### Scenario: Leitura preservada com anexos desabilitados

- **WHEN** o administrador desabilitou anexos no tenant e um usuário autorizado solicita a leitura de conteúdo de um anexo existente
- **THEN** o sistema devolve o conteúdo extraído e continua bloqueando upload, edição e remoção

### Requirement: Extração de texto por formato suportado

O sistema SHALL extrair texto dos formatos textuais aceitos no upload — pelo menos `text/plain`, `text/markdown`, `text/csv` e `application/json` — decodificando em UTF-8 com tratamento de BOM. Para formatos que o upload aceita mas o sistema não interpreta (PDF, Office, imagens, áudio, vídeo e binários compactados), o resultado SHALL declarar `format: unsupported` e o motivo, SEM inventar texto nem afirmar leitura. A extração SHALL ser on-the-fly e determinística para o mesmo arquivo e configuração.

#### Scenario: Extração de anexo textual

- **WHEN** um usuário autorizado lê um anexo `text/plain`, `text/markdown`, `text/csv` ou `application/json`
- **THEN** a resposta contém o texto decodificado, o formato identificado e o encoding usado

#### Scenario: Formato aceito no upload mas não interpretável

- **WHEN** um usuário autorizado lê um anexo PDF, Office, imagem, áudio, vídeo ou compactado
- **THEN** a resposta declara `format: unsupported` e o motivo, sem texto e sem afirmar que o arquivo foi interpretado

#### Scenario: Arquivo textual ilegível não é mascarado

- **WHEN** os bytes do anexo textual não podem ser decodificados como texto no encoding esperado
- **THEN** o sistema retorna um resultado explícito de falha de decodificação, sem devolver conteúdo corrompido como se fosse válido

### Requirement: Limites de leitura e indicação de trechos não interpretados

O sistema SHALL impor um teto de bytes lidos do armazenamento antes da decodificação e um teto de caracteres devolvidos por chamada, ambos declarados, e NÃO SHALL truncar conteúdo em silêncio. O resultado SHALL informar sempre o tamanho total, o tamanho lido, a contagem de caracteres e `truncated`/`reason`; quando o conteúdo exceder o teto de caracteres, SHALL incluir `nextOffset` para permitir a leitura segmentada em vez da perda de trechos. O teto de caracteres SHALL ser compatível com o limite de saída de ferramenta do harness, de modo que o resultado não seja cortado por um limite genérico.

#### Scenario: Conteúdo dentro do limite

- **WHEN** o anexo lido é menor que os tetos de bytes e de caracteres
- **THEN** a resposta traz o texto completo com `truncated: false` e `reason: none`

#### Scenario: Conteúdo acima do teto de caracteres

- **WHEN** o texto extraído excede o teto de caracteres por chamada
- **THEN** a resposta traz o trecho lido, `truncated: true`, `reason: char_limit` e `nextOffset` para continuar a leitura

#### Scenario: Arquivo acima do teto de bytes

- **WHEN** o anexo excede o teto de bytes lidos do armazenamento
- **THEN** o sistema lê apenas até o teto, interrompe o stream e informa `truncated: true` com o motivo, sem carregar o arquivo inteiro em memória

### Requirement: Conteúdo do anexo como dado não confiável

O sistema SHALL tratar o texto extraído do anexo como dado não confiável: entregá-lo ao modelo delimitado e rotulado como conteúdo de documento, sem permitir que instruções contidas no arquivo sejam interpretadas como comandos, selecionem ferramentas ou alterem argumentos. O conteúdo lido NÃO SHALL, por si só, conceder capabilities, contornar permissões ou dispensar a aprovação humana de mutações.

#### Scenario: Instrução embutida no documento

- **WHEN** o conteúdo de um anexo contém texto que tenta comandar o agente (por exemplo, pedindo executar ou excluir algo)
- **THEN** o harness trata o trecho como dado de documento, não o executa como instrução e mantém as permissões e a aprovação inalteradas

#### Scenario: Delimitação do conteúdo no transcript

- **WHEN** o resultado de leitura de anexo entra no transcript do agente
- **THEN** o texto aparece delimitado e rotulado como conteúdo do arquivo, com sequências que colidam com o delimitador neutralizadas

#### Scenario: Leitura não amplia privilégios

- **WHEN** um usuário autorizado apenas a ler obtém o conteúdo de um anexo
- **THEN** a leitura não habilita nenhuma operação de escrita acima do papel dele

