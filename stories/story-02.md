---
title: Story 02 — Modularizar o VIControlPanel.tsx
description: Refatorar o painel GM (VI) em sub-componentes especializados (Áudio, Cenas, Jogadores).
tags: [ui, refactor, frontend, gm]
epic: epic-01-refatoracao-modular
repo: frontend
status: pending
last_updated: 2026-03-30
---

# Story 02 — Modularização do VIControlPanel

## Objetivo
O painel do mestre (VIControlPanel) está ultrapassando 500 linhas, sendo difícil de manter. É necessário extrair a lógica de áudio, seleção de cena e gerenciamento de jogadores para hooks e componentes especializados.

## Contexto mínimo necessário
Carregue estes arquivos antes de começar:
- `src/components/VIControlPanel.tsx`
- `src/lib/apiClient.ts`
- `/knowledge/architecture.md`

## Arquivos a criar ou modificar
- `src/components/VI/AudioController`: Controle de trilha sonora.
- `src/components/VI/SceneManager`: Troca de cenas e zones.
- `src/components/hooks/useVIControl`: Hooks para lógica de mestre.

## Critérios de aceitação
- [ ] Extração de áudio concluída para `AudioController`.
- [ ] Lógica de troca de cena mantida para `SceneManager`.
- [ ] Broadcast de SFX mantido funcional.

## Restrições — o que NÃO fazer
- Não simplificar as opções de áudio (restoreUrl, restaurar ao terminar).
- Não quebrar o broadcast `MUSIC_PLAYBACK_CHANGED`.

## Definição de pronto
Quando todos os critérios de aceitação estiverem marcados E os arquivos de conhecimento afetados estiverem com `last_updated` atualizado, a história está concluída.
