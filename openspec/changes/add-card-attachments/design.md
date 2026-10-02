## Context

O card T3 pede anexos em cards com duas modalidades operacionais: filesystem simples e object storage para instalações maiores. A especificação atual `file-attachments` já prevê metadados, UI, lightbox e autorização, mas fixa storage local servido estaticamente, permite qualquer tipo de arquivo e não define configuração por tenant. O item de segurança de anexos já concluído cobre autorização básica; esta mudança deve reaproveitá-la e aprofundar a validação e o isolamento, sem duplicar aquela entrega.

O comportamento deve funcionar com os perfis SIMPLE e ADVANCED existentes. A configuração pode mudar após a instalação, mas a aplicação não migrará objetos, não regravará chaves e não apagará arquivos quando a modalidade mudar ou for desabilitada.

## Goals / Non-Goals

**Goals:**
- Controlar por tenant se novos anexos podem ser usados e qual backend recebe novos uploads.
- Disponibilizar uma abstração de storage com implementação local e implementação S3-compatible (incluindo serviços compatíveis como MinIO), sem acoplar regras de negócio ao provider.
- Guardar metadados suficientes para localizar e autorizar cada objeto de forma isolada por tenant, projeto e card.
- Oferecer fluxo completo no card: listar, enviar, baixar, remover e visualizar imagens com segurança.
- Tornar configuração, limites e comportamento verificáveis por testes e documentados para setup/operação.

**Non-Goals:**
- Migrar objetos automaticamente entre filesystem e object storage ou atualizar referências após migração externa.
- Apagar os objetos antigos ao desabilitar anexos ou trocar o provider.
- Criar edição de credenciais/provider para cada projeto; a configuração pertence ao tenant.
- Tornar buckets ou diretórios de upload publicamente acessíveis.
- Reimplementar a autorização básica por membership já entregue no item de segurança de anexos.

## Decisions

1. **Configuração tenant-scoped, independente de perfil de instalação.** Persistir enabled/provider e configuração necessária para storage na configuração do tenant. SIMPLE pode usar filesystem sem serviços externos; ADVANCED pode apontar para storage S3-compatible. A seleção não será inferida rigidamente pelo perfil, pois a escolha de storage é operacional e pode mudar sem alterar o perfil de banco/fila.
   - Alternativa considerada: fixar local em SIMPLE e S3 em ADVANCED. Rejeitada porque reduz a escolha do administrador e impede adotar storage externo sem migrar de perfil.

2. **Contrato `StorageAdapter` e chaves opacas.** Operações de persistência recebem/retornam uma chave gerada pelo servidor, nunca um caminho escolhido pelo cliente. Metadados relacionam tenant, projeto e item à chave; o provider é resolvido pela configuração vigente no upload. Downloads e remoções passam por rotas autenticadas, sem URLs públicas permanentes.
   - Alternativa considerada: URL direta pública/estática. Rejeitada por expor objetos e contornar membership e mudanças de configuração.

3. **Mudança de configuração é prospectiva.** Novos uploads usam o backend ativo no momento do upload. Registros existentes mantêm o provider/chave necessários para continuar sendo localizados; troca de provider não copia, move nem apaga objetos. Se o backend antigo deixar de estar disponível, restaurar o acesso depende de operação externa.
   - Alternativa considerada: resolver todos os anexos pelo backend ativo. Rejeitada porque quebraria imediatamente links de metadados existentes após mudança de configuração.

4. **Desabilitar oculta a UI e bloqueia mutações, preservando leitura autorizada.** A UI não exibe a área de anexos; a API bloqueia upload/remoção, mas continua autorizando listagem/download aos membros do projeto. Metadados e objetos não são removidos.
   - Alternativa considerada: bloquear também leitura. Rejeitada porque a desativação deve ocultar funcionalidades sem retirar acesso aos objetos existentes.

5. **Manter allowlist e limite atuais, validando também os bytes.** O limite inicial continua 10 MB e a allowlist mantém os MIME atualmente definidos em `routes/attachments.ts` (imagens raster PNG/JPEG/GIF/WebP/AVIF/BMP, PDF, texto/Markdown/CSV/JSON, Office, ZIP/GZIP/7z, áudio MP3/WAV/OGG e vídeo MP4/WebM). Content-Type/extensão continuam insuficientes sem validação de assinatura/conteúdo quando aplicável. HTML/SVG e executáveis permanecem proibidos.

6. **Configuração administrativa pós-instalação pela UI.** Administradores configuram provider/endpoint/bucket e ativação na UI de configurações do tenant. Segredos são criptografados no backend com chave mestra fornecida por variável de ambiente dedicada, nunca retornados em claro e nunca registrados em logs; sem chave de criptografia, salvar credenciais remotas deve falhar com erro acionável.
   - Alternativa considerada: exigir configuração exclusivamente por ambiente/CLI. Rejeitada porque a necessidade do produto é alterar a configuração por tenant depois da instalação.

7. **Remoção consistente com storage externo.** Remover metadados em transação e encaminhar a exclusão física para pós-commit idempotente, reutilizando o padrão atual de limpeza quando aplicável; falha temporária de storage não deve reverter estado confirmado no banco.

8. **Visualização segura e CSP.** Imagens aprovadas são servidas por endpoint autorizado com tipo determinado pelo servidor e política de conteúdo segura. A UI usa lightbox para formatos permitidos; formatos não inline são baixados como attachment. Nenhum caminho local fica sob diretório público.

## Risks / Trade-offs

- [Credenciais object storage persistidas podem ser expostas por vazamento ou respostas de API] → manter segredo protegido no backend, nunca retorná-lo em payloads/logs, validar permissões e documentar rotação.
- [Provider trocado enquanto existem anexos nele] → preservar referência de provider por anexo e documentar que o operador deve manter o destino antigo acessível ou realizar migração/reapontamento externamente.
- [Arquivos maliciosos ou MIME forjado] → allowlist, detecção/validação de conteúdo, respostas como attachment por padrão e renderização inline limitada a formatos seguros.
- [Filesystem efêmero em containers ou réplicas] → documentar volume persistente e limites do modo local; instalações multi-instância devem usar object storage compartilhado.
- [Exclusões entre banco e storage não são atômicas] → limpeza pós-commit idempotente com observabilidade e possibilidade de retry.
- [Desabilitação pode conflitar com expectativa de acesso a anexos antigos] → decidir explicitamente se leitura/download permanece habilitada; nunca remover objetos como efeito colateral.

## Migration Plan

1. Adicionar schema/migration append-only para configurações do tenant e metadados dos anexos (incluindo provider/key necessários para leitura consistente).
2. Inicializar configuração compatível com instalações existentes sem ativar uploads inesperadamente; definir estratégia para reconhecer o armazenamento local legado, se existir.
3. Implantar adapters e endpoints protegidos; configurar volume persistente no modo local e instruções para S3-compatible.
4. Implantar UI e habilitação por tenant após configuração; validar CSP e smoke de upload/download.
5. Rollback: desabilitar a capacidade por configuração e reverter a aplicação sem apagar banco/arquivos. Preservar dados e backups; migrações são append-only.

## Open Questions

- Como compatibilizar os anexos locais legados com o novo catálogo de metadados, se já existirem dados em produção? Manter paths locais como provider `local` no rollout inicial é a hipótese de migração sem movimentação física.
- Qual ambiente fornece a chave mestra de criptografia em deploy e setup, e como a rotação será operada sem invalidar credenciais já cifradas?
