# Spec Delta

## ADDED Requirements

### Requirement: Distribuição da skill em arquivo compactado
A instalação SHALL disponibilizar a skill oficial como um arquivo `.zip` gerado a partir da skill canônica do repositório, com a pasta raiz `azyboard/` contendo o arquivo de entrada, os comandos, as referências, os scripts e o manifest, espelhando a estrutura distribuível. O arquivo SHALL ser derivado da versão da skill que acompanha a instalação e NUNCA SHALL conter API Keys, tokens, hosts privados ou credenciais reais.

#### Scenario: Conteúdo do arquivo compactado
- **WHEN** o arquivo `.zip` da skill é aberto
- **THEN** ele contém a pasta raiz `azyboard/` com o arquivo de entrada, os comandos, as referências, os scripts e o manifest da skill

#### Scenario: Versão acompanha a instalação
- **WHEN** o arquivo `.zip` é baixado
- **THEN** seu conteúdo corresponde à versão da skill canônica empacotada na instalação, e o nome do arquivo identifica essa versão

#### Scenario: Arquivo sem segredos
- **WHEN** o arquivo `.zip` é inspecionado
- **THEN** nenhum exemplo contém chave, token, host privado ou credencial real

#### Scenario: Skill ausente na instalação
- **WHEN** o diretório da skill não é localizado pela configuração da instalação
- **THEN** o sistema responde um erro claro e acionável, sem entregar um arquivo vazio ou incompleto

#### Scenario: Recurso indisponível não quebra a instalação
- **WHEN** o download da skill está indisponível
- **THEN** o restante da aplicação continua funcional
