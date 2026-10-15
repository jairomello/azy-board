# Spec Delta

## ADDED Requirements

### Requirement: Escopo da ajuda definido e verificado

O projeto SHALL definir em um único ponto quais documentos da wiki são expostos na central de ajuda e ao Azy Agent — os módulos e páginas incluídos e as exclusões (documentos internos de controle e de padronização editorial, arquivos de configuração do cofre de markdown e seções técnicas recolhíveis) — e SHALL manter uma verificação automatizada que falhe quando o conteúdo servido divergir dessa definição.

#### Scenario: Escopo definido em um ponto único

- **WHEN** um autor precisa saber o que é exposto na ajuda
- **THEN** encontra a definição em um único lugar, junto do papel da wiki no índice de documentação

#### Scenario: Documento interno exposto reprova

- **WHEN** um documento das pastas internas passa a integrar o conteúdo servido na ajuda
- **THEN** a verificação automatizada falha indicando o documento

#### Scenario: Seção técnica exposta reprova

- **WHEN** a seção técnica recolhível de um guia passa a integrar o conteúdo servido
- **THEN** a verificação automatizada falha indicando a página

#### Scenario: Papel da wiki e escopo da ajuda no índice de documentação

- **WHEN** um autor consulta o índice de documentação do projeto
- **THEN** encontra o papel da wiki como fonte de uso do produto e a indicação de que ela alimenta a central de ajuda e o Azy Agent
