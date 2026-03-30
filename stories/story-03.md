---
title: Story 03 — Aprimoramentos do Battlemap e Modo Teatro
description: Implementar customização de grade (cor/espessura) e um modo teatro imersivo para o Battlemap.
tags: [ui, battlemap, theater-mode, frontend]
epic: epic-02-battlemap-v2
repo: frontend
status: done
last_updated: 2026-03-30
---

# Story 03 — Aprimoramentos do Battlemap e Modo Teatro

## Objetivo
Melhorar a experiência visual do Battlemap permitindo que o mestre ajuste a estética da grade e oferecendo um "Modo Teatro" que oculte a interface do sistema para foco total no mapa.

## Contexto mínimo necessário
Carregue estes arquivos antes de começar:
- `src/types/domain.ts`: Estado do Battlemap.
- `src/lib/projections.ts`: Reducers de estado.
- `src/components/Battlemap.tsx`: Renderização do mapa e grade.
- `src/lib/battlemapToolStore.ts`: Estado local do modo teatro.
- `src/app/session/[id]/page.tsx`: UI da sessão e botões flutuantes.

## Arquivos modificados
- `src/types/domain.ts`: Adicionadas propriedades `gridColor` e `gridThickness`.
- `src/lib/projections.ts`: Inicialização de novos campos no estado do battlemap.
- `src/components/Battlemap.tsx`: Renderização dinâmica da grade baseada no estado.
- `src/lib/battlemapToolStore.ts`: Lógica de ativação do modo teatro.
- `src/components/header/BattlemapToolbar.tsx`: Controles para cor, espessura e modo teatro.
- `src/app/session/[id]/page.tsx`: Botão flutuante de modo teatro e ocultação de HUD.
- `src/components/HeaderWrapper.tsx`: Classes CSS para ocultar cabeçalho em modo teatro.

## Critérios de aceitação
- [x] Customização de espessura da grade funcional e persistente.
- [x] Customização de cor da grade (HEX/RGBA) funcional e persistente.
- [x] Modo Teatro disponível para mestre e players no canto inferior direito.
- [x] Modo Teatro oculta todos os elementos da HUD (chat, nav, header).
- [x] Ocultar Battlemap (X) restaura o banner original da sessão e desativa modo teatro.
- [x] Posição do botão de teatro não conflita com o botão de streaming/espectador.

## Restrições — o que NÃO fazer
- Não use bibliotecas externas para o seletor de cores no momento (mantenha `prompt()` por simplicidade).
- Não remova o `BattlemapToolbar` durante o modo teatro (o mestre ainda precisa das ferramentas).

## Definição de pronto
Concluído conforme critérios de aceitação. Próximos passos podem envolver um seletor de cores UI-based ou suporte a objetos interativos no mapa.
