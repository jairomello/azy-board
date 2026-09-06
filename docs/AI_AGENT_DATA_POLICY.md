# Politica de Dados do Azy Agent

Esta politica acompanha a persistencia inicial do Azy Agent. Ela deve ser
revisada antes de qualquer endpoint ou provider que grave mensagens, CSV ou
credenciais.

## Classificacao

- **Publico:** nomes de tools, schemas, estados e documentacao curada do Azy Board.
- **Interno:** metadados operacionais, modelo, timestamps, contagens e custo.
- **Confidencial:** mensagens, respostas, previews, argumentos e resultados de tools.
- **Secreto:** API keys, access tokens e refresh tokens. O banco recebe somente ciphertext.
- **Dado pessoal:** identificadores de usuario, email, nome, projeto e qualquer PII presente no chat, card ou CSV. Deve ser minimizado e tratado como confidencial.

Conteudo de cards, texto colado e CSV e dado nao confiavel. Ele nao pode alterar
politicas do sistema, instruir o agente a ignorar autorizacao ou ser tratado
como documentacao de confianca.

## Retencao

- Conversas e mensagens: retencao padrao de 90 dias apos `updated_at`, sujeita a configuracao posterior do tenant.
- Runs, eventos, tool calls e previews: 30 dias apos conclusao, falha, cancelamento ou expiracao.
- Auditoria operacional: 180 dias, mantendo somente ator, tenant, modelo, tool, estado, duracao, custo e resumo redigido.
- Credenciais revogadas: apagar ciphertext e metadados sensiveis em ate 24 horas apos a revogacao; preservar apenas o registro minimo de auditoria.
- Registros de idempotencia relacionados a mutacoes: no maximo 24 horas, conforme a politica existente.

Os prazos sao limites de operacao, nao promessa de armazenamento pelo provider.
Jobs de expiracao devem usar `tenant_id`, ser idempotentes e nunca apagar dados
de outro tenant.

## Exclusao e exportacao

O usuario pode solicitar a exclusao de suas conversas; a operacao deve fazer
apagamento em cascata de mensagens, runs, eventos, tool calls e aprovacoes.
O Root pode solicitar a exclusao de todos os dados do assistente do tenant,
incluindo credenciais apos revogacao. Exclusoes devem gerar somente um evento
de auditoria sem o conteudo removido. Exportacoes, quando implementadas,
devem ser autenticadas, tenant-scoped e expirar apos o download.

## Auditoria e redacao

Auditoria pode registrar nome da tool, risco, estado, hash da operacao, ator,
tenant, timestamps, modelo, tokens e custo informado pelo provider. Nunca
registrar secrets, ciphertext em logs, prompts completos, chain-of-thought,
CSV bruto, argumentos completos ou PII desnecessaria. Resumos e payloads de
eventos devem ser sanitizados antes da persistencia.

## Custo e limites

Cada run deve associar modelo e consumo informado pelo provider a um tenant e
usuario. O custo persistido e uma estimativa operacional, nao uma fatura.
Antes de habilitar o assistente, definir quotas por tenant/usuario, limite de
concorrencia, tamanho de mensagem/CSV, tokens, tempo e quantidade de steps e
tool calls. Ao atingir qualquer limite, interromper a run sem executar novas
tools e registrar somente um codigo operacional seguro.

## Minimizacao e isolamento

Todas as tabelas do assistente possuem `tenant_id`; toda leitura, escrita,
retomada, exclusao e job de retencao deve filtrar esse campo. Conversas tambem
sao vinculadas ao usuario e projeto opcional. O provider recebe somente o
contexto minimo necessario, e credenciais nunca sao enviadas ao browser.

As migrations criam configuracao desabilitada para tenants existentes, nao
criam credenciais ativas e nao criam conversas. A disponibilidade somente pode
ser considerada ativa depois de toggle, provider e validacao bem-sucedidos.
