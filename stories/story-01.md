---
title: Story 01 — Modularizar o CombatCard.tsx
description: Separar lógica de estresse, aspectos e estilos do componente principal do CombatCard.
tags: [ui, refactor, frontend, characters]
epic: epic-01-refatoracao-modular
repo: frontend
status: done
last_updated: 2026-03-30
---

# Story 01 — Modularização do CombatCard

## Objetivo
Refatorar o arquivo monolítico `CombatCard.tsx` que continha mais de 400 linhas para uma estrutura modular de sub-componentes.

## Contexto mínimo necessário
Carregue estes arquivos antes de começar:
- `/knowledge/architecture.md`
- `/knowledge/conventions.md`

## Arquivos a criar ou modificar
- `src/components/CombatCard/CombatCard.tsx`: Orquestração.
- `src/components/CombatCard/CombatHeader.tsx`: Cabeçalho e PVs.
- `src/components/CombatCard/CombatAspects.tsx`: Lista de aspectos.
- `src/components/CombatCard/CombatCard.styles.tsx`: Estilos.
- `src/components/hooks/useCombatCard.ts`: Hooks de estado e eventos.

## Critérios de aceitação
- [x] Extração de sub-componentes concluída (Header, Aspects, Stress).
- [x] Lógica de negócio mantida integralmente (emissões de `CHARACTER_CONSEQUENCE_UPDATED`).
- [x] Paridade visual mantida (CSS Glassmorphism).

## Restrições — o que NÃO fazer
- Não mude as cores ou fontes originais do sistema.
- Não introduza Redux ou Context extra para o que já é gerido pelo `globalEventStore`.

## Definição de pronto
Quando todos os critérios de aceitação estiverem marcados E os arquivos de conhecimento afetados estiverem com `last_updated` atualizado, a história está concluída.
