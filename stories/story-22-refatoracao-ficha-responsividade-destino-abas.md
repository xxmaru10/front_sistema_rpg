---
title: "Story 22 - Refatoração da Ficha: Responsividade, Pontos de Destino e Iconografia de Abas"
description: "Tornar a ficha de personagem responsiva, integrando a Lore/Aspectos ao container principal, ampliando a largura automática e simplificando a UI de pontos de destino e abas de poder."
status: "concluído"
priority: "alta"
last_updated: 2026-04-04
tags: [ui, refactor, responsividade, ux]
---

# Story 22 - Refatoração da Ficha de Personagem

## Contexto
A ficha de personagem atual possui elementos que "vazam" lateralmente (Lore/Aspectos) em certas resoluções e utiliza termos e ícones (emojis) que poluem a interface visual premium. Além disso, a largura da ficha é restritiva em telas maiores.

## Objetivos
1.  **Responsividade e Layout**: Conter o overflow da coluna de Lore/Aspectos via `minmax(0, 1fr)` no grid `.top-layout-grid` e `min-width: 0` em `.info-tower-column`. O `max-width` do container já estava em 2500px desde a story-21 — a largura não era o problema.
2.  **Seção de Destino**:
    *   Renomear "RESERVA DESTINO" para "PONTOS DE DESTINO".
    *   Reduzir o tamanho visual deste componente para economizar espaço vertical.
3.  **Modernização das Abas (PowerTabs)**:
    *   Remover os emojis das abas de Façanhas, Inventário e Magias.
    *   Remover os rótulos de texto ("FAÇANHAS", "INVENTÁRIO", "MAGIAS").
    *   Utilizar apenas ícones (Lucide-React) de forma elegante para identificar as abas.
    *   Substituir ícones manuais por símbolos consistentes (ex: `Zap` para Façanhas, `Briefcase` para Inventário, `Wand2` para Magias).

## Arquivos Afetados
| Arquivo | Alteração |
|---|---|
| `src/components/CharacterCard/CharacterCard.tsx` | Ajuste na estrutura da grid e contenção da Lore. |
| `src/components/CharacterCard/CharacterVitality.tsx` | Renomear labels e reduzir escala do componente. |
| `src/components/CharacterCard/PowerTabsSection.tsx` | Refatorar cabeçalho das abas para remover texto e emojis, inserindo Lucide Icons. |
| `src/components/CharacterCard/CharacterCard.css` | Principal local de mudanças de layout (grid-template, width auto, flexbox). |
| `src/components/CharacterCard/CharacterLore.tsx` | Ajustes de padding e margens para encaixe interno. |

## Critérios de Aceitação
- [x] A seção de Lore e Aspectos não deve mais flutuar fora do quadrado dourado da ficha.
- [x] O texto "RESERVA DESTINO" foi substituído por "PONTOS DE DESTINO".
- [x] Os botões e números de Pontos de Destino estão ~20% menores que a versão anterior.
- [x] As abas de poder (Façanhas/Inventário/Magias) mostram apenas ícones Lucide (`Zap`, `Briefcase`, `Wand2`), sem texto.
- [x] Ao passar o mouse sobre os ícones das abas, um `title` (tooltip nativo) indica o nome da aba.
- [x] A paridade funcional de edição de Lore/Aspectos mantida integralmente.

## Não-Escopo
- Alteração na lógica de dados ou sincronia de eventos.
- Mudança nas cores do tema ou fontes.
- Modificação no comportamento dos dados 3D.
