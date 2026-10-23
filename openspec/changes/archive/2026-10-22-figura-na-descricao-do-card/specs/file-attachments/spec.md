# Spec Delta

## ADDED Requirements

### Requirement: Figura citada na descrição do card
A figura inserida na descrição SHALL ser o próprio anexo do card, exibida como imagem em bloco na largura da coluna de texto, com altura limitada e proporção preservada, e SHALL abrir o lightbox das imagens do card quando acionada. Formato de imagem não exibível inline SHALL NOT ser renderizado como imagem e SHALL aparecer como cartão de arquivo.

#### Scenario: Figura e anexo são o mesmo arquivo
- **WHEN** uma figura é inserida na descrição
- **THEN** o mesmo arquivo consta na aba Anexos do card, sem cópia adicional

#### Scenario: Apresentação constrangida
- **WHEN** a figura é exibida na descrição
- **THEN** ela respeita a largura da coluna com altura limitada e proporção preservada, sem empurrar as demais regiões da descrição

#### Scenario: Clique abre o lightbox do card
- **WHEN** o usuário aciona a figura na descrição
- **THEN** o lightbox abre na imagem correspondente, com navegação entre as imagens do card

#### Scenario: Formato não exibível inline
- **WHEN** o anexo citado é SVG, PDF ou outro formato sem exibição inline aprovada
- **THEN** a descrição mostra um cartão de arquivo no lugar da imagem, sem executar o conteúdo na origem

#### Scenario: Acesso respeita a autorização do anexo
- **WHEN** a descrição é lida por usuário sem acesso ao anexo citado
- **THEN** a figura cai no estado de imagem indisponível e nenhum arquivo é servido fora da autorização do card

### Requirement: Anexo excluído citado na descrição
O sistema SHALL avisar, na exclusão de um anexo, que ele está citado na descrição do card, e SHALL exibir um estado de imagem removida naquele ponto do texto, em vez de imagem quebrada ou Markdown cru. A exclusão SHALL prosseguir após o aviso, e o estado SHALL permanecer identificável ao reabrir a descrição.

#### Scenario: Excluir anexo citado
- **WHEN** o usuário exclui um anexo que está citado na descrição
- **THEN** ele é avisado de que o anexo está citado, a exclusão ocorre e o texto passa a mostrar o estado de imagem removida

#### Scenario: Excluir anexo não citado
- **WHEN** o usuário exclui um anexo que não é citado na descrição
- **THEN** nenhum aviso de citação é exibido

#### Scenario: Reabrir a descrição com imagem removida
- **WHEN** a descrição com imagem removida é reaberta
- **THEN** o estado permanece visível e o restante do texto continua íntegro e editável
