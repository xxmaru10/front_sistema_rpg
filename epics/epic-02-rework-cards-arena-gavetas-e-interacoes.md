---
title: "Epico 02 - Rework de Cards da Arena: gavetas e interacoes"
description: "Organizar o rework progressivo dos cards da Arena, com foco em novo paradigma de gavetas laterais, visual glass e interacao orientada por handles externos."
tags: [ui, arena, combat, cards, rework, frontend]
repo: frontend
related:
  - /knowledge/architecture.md
  - /knowledge/conventions.md
status: planejado
last_updated: 2026-04-10
---

# Epico 02 - Rework de Cards da Arena

## Objetivo
Conduzir uma reestruturacao gradual da UX dos cards da Arena, migrando do modelo atual (compacto lateral + expansao fora da gaveta) para um modelo de gavetas inteligentes com cards internos, visual vidro e navegacao mais previsivel por lado.

## Contexto necessario para trabalhar neste epico
Antes de iniciar qualquer Story deste epico, carregar:
- `/knowledge/architecture.md`
- `/knowledge/conventions.md`
- `/stories/story-34-arena-avatares-circulares-laterais-e-expansao-dos-cards.md`
- `/stories/story-37-menu-lateral-em-d20-colapsado-com-expansao-vertical-tipo-alca.md`

## Frentes do epico
1. Reestruturacao da gaveta lateral de herois/aliados com ancoragem extrema e glass style.
2. Reestruturacao simetrica da gaveta de inimigos/ameacas.
3. Mudanca de paradigma de expansao: cards abertos dentro da gaveta (nao fora).
4. Padronizacao dos handles externos (setas/controles) sem poluicao do conteudo interno.
5. Ajustes de responsividade, scroll e convivencia com menu global em d20.

## Historias
| ID | Titulo | Status |
|---|---|---|
| story-38 | Arena: gaveta vidro transparente na extrema esquerda com expansao interna dos cards | planejada |

## Criterios de conclusao do epico
- [ ] Fluxo de abertura/recolhimento das gavetas padronizado para ambos os lados da Arena.
- [ ] Cards da Arena funcionando dentro das gavetas sem regressao funcional.
- [ ] Compatibilidade desktop/mobile validada sem clipping, sem perda de clique e sem sobreposicao critica.
- [ ] Nenhuma alteracao de dominio/Event Sourcing introduzida para sustentar o rework visual.
- [ ] Documentacao de arquitetura atualizada ao final de cada Story concluida.
