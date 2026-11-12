---
title: Exportar Itens
type: guide
order: 9
---

# Exportar Itens

A exportação gera um arquivo com os cards do projeto em **CSV** ou **XLSX**. Ela respeita os filtros ativos do board: o arquivo contém a mesma população que está sendo exibida.

## Como exportar

1. Abra o Board do projeto.
2. Acione **Exportar dados** na barra de comandos.
3. Escolha o modo **Bruto** ou **Dinâmico**.
4. Escolha o formato **CSV** ou **XLSX**.
5. Selecione **Exportar** e aguarde o download.

O arquivo recebe o nome do projeto e a data. Itens arquivados ficam fora do resultado por padrão.

## Modo bruto

Exporta todas as colunas técnicas do card com os nomes originais da ferramenta, sem transformação. É o modo indicado para conferência e migração.

## Modo dinâmico

Permite montar as colunas do arquivo:

- Arraste um campo da origem para a lista de destino.
- Defina o nome da coluna no arquivo.
- Opcionalmente, defina o tipo de destino (texto, número, data ou booleano); valores incompatíveis são tratados como vazios.
- Remova ou desvincule campos antes de exportar.

Cada nome de destino deve ser único. A exportação exige ao menos um campo mapeado e recusa campos de origem desconhecidos.

## Mapeamentos salvos

Um mapeamento guarda a seleção, os nomes e os tipos das colunas para reutilização.

1. Monte o mapeamento no modo **Dinâmico**.
2. Informe um nome e selecione **Salvar**.
3. Nas próximas exportações, selecione o mapeamento na lista para carregá-lo.

O nome do mapeamento é único dentro do projeto. Membros e administradores podem criar, alterar e excluir mapeamentos; visualizadores podem consultar e usar os mapeamentos existentes. Os mapeamentos ficam isolados por projeto.

## Permissões e escopo

A listagem de mapeamentos e a exportação exigem acesso de leitura ao projeto. A criação, alteração e exclusão de mapeamentos exigem papel de membro ou superior. Os arquivos são gerados no servidor e entregues apenas para a sessão autenticada.

## Limitações

- A exportação é gerada de forma síncrona; volumes muito grandes podem demorar.
- O arquivo não inclui fórmulas, gráficos nem múltiplas abas.
- A exportação não altera nenhum dado do projeto.
