# Protótipos do modo escuro

## Contexto e intenção

O usuário considera o modo claro atual satisfatório, mas percebeu que a tela do board no modo escuro mistura regiões pretas e cinzas com outras azuladas, produzindo uma aparência pouco coesa. Pediu uma proposta visual mais harmônica, interessante e diferenciada, que preserve o modo claro e permita escolher diferentes tonalidades para o modo escuro: preto/cinza, roxo, azulado, esverdeado, marrom e outras.

A primeira entrega apresentou duas sugestões em SVG: [Grafite](01-grafite.svg), em preto e cinza, e [Ameixa](02-ameixa.svg), em roxo e grafite. Após considerar o resultado bom, o usuário pediu mais profundidade visual, semelhante ao papel das sombras no modo claro: foram acrescentados degradês, reflexos e brilhos suaves. Em seguida, pediu um leve brilho no contorno dos cards, incorporado às duas propostas. A intenção é dar acabamento e separação às superfícies sem deixar a tela carregada ou comprometer a leitura.

Depois, o usuário solicitou analisar o DOM e o CSS atuais e criar dois protótipos HTML, um por tonalidade, para avaliar se o visual pode ser aplicado com poucas mudanças na estrutura existente. Cada protótipo deveria permitir alternar entre o claro atual e a proposta escura. **A implementação no sistema real ficou para uma etapa posterior, condicionada à aprovação dos protótipos HTML pelo usuário.** A aprovação das primeiras imagens não deve ser interpretada como autorização para considerar os HTMLs já aprovados ou a implementação concluída.

## Como avaliar

Abra [grafite.html](grafite.html) ou [ameixa.html](ameixa.html) no navegador. O botão no cabeçalho alterna entre a proposta escura e o modo claro, usando a classe `dark` no elemento raiz. A seleção é local à página, não persiste nem modifica as preferências do aplicativo. Os dados, navegação e demais controles são demonstrativos.

O claro do protótipo usa os tokens e as regras originais do board, com o preset padrão petróleo para o shell. O aplicativo possui outros presets claros; o mockup não demonstra todos eles. As imagens SVG são a referência da direção visual; os HTMLs adaptam essa direção à estrutura atual do board e são o material para avaliar a viabilidade e a aparência antes da implementação.

## Relação com o código atual

O CSS base incorporado aos HTMLs foi compilado a partir de `apps/web/src/styles/globals.css` e da configuração Tailwind do projeto. As classes e a hierarquia do board foram reproduzidas a partir de:

- `apps/web/src/features/board/BoardScreen.tsx`: workspace e canvas;
- `apps/web/src/features/board/components/BoardLanes.tsx`: seção de fluxo;
- `apps/web/src/features/board/components/BoardColumns.tsx`: colunas e áreas de cards;
- `apps/web/src/components/BoardContext.tsx`: resumo de progresso;
- `apps/web/src/components/KanbanCard.tsx`: estrutura dos cards.

Os dados, ícones e a estrutura do shell são uma representação estática, não uma renderização dos componentes React. Há CSS adicional para dispor o mockup. `prototipo.css` contém essas regras de disposição e as sobrescritas da proposta, restritas a `.dark`. As variáveis existentes `--board-*` e `--shell-*` permitem adaptar boa parte da paleta; regras sobre classes como `.board-canvas`, `.board-column`, `.board-context-header` e `.kanban-card` acrescentam degradês, reflexos e brilho ao contorno.

O protótipo sugere que a direção visual é possível aproveitando a estrutura existente, mas **não comprova paridade completa nem que somente mudanças de CSS bastem**. Algumas cores de progresso e status são definidas separadamente dos tokens do board; é necessário revisá-las de forma coerente com cada tema, preservando seu significado. O exemplo não é uma especificação definitiva de todas as telas e estados.

## Pontos para a implementação futura

Após a aprovação do usuário, o agente responsável deve examinar o estado atual do código e definir a integração apropriada. Em particular:

- Preservar o modo claro e seus presets existentes; as mudanças visuais propostas devem atuar no modo escuro.
- Permitir escolher tonalidades escuras, incluindo pelo menos Grafite e Ameixa. As demais cores citadas pelo usuário fazem parte da intenção de temas configuráveis, mas ainda não possuem protótipos detalhados nesta pasta.
- Integrar a escolha à aparência e à persistência reais do produto, respeitando a forma como as preferências já funcionam; a alternância demonstrativa não faz isso.
- Aplicar os efeitos com contenção e manter legibilidade, contraste e distinção entre superfícies; verificar hover, foco, seleção, arraste e estados de status.
- Conferir também densidades, responsividade, navegação, outras partes do shell e componentes além dos mostrados aqui. Não presumir que o CSS compilado do protótipo deva ser copiado diretamente para a aplicação.
- Comparar o resultado com os dois HTMLs e os SVGs e realizar as verificações exigidas pelo repositório.

## Verificação realizada na criação

Os dois HTMLs foram abertos no navegador e a alternância de escuro para claro foi testada em cada um. O `bun run check` chegou à verificação de limite da API, mas essa etapa falhou porque uma porta estava ocupada; o restante da sequência não foi concluído. O `bun run test:smoke` não iniciou por falta das credenciais obrigatórias no ambiente. Esses resultados registram a situação na criação do protótipo e não substituem as verificações de uma implementação futura.

Para gerar novamente o CSS base após alterações no projeto, a partir de `apps/web`, e substituir o conteúdo do primeiro `<style>` dos dois HTMLs:

```sh
./node_modules/.bin/tailwindcss -i src/styles/globals.css -c tailwind.config.ts -o /tmp/azyboard-base-atual.css --minify
```

A cópia incorporada teve declarações duplicadas geradas removidas para não causar erros de lint nos HTMLs; ao regenerá-la, confira o lint e preserve o comportamento necessário.
