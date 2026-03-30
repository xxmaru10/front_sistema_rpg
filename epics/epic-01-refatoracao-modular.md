---
title: Épico 01 — Refatoração Modular de Componentes
description: Melhorar a manutenibilidade extraindo hooks e sub-componentes da UI monolítica.
tags: [ui, refactor, frontend]
repo: frontend
related:
  - /knowledge/architecture.md
  - /knowledge/conventions.md
status: em andamento
last_updated: 2026-03-30
---

# Épico 01 — Refatoração Modular

## Objetivo
O objetivo deste épico é quebrar componentes React gigantes e monolíticos (ex: `CombatCard`, `VIControlPanel`) em unidades menores, separando a lógica de negócio (Hooks) da representação visual (Componentes) e do estilo (Styles).

## Contexto necessário para trabalhar neste épico
Antes de iniciar qualquer história deste épico, carregue:
- `/knowledge/architecture.md` (Padrão Hook-to-Component)
- `/knowledge/conventions.md` (Padrões de Nomenclatura)

## Histórias
| ID | TTítulo | Status |
|---|---|---|
| story-01-combatcard | Modularizar o `CombatCard.tsx` | done |
| story-02-vicontrolpanel | Modularizar o `VIControlPanel.tsx` | pending |

## Critérios de conclusão do épico
- [ ] Todos os componentes críticos refatorados.
- [ ] Paridade visual e funcional de 1:1 mantida após refatoração.
- [ ] Sem introdução de lógicas de negócio em componentes puramente visuais.
- [ ] Documentação de conhecimento atualizada.
- [ ] Arquivo de retrospectiva criado.
