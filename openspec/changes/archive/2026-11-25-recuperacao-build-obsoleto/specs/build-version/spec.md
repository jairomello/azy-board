## ADDED Requirements

### Requirement: Detecção de build publicado mais novo

O web SHALL comparar a versão embutida no bundle com a versão publicada pela API
pública de versão ao carregar, em intervalo periódico e sempre que a aba voltar a
ficar visível. Quando a versão publicada for diferente da versão embutida, a
interface SHALL sinalizar que há uma versão nova disponível. A checagem SHALL ser
desligada no build de desenvolvimento (`dev`) e SHALL NOT depender de sessão.

#### Scenario: Build novo publicado com a aba aberta

- **WHEN** a aba foi carregada com a versão `2026.11.24.1` e a API pública passa a responder `2026.11.24.2`
- **THEN** a próxima checagem sinaliza versão nova disponível e oferece a ação de recarregar

#### Scenario: Aba volta ao foco depois de muito tempo

- **WHEN** a aba está oculta há horas e volta a ficar visível
- **THEN** o web consulta a versão publicada imediatamente, sem esperar o próximo intervalo

#### Scenario: Versão igual

- **WHEN** a versão publicada é igual à embutida no bundle
- **THEN** nenhum aviso de versão nova é exibido

#### Scenario: Build de desenvolvimento

- **WHEN** o bundle roda com a versão `dev`
- **THEN** nenhuma checagem de versão é feita e nenhum aviso aparece

#### Scenario: Falha de rede na checagem

- **WHEN** a consulta de versão falha por rede ou por resposta que não é JSON
- **THEN** o erro é ignorado e a próxima checagem volta a tentar, sem aviso nem tela de erro

### Requirement: Recuperação de aba aberta em build substituído

Quando o carregamento de um chunk sob demanda falhar por build substituído, o web
SHALL recarregar o documento uma única vez, reconhecendo as mensagens dos
principais motores e o evento de falha de pré-carregamento. Para impedir laço de
recarga, o web SHALL registrar a tentativa em `sessionStorage` com janela de
recuperação e SHALL limitar a uma tentativa por carregamento quando o storage não
estiver disponível. Se a recarga não puder ser feita naquele momento, a interface
SHALL explicar que a versão publicada mudou e oferecer recarga manual, em vez de
exibir apenas o erro genérico de renderização.

#### Scenario: Chunk antigo não existe mais

- **WHEN** o carregamento de `BoardPage-<hash-antigo>.js` falha com "Failed to fetch dynamically imported module"
- **THEN** a página é recarregada uma vez para buscar o build atual

#### Scenario: Falha de pré-carregamento do Vite

- **WHEN** o navegador emite `vite:preloadError`
- **THEN** o evento é tratado e a página tenta a recarga única

#### Scenario: Falha persiste na segunda carga

- **WHEN** o erro de chunk acontece novamente dentro da janela de recuperação
- **THEN** nenhuma nova recarga automática ocorre e a tela mostra a mensagem de build desatualizado com a ação "Recarregar página"

#### Scenario: Erro de renderização comum

- **WHEN** o erro capturado não é falha de carregamento de chunk
- **THEN** o comportamento existente de retry é mantido, sem reload automático

#### Scenario: Storage indisponível

- **WHEN** `sessionStorage` lança erro de segurança
- **THEN** a recarga ainda é limitada a uma tentativa por carregamento
