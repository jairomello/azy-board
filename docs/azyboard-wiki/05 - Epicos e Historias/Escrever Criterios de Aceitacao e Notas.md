---
title: Escrever Critérios de Aceitação e Notas
type: guide
order: 3
---

# Escrever Critérios de Aceitação e Notas

Critérios de aceitação definem como verificar o resultado da história. Notas registram contexto complementar sem misturá-lo às condições de aceite.

## Critérios de aceitação

Use esta área para registrar condições objetivas, observáveis e testáveis.

Um bom critério responde:

- Qual condição precisa ser atendida?
- Qual ação ou evento inicia o comportamento?
- Qual resultado deve ser observado?
- Quais exceções são relevantes?

Exemplo:

1. O cliente pode cadastrar um novo cartão válido.
2. O cartão anterior continua ativo até a confirmação do novo.
3. Uma falha de validação não altera o cartão atual.
4. A troca confirmada é registrada no histórico.

## Notas

Use notas para informações que ajudam a execução, mas não definem aceite:

- Decisões de produto.
- Referências externas.
- Restrições conhecidas.
- Dependências.
- Dúvidas para refinamento.
- Contexto técnico ou de negócio.

## Toolbar rich text

O editor oferece controles para:

- Negrito, itálico e riscado.
- Títulos de níveis 1, 2 e 3.
- Listas com marcadores e numeradas.
- Citações.
- Código inline.
- Links.
- Tabelas.

O controle ativo recebe destaque quando o cursor está sobre um trecho formatado.

## Aplicar formatação

1. Selecione o texto ou posicione o cursor.
2. Escolha o controle desejado.
3. Continue digitando ou revise o resultado.
4. Salve a história.

Atalhos usuais, como `Ctrl+B` para negrito e `Ctrl+I` para itálico, também podem ser utilizados.

## Organizar critérios extensos

Para histórias grandes:

1. Separe cenários com títulos curtos.
2. Use listas numeradas para fluxos sequenciais.
3. Use marcadores para regras independentes.
4. Destaque termos importantes em negrito.
5. Coloque exemplos técnicos em código inline.

## O que evitar

- Critérios subjetivos como “deve ficar bom”.
- Misturar tarefas de implementação com resultados esperados.
- Repetir a narrativa sem acrescentar verificações.
- Registrar decisões importantes somente em links externos.
- Usar notas como substituto de critérios obrigatórios.

## Regras e comportamentos

- Os campos são opcionais.
- Conteúdo vazio não gera marcação residual.
- A formatação é preservada ao reabrir a história.
- Cancelar a janela descarta alterações ainda não salvas.
- Links não são abertos durante a edição, evitando navegação acidental.

## Permissões

`Admin` e `Membro` podem alterar critérios e notas. `Visualizador` pode consultar o conteúdo formatado.

## Funcionalidades relacionadas

- [[05 - Epicos e Historias/Criar e Detalhar Historias|Criar e detalhar histórias]]
- [[06 - Tasks Bugs e Subtasks/Checklists|Checklists]]

<details>
<summary><strong>Como funciona tecnicamente</strong></summary>

### Editor

O editor rich text é baseado em Tiptap e mantém um documento estruturado. A toolbar executa comandos sobre a seleção ou a posição atual do cursor.

### Persistência

O conteúdo é convertido em HTML e enviado com a história. Um documento visualmente vazio é normalizado para ausência de conteúdo.

### Segurança e apresentação

O conteúdo persistido deve ser tratado como rich text controlado, com renderização consistente e proteção contra marcação não permitida antes de ser exibido fora do editor.

</details>

