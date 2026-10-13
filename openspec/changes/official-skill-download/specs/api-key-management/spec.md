# Spec Delta

## ADDED Requirements

### Requirement: Download da skill oficial na seção de API Keys
A seção de API Keys SHALL oferecer, ao lado do controle de copiar a instrução para o agente, um controle que baixa a skill oficial do Azy Board como um arquivo `.zip`. O download SHALL entregar a versão da skill que acompanha a instalação e NUNCA SHALL conter o valor de nenhuma API Key.

#### Scenario: Controle de download exibido
- **WHEN** o usuário acessa a seção de API Keys
- **THEN** existe um controle de download da skill oficial, ao lado do controle de copiar a instrução para o agente

#### Scenario: Download acionado
- **WHEN** o usuário aciona o controle de download
- **THEN** o navegador baixa um arquivo `.zip` da skill oficial

#### Scenario: Download autenticado
- **WHEN** uma requisição de download chega sem sessão válida
- **THEN** o sistema responde 401 e não entrega o arquivo

#### Scenario: Publicação sob base path
- **WHEN** a aplicação roda sob um base path (ex.: `/azyboard/`)
- **THEN** o endereço do download inclui o prefixo e o arquivo é baixado corretamente

#### Scenario: Falha no download comunicada
- **WHEN** o download falha
- **THEN** a seção comunica o erro sem travar a tela e mantém os demais controles utilizáveis

#### Scenario: Textos nos três idiomas
- **WHEN** o idioma ativo é pt-BR, en ou es
- **THEN** o rótulo e as mensagens do controle de download aparecem no idioma ativo
