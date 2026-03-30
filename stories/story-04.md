---
title: Story 04 — Refinamento da Simulação de Dados 3D e UI de Interação
description: Implementar escala reduzida (50%), Câmara de Convocatória inicial e Overlay de Resultado centralizado premium.
tags: [ui, dice-roller, threejs, physics, glassmorphism]
epic: epic-01-global-dice-roller
repo: frontend
status: done
last_updated: 2026-03-30
---

# Story 04 — Refinamento da Simulação de Dados 3D e UI de Interação

## Objetivo
Tornar a experiência de rolagem de dados mais polida, menos intrusiva e visualmente premium, integrando a física 3D com uma interface de vidro (glassmorphism) e garantindo alinhamento perfeito com o HUD lateral.

## Contexto mínimo necessário
Carregue estes arquivos antes de continuar:
- `src/lib/dicePhysics.ts`: Constantes físicas (`DIE_HALF`).
- `src/hooks/useFateDiceSimulation.ts`: Lógica Three.js, Câmera e Canvas.
- `src/components/FateDice3D.tsx`: Orquestração de camadas (Background, Canvas, Overlay).
- `src/components/DiceRoller/FateResultOverlay.tsx`: UI de estados (Idle, Done) e animações CSS.

## Arquivos modificados
- `src/lib/dicePhysics.ts`: Redução de `DIE_HALF` para `0.5` (dados 50% menores).
- `src/hooks/useFateDiceSimulation.ts`: Ajuste de `IDLE_Y` para `1.0` e deslocamento de câmera (`cameraXOffset = -0.65`) para alinhamento lateral a 52.5%.
- `src/components/FateDice3D.tsx`: Adicionada `ChamberBackground` (atrás dos dados) e lógica de `opacity` para ocultar dados no resultado.
- `src/components/DiceRoller/FateResultOverlay.tsx`: Unificação da interface "Idle" e "Done" em caixas de vidro amplas (560px / 520px) posicionadas a 52.5% de `left`.

## Critérios de aceitação
- [x] Dados com tamanho 50% menor em relação à versão original.
- [x] Câmara de Convocatória (caixa inicial) unificada contendo botão Play e instruções.
- [x] Dados 3D renderizados "dentro" (à frente do vidro) da caixa inicial.
- [x] Dados 3D desaparecem suavemente quando o resultado final é exibido.
- [x] Resultado final centralizado (com leve offset de 52.5% à direita) cobrindo elementos de HUD por baixo.
- [x] Alinhamento consistente entre física 3D e UI 2D em todas as resoluções.

## Restrições — o que NÃO fazer
- Não use `zIndex` exagerados que quebrem a interatividade de outros modais, exceto quando a rolagem estiver ativa e bloqueando a arena.
- Não remova o efeito de `backdrop-filter: blur` da caixa de resultado, pois ele é essencial para a legibilidade sobre o mapa.

## Definição de pronto
Concluído conforme critérios de aceitação. A estética está premium e as camadas de profundidade estão corrigidas. Próximos passos podem envolver sons de impacto de dados ou novos temas visuais.
