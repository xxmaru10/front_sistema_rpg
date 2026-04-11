---
title: "Story 38 - Arena: gaveta vidro transparente na extrema esquerda com expansao interna dos cards"
description: "Reestruturar as gavetas laterais da Arena para visual glass, seta externa e fluxo de abrir todos os cards dentro da gaveta, iniciando com apenas um personagem visivel por lado no estado fechado."
priority: "alta"
status: "em-andamento"
last_updated: "2026-04-11 (follow-up-4.0-inimigos-altura-e-pin-primeiro)"
tags: [ui, arena, combat, cards, drawer, glass, rework]
epic: epic-02-rework-cards-arena-gavetas-e-interacoes
---

# Story 38 - Arena: gaveta vidro transparente na extrema esquerda com expansao interna dos cards

## Contexto
Atualmente a Arena usa gavetas laterais (`.combat-avatar-drawer`) com rail de retratos compactos e, quando um personagem e aberto, o card completo aparece fora da gaveta na pilha externa (`.combat-expanded-stack`).

A solicitacao desta Story e mudar esse fluxo para o inicio de um rework maior:
1. a gaveta lateral passa a ter visual transparente estilo vidro (alinhado ao menu lateral);
2. a gaveta esquerda fica ancorada na extrema esquerda;
3. a seta de abrir/fechar deve ser um handle externo (separado do corpo da gaveta);
4. no estado fechado, a gaveta mostra somente 1 personagem;
5. ao clicar na seta, a gaveta expande e passa a mostrar todos os personagens do lado com cards abertos dentro da propria gaveta (nao fora);
6. o mesmo comportamento deve existir para o lado de inimigos.

Pelo `knowledge/architecture.md`, a entrega e de UI/composicao. Nao ha necessidade de alterar Event Sourcing, projecoes ou contratos de dominio.

## Escopo

### Fase 1 - Visual glass + ancoragem lateral
- Aplicar estilo vidro/transparencia na gaveta lateral de personagens e inimigos, mantendo contraste e legibilidade.
- Fixar a gaveta do lado dos personagens na extrema esquerda da Arena.
- Manter o padrao visual coerente com o menu lateral global em d20.

### Fase 2 - Handle de seta externo e estado fechado com 1 personagem
- Separar visualmente o handle de seta do conteudo da gaveta (seta externa, sem "misturar" com o painel interno).
- Estado fechado deve renderizar apenas 1 personagem por lado.
- Regra de selecao no estado fechado:
1. jogador: mostrar o personagem vinculado/logado;
2. mestre: mostrar apenas 1 personagem (regra exata a validar na aprovacao desta Story);
3. inimigos: mostrar apenas 1 personagem (regra exata a validar na aprovacao desta Story).

### Fase 3 - Expansao com cards internos
- Clique na seta deve "puxar" a gaveta e renderizar todos os personagens daquele lado dentro da gaveta.
- Os cards devem abrir dentro da gaveta (substitui fluxo atual de cards abertos fora da gaveta).
- Aplicar o mesmo fluxo para:
1. lado de herois/aliados;
2. lado de inimigos/ameacas.

### Fase 4 - Comportamento e responsividade
- Preservar funcionamento em desktop e mobile sem perda de clique/scroll.
- Evitar conflito de sobreposicao entre a gaveta esquerda e o menu lateral global.
- Garantir que o estado visual da Arena continue claro com/dessem expansao.

## Arquivos Afetados
| Arquivo | Responsabilidade no escopo |
|---|---|
| `src/components/session/CombatTab.tsx` | Reorquestrar estado de gaveta fechada/aberta por lado, lista de personagens exibidos por estado e renderizacao dos cards dentro da gaveta. |
| `src/components/CombatCard/CombatCard.tsx` | Ajustar modo de exibicao para suportar renderizacao de card dentro da gaveta expandida, mantendo paridade funcional do card atual. |
| `src/components/CombatCard/CombatHeader.tsx` | Ajustar acao de recolher/retorno conforme novo fluxo de cards internos na gaveta. |
| `src/components/CombatCard/CombatCard.styles.tsx` | Aplicar refinos visuais glass nos cards/handles relacionados ao novo comportamento da gaveta. |
| `src/app/session/[id]/session.css` | Redesenhar estrutura visual da gaveta (vidro, extrema esquerda, handle externo) e layout de cards internos para ambos os lados. |
| `src/app/session/[id]/page.tsx` | Ajustes de integracao de layout, caso necessarios, para convivio entre menu lateral global e nova gaveta da Arena. |

## Criterios de Aceitacao
1. A gaveta lateral da Arena passa a usar visual transparente estilo vidro, com leitura clara de conteudo.
2. A gaveta do lado dos personagens fica posicionada na extrema esquerda.
3. A seta de abrir/fechar fica separada do corpo da gaveta, como handle externo.
4. No estado fechado, o lado dos personagens exibe apenas 1 personagem.
5. No estado fechado, o lado dos inimigos exibe apenas 1 personagem.
6. Ao clicar na seta de um lado, a gaveta daquele lado expande e passa a exibir todos os personagens daquele lado.
7. Com a gaveta expandida, os cards aparecem abertos dentro da gaveta (nao em pilha externa fora dela).
8. O fluxo acima funciona igualmente para herois/aliados e para inimigos/ameacas.
9. Abertura/recolhimento da gaveta nao quebra scroll, clique ou legibilidade da Arena em desktop.
10. Em mobile, a interacao da gaveta continua utilizavel sem sobreposicao bloqueante.
11. Nenhum evento novo de dominio e introduzido; mudanca restrita a UI.

## Fora de Escopo
- Alterar regras de combate, turnos, estresse, consequencias, destino ou impulso.
- Alterar contratos de `domain.ts`, `api-contract.md`, projecoes ou Event Store.
- Reestruturar `HazardCard` para outro fluxo fora do padrao desta Story.
- Persistir estado aberto/fechado das gavetas entre refreshes (se nao houver validacao explicita para isso).

## Dependencias e Riscos
- Regra de "qual personagem unico aparece no estado fechado" para GM e para inimigos precisa de validacao na aprovacao.
- Existe risco de conflito de layout/z-index com o menu global em d20 ao prender a gaveta na extrema esquerda.
- Existe risco de regressao de densidade visual ao mover cards abertos para dentro da gaveta; requer validacao de largura minima e scroll interno.

## Status de Execucao
- Story em andamento (epico e story permanecem abertos por orientacao do usuario).
- Fluxo base de gaveta foi implementado em iteracoes anteriores desta sessao.
- Follow-up aplicado: hotfix no `CombatCard` para interromper crescimento infinito de altura apos expansao.
- Follow-up aplicado: gaveta de inimigos alinhada para expandir a esquerda e zona de rolagem integrada convertida para faixa horizontal compacta no topo (com logs reduzidos), mantendo a logica de rolagem/eventos.
- Follow-up aplicado: logs ocultos por padrao com botao de expandir horizontal, ajustes de sobreposicao (cards nao sobre a barra de rolagem), ancoragem da gaveta esquerda sem deslocamento por menu expandido e refinamento de largura/altura visual dos cards.
- Follow-up aplicado: barra de rolagem movida para um top-strip fixo no topo da Arena (fora da coluna central), preservando controles e botao de logs sob demanda; cards e gavetas expandidas ampliados horizontalmente para o novo rework.
- Follow-up aplicado (commit `2fb403a`): refinamento da barra integrada (dropdowns compactos por icone em pericia/inventario, ataque fisico/mental no mesmo seletor de acao, desafio inline com aspectos na propria faixa, botao de rolagem concentrado no fluxo integrado, botao de rolagem dos cards oculto para GM).
- Follow-up aplicado (commit `c625873`): cards nao primarios em modo colapsado com estilo mais proximo ao card completo, expansao por hover/click, botao de minimizar (`-`) no canto superior direito dos cards expandidos secundarios, ajuste de offset dos impulsos e reposicionamento da seta externa da gaveta.
- Follow-up aplicado (iteracao 3.4): seta da gaveta de inimigos corrigida para apontar a direita e handle reposicionado para nao conflitar com a barra integrada; cards secundarios minimizados remodelados para visual de card completo (imagem/foco/vinheta + nome), com expansao por hover e fixacao/desfixacao por pin no canto superior direito; impulsos (setas e controles GM) deslocados para a direita; barra integrada recebeu botoes maiores (pericia/inventario/logs), dropdowns estilizados e botao de rolagem branco; borda/glow dourado residual da gaveta foi neutralizado para remover artefato visual solto.
- Follow-up aplicado (iteracao 3.5): cards minimizados receberam glass transparente sem tint de classe (borda no tema global), impulso foi deslocado mais para a direita, pin passou a suportar multipla fixacao simultanea (icone maior apontando esquerda/desfixado e baixo/fixado), card de inimigos ganhou botao de remocao em lixeira vermelha e o layout dos inimigos foi espelhado horizontalmente (imagem/consequencias/formato). Barra integrada de rolagem do GM teve compressao de layout para priorizar linha unica e evitar quebra excessiva (maximo 2 linhas em cenarios estreitos).
- Follow-up aplicado (iteracao 3.6): barra integrada da rolagem foi centralizada e passou a dimensionar por conteudo (reduzindo espaco ocioso); nome do personagem migrou para faixa superior externa (canto superior esquerdo), com trilhas de estresse e botao de rolagem deslocados responsivamente para a direita; coluna central do card foi reequilibrada para ocupar o espaco liberado. Drawers/cards expandidos receberam incremento adicional de largura (~15%) para reduzir clipping lateral em expansoes verticais longas. Impulso foi reajustado (aliados 20% mais a esquerda e adversarios proporcionalmente mais a direita), droplists da barra integrada receberam reforco visual de tema e o pin ganhou glow para legibilidade.
- Follow-up aplicado (iteracao 3.7): correcoes de estabilidade dos cards de inimigos em hover/pin (coluna de retrato com altura explicita + ajustes de camadas/z-index), com reposicionamento de pontos de destino para a base do retrato. Retratos da arena receberam inclinacao leve para reforco visual e cards passaram por responsividade dedicada para desktop menor e mobile (reflow interno das colunas + consequencias em faixa inferior). Em mobile, a ordem visual da arena foi invertida para exibir aliados antes de adversarios e a barra integrada de rolagem ganhou compactacao/reflow para evitar quebra em colunas.
- Follow-up aplicado (iteracao 3.8): assets PNG de estresse (`fisico.png`/`mental.png`) foram integrados ao `CombatStressTracks` com colorizacao por tema via `mask-image`. Cards expandidos tiveram reducao de altura base (fallback de retrato e paddings internos) para cortar excesso vertical sem remover expansao por conteudo. No mobile, trilhas de estresse passaram a quebrar em layout vertical quando necessario para manter todas as caixas visiveis, setas de impulso foram reduzidas em ~30% e o campo de bonus da barra integrada foi estreitado em ~50% para melhorar encaixe horizontal.
- Follow-up aplicado (iteracao 3.9): cards fechados receberam escala horizontal progressiva em piramide invertida (de 85% para baixo por nivel), com degradê preto translúcido ao longo da faixa e remocao de borda externa. A moldura de gaveta ao redor dos cards (herois/inimigos) foi removida para manter apenas cards e handles. Em mobile, cards expandidos ganharam botao `-` ao lado da seta para minimizar rapidamente. A faixa de estresse ficou mais fina verticalmente, com borda no tema e fundo preto menos opaco com blur de efeito espelhado.
- Follow-up aplicado (iteracao 4.0): cards de inimigos receberam reducao adicional da base vertical para aproximar proporcao dos cards de aliados, e o cabecalho externo no lado de ameacas passou a inverter posicoes de nome e trilhas de estresse. Piramide de minimizados foi refinada para manter mini retrato + nome ate o final da fila (sem sumir imagem), com reducao gradual da altura por nivel. A fixacao foi expandida para o primeiro card: ele inicia fixado ao abrir a gaveta, mas pode ser desfixado e minimizado como os demais. Nas trilhas de estresse, as bolhas perderam borda e ficaram em estilo vidro.

## Pendencias para Proxima Iteracao
- Validar com o usuario a proporcao final de altura dos inimigos versus aliados apos o novo baseline vertical.
- Confirmar se a inversao nome/estresse no lado de ameacas atende a leitura esperada em diferentes resolucoes.
- Ajustar fino da piramide (largura/altura minima dos ultimos strips) se precisar mais contraste do mini retrato.

## Handoff Prompt
```text
Voce esta continuando a Story 38 (epic-02) do rework da arena/gavetas/cards.

Estado atual confirmado:
- Gavetas em fluxo expandido com cards internos e top-strip de rolagem integrado.
- Cards secundarios (na gaveta aberta) ficaram colapsados em formato faixa e expandem por hover/click.
- Existe botao de minimizar (`-`) em cards secundarios expandidos.
- Ajustes recentes de posicionamento foram aplicados em impulsos e seta externa da gaveta.
- Story e Epic seguem abertos por orientacao do usuario.

Proximo passo:
1) Fazer validacao visual final em modo GM/jogador para clique dos impulsos e posicao da seta.
2) Ajustar apenas offsets/layout fino sem quebrar funcionalidades atuais.
3) Registrar o delta no story e manter escopo restrito a UI da arena/combat.

Arquivos obrigatorios para carregar antes de editar:
- /front_sistema_rpg/AI.md
- /front_sistema_rpg/knowledge/architecture.md
- /front_sistema_rpg/stories/story.md
- /front_sistema_rpg/stories/story-38-arena-gaveta-vidro-transparente-na-extrema-esquerda-com-expansao-interna-dos-cards.md
- /front_sistema_rpg/src/components/session/CombatTab.tsx
- /front_sistema_rpg/src/components/CombatCard/CombatCard.tsx
- /front_sistema_rpg/src/components/CombatCard/CombatCard.styles.tsx
- /front_sistema_rpg/src/app/session/[id]/session.css
- /front_sistema_rpg/src/components/DiceRoller.tsx
- /front_sistema_rpg/src/components/DiceRoller/RollerInputs.tsx
- /front_sistema_rpg/src/hooks/useDiceRoller.ts

Ultimo commit funcional de referencia:
- c625873 (3.3_adjust)
```
