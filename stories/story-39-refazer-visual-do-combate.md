---
title: "Story 39 - Refazer visual do combate"
description: "Refatorar o componente TurnOrderTracker para usar um layout de losangos em formato de semicírculo, mostrar 5 avatares simultaneamente e integrar controles de turno e tempo."
priority: "alta"
status: "planejado"
last_updated: "2026-04-11 (planejado)"
tags: [ui, arena, combat, turn-tracker, rework]
epic: epic-02-rework-cards-arena-gavetas-e-interacoes
---

# Story 39 - Refazer visual do combate

## Contexto
O usuário solicitou um refatoramento visual focado na trilha de turnos (`TurnOrderTracker`) e nos controles associados, que hoje ficam espalhados entre a barra superior e a barra de controle (`combat-control-bar`). As mudanças têm aspecto estético centralizado e funcional para concentrar as ações em relação ao personagem do turno no meio da tela.

### Refatoração Visual (Losangos no Semicírculo)
- Os itens de avatar da trilha de turno não serão mais retangulares/quadrados. Eles devem ser **losangos de pontas arredondadas**.
- Devem ter um tamanho menor e ficar posicionados mais próximos ao header no topo.
- Apresentação em formato de **semicírculo** posicional interativo exibindo **5 simultâneos**:
  - 1 item principal maior, ao centro (o personagem do turno ativo).
  - 2 itens menores orbitando à imediatamente à direita/esquerda (+1/-1 posições do centro).
  - 2 itens ainda menores nas extremas direita/esquerda (+2/-2 posições do centro).
- Adicionar uma **linha visual interligando** os centros/bases geométricos desses losangos num fluxo visual contínuo.

### Integração de HUD
- **Indicador Central Superior**: Imediatamente acima do losango principal devem ser posicionados o Número da Rodada atual e o relógio de tempo (`TurnTimer`).
- **Controles de Turno (Abaixo do Card)**: Ações diretas de navegação de turnos descem para a base inferior do losango ativo.
  - Para o **Mestre (GM)**: Exibir 2 pequenas setas (voltar turno e avançar turno).
  - Para o **Jogador (PLAYER)**: Exibir uma única seta (passar o turno), visível dependendo de seu momento ativo de ação.

## Arquivos Afetados
| Arquivo | Visão Geral da Mudança |
|---|---|
| `src/components/TurnOrderTracker.tsx` | - Mudança do estilo raiz para renderizar `.portrait-tall` transformado em losango (`rotate(45deg)` com border-radius).<br>- Implementação de lógica posicional para as 5 slots simultâneos no semicírculo.<br>- Renderização de controles visuais embaixo do centro associado ao controle de turno.<br>- Exibição do Temporizador e da Rodada sobre o card principal. |
| `src/components/session/CombatTab.tsx` | - Passar novas propeties ao `TurnOrderTracker` (como `handleNextTurn`, `handlePreviousTurn`, `state.currentRound`, e estado do Timer) para viabilizar as localizações na HUD. <br>- Remover a antiga `TurnTimer Area` e `combat-control-bar` (dependendo do que sobrar), delegando a responsabilidade de setas e rounds para a vizinhança do Tracker. |
| Possivelmente `session.css` ou `TurnOrderTracker.tsx (style jsx)`| Adicionar regras CSS para z-index, transform grid e a linha pseudo-element (`::before`/`::after` ou SVG) que passa por trás dos losangos em 5 posições. |

## Critérios de Aceitação
1. A trilha de avatares é exibida como 5 losangos arredondados dispostos em arco formatado em semicírculo centralizado ao topo da Arena.
2. O losango central é maior e possui destaque do personagem do turno vigente.
3. Os demais 4 avatares perdem zoom radial nas extremidades (-2 e +2 sendo mais distantes e menores).
4. Uma linha contínua passa por trás dos cinco avatares visíveis, ligando-os.
5. O componente de Tempo (Timer) e Rodada estão posicionados acima do losango principal aberto.
6. Direto abaixo do avatar central ficam os controles do turno.
7. O GM vê ambas setas na barra inferior para Avançar ou Voltar Turno.
8. O Jogador vê apenas uma seta para "Passar Turno" nos momentos adequados da sua atividade da Reação.
9. Nenhuma funcionalidade de rolagem, efeitos da UI (Dano, escudos) no card ativo ou regras de domínios devem ser perdidas.

## Próximo Passo
Aguardar aprovação explícita do desenvolvedor (human) para aceitar os termos do manifesto e seguir à implementação dos losangos no grid posicional.
