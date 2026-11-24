# Design

## Contexto

O web é um SPA com chunks nomeados por hash de conteúdo (`BoardPage-<hash>.js`).
O deploy troca o diretório `/usr/share/nginx/html` inteiro; arquivos do build
anterior deixam de existir. Três consumidores podem continuar pedindo os hashes
antigos:

1. a aba aberta, cujo bundle em memória referencia os chunks antigos;
2. o `index.html` em cache heurístico do navegador ou de um proxy;
3. um chunk que falhou no meio de uma troca de container.

O nginx atual responde o fallback do SPA (`/index.html`, 200, `text/html`) para
qualquer um desses pedidos, o que viola a verificação estrita de MIME.

## Decisões

### 404 real para assets, HTML sempre revalidado

- `location /assets/ { try_files $uri =404; expires 1y; }`: asset existente ganha
  cache longo (hash muda quando o conteúdo muda); asset ausente retorna 404,
  deixando claro para o navegador que o build mudou.
- `location = /index.html { expires -1; }`: `Cache-Control: no-cache` faz o
  navegador revalidar o HTML em cada navegação, sem impedir o 304 quando nada
  mudou.
- Nenhum `add_header` é declarado nessas locations de propósito: no nginx,
  declarar `add_header` em um nível descarta os headers herdados do `server`,
  incluindo CSP e `nosniff`.

### Reload automático com trava, não retry silencioso

`React.lazy` memoriza a promise rejeitada; limpar o estado do boundary não
reimporta o chunk. A única recuperação confiável é recarregar o documento.

- A detecção reconhece as mensagens dos três motores (Chromium, Firefox, Safari)
  e o evento `vite:preloadError`.
- A trava usa `sessionStorage` com janela de 20 s **e** uma flag de módulo por
  carregamento. Sem isso, um build quebrado no servidor entraria em loop de
  reload.
- Quando a trava bloqueia, o boundary mostra a mensagem de build desatualizado e
  um botão de reload manual — nunca a tela genérica "Erro de renderização".

### Aviso de nova versão via `/version`

A rota pública já existe (`/version` e `/api/version`) e devolve
`{ version, buildDate }`. O watcher usa o cliente HTTP único (`api.get`), com
`cache: 'no-store'` para o navegador não servir uma resposta antiga.

- Checagem ao montar, a cada 5 minutos e quando a aba volta a ficar visível
  (cobre exatamente o caso "fiquei muito tempo sem atualizar").
- Versão `dev` (build local) desliga a checagem.
- A comparação é por diferença de string; não há ordenação semântica, porque
  qualquer versão diferente da embutida já significa documento desatualizado.
- O aviso é não bloqueante e pode ser dispensado; ele reaparece na próxima
  checagem que confirmar o build novo.

## Riscos

- Reload automático descarta rascunhos não salvos. O cenário só ocorre quando a
  tela já está quebrada (chunk não carrega); a alternativa é uma tela de erro
  inútil. A trava impede repetição.
- `expires 1y` sem `immutable`: navegadores ainda podem revalidar em reload
  forçado. É aceitável e evita duplicar os headers de segurança no bloco.
- Se `sessionStorage` estiver indisponível (modo restrito), a flag de módulo
  ainda limita a uma tentativa por carregamento.
