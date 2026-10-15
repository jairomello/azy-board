# Spec Delta

## MODIFIED Requirements

### Requirement: Datas e números formatados por locale

O sistema SHALL formatar datas, horas, números, percentuais e mensagens relativas de acordo com o locale do idioma selecionado pelo usuário. Componentes SHALL usar helpers de formatação compartilhados ou APIs equivalentes baseadas no locale atual, sem formatos fixos para texto de produto. Valores de data sem hora SHALL ser formatados na data civil que representam, sem deslocamento de fuso; instantes com hora SHALL ser formatados no fuso do usuário.

#### Scenario: Data formatada em PT-BR

- **WHEN** usuário com idioma PT-BR visualiza uma data
- **THEN** data é exibida no formato `DD/MM/AAAA`

#### Scenario: Data formatada em EN

- **WHEN** usuário com idioma EN visualiza a mesma data
- **THEN** data é exibida no formato `MM/DD/YYYY`

#### Scenario: Data sem hora não desloca de dia

- **WHEN** um valor de data sem hora (`YYYY-MM-DD`) é exibido em um fuso a oeste de UTC
- **THEN** a data exibida é exatamente a do valor, sem adiantar nem atrasar um dia

#### Scenario: Instante com hora usa o fuso do usuário

- **WHEN** um valor com data e hora é exibido
- **THEN** a data e a hora correspondem ao instante no fuso do usuário

#### Scenario: Números e percentuais formatados

- **WHEN** usuário alterna entre PT-BR, EN e ES e visualiza pontos, contagens ou percentuais
- **THEN** separadores e convenções numéricas correspondem ao locale selecionado

#### Scenario: Formatação atualizada após troca de idioma

- **WHEN** usuário troca o idioma enquanto uma data ou número está visível
- **THEN** valor é reformatado imediatamente sem recarregar a página
