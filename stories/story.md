---
title: "Story ativa - Story 38 (Arena: gaveta vidro transparente na extrema esquerda com expansao interna dos cards)"
story_ref: "story-38-arena-gaveta-vidro-transparente-na-extrema-esquerda-com-expansao-interna-dos-cards.md"
epic: "epic-02-rework-cards-arena-gavetas-e-interacoes"
status: "em-andamento"
last_updated: "2026-04-11 (follow-up-4.3-contencao-vertical-cards)"
---

## Progresso Atual
- Story e Epic continuam abertos por orientacao do usuario.
- Gavetas da arena seguem em rework com cards internos e barra de rolagem integrada no topo.
- Cards secundarios seguem em modo colapsado (faixa), com escala horizontal/vertical progressiva em piramide invertida.
- Correcao aplicada na coluna de retrato dos inimigos para hover/fixacao, com destino reposicionado na base da imagem.
- Trilhas de estresse migradas para PNGs tematicos com tint por tema, e densidade vertical dos cards reduzida para aproximar da altura util.
- Ajustes mobile: trilhas de estresse podem empilhar para mostrar todas as caixas, impulso reduzido e cards expandidos com botao `-` para minimizar.
- Primeiro card de cada gaveta agora inicia fixado, mas pode ser desfixado/minimizado como os demais.
- Ajuste widescreen aplicado para levar os blocos de cards de volta as laterais com margem de seguranca (evitando sobreposicao com menu lateral).
- Setas externas de recolha reposicionadas acima do primeiro nome (aliados no lado direito da gaveta; inimigos no extremo esquerdo).
- Cards minimizados de inimigos voltaram a ancorar na direita da tela (piramide invertida fechando para a esquerda, conforme regra visual do lado adversario).
- Gaveta aberta agora participa do layout da coluna (largura 100% do lado) em vez de flutuar apenas por `position: absolute`, reduzindo colisao entre lados em telas largas.
- Contencao vertical aplicada nos cards expandidos: coluna de retrato voltou a preencher toda a lateral do card e o texto de conceito do miolo passou a usar elipse em linha unica (sem quebra letra-a-letra), reduzindo crescimento vertical anomalo em aliados e inimigos.

## Proximo Passo
1. Validar com o usuario, em widescreen real, se a colisao lateral entre aliados/inimigos foi eliminada.
2. Confirmar se a altura visual do card inimigo ficou consistente com a dos jogadores.
3. Ajustar fino de offset das setas somente se ainda houver desalinhamento de pixels.

## Handoff Prompt
```text
Continue a Story 38 (epic-02) no frontend.

Estado atual:
- Gavetas e cards da arena passaram por multiplos ajustes de layout.
- Barra de rolagem integrada permanece ativa no topo.
- Cards secundarios ficam colapsados e expandem por hover/click.
- Botao de minimizar (`-`) foi adicionado para cards secundarios expandidos.
- Story e epic NAO devem ser encerrados sem comando explicito do usuario.

Objetivo imediato:
- Fazer apenas refinamento de posicionamento (impulsos e seta externa) sem regressao funcional.
- Validar comportamento responsivo com gavetas de herois e inimigos.

Arquivos obrigatorios para carregar:
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

Commit de referencia mais recente:
- c625873 (3.3_adjust)
```
