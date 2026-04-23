---
title: Guia de Componentes de UI
description: Referencia curta de principios para componentes visuais e composicao de interface.
tags: [ui, componentes, frontend]
repo: frontend
related:
  - /knowledge/ui/styling.md
  - /knowledge/conventions.md
last_updated: 2026-04-23
status: ativo
---

# Guia de Componentes

## Objetivo
- Manter componentes legíveis, previsíveis e baratos de renderizar.

## Regras rápidas
- Componentes persistentes devem evitar efeitos visuais caros contínuos.
- Estados críticos devem ter feedback claro (ativo, erro, carregando).
- Priorizar composição por props e evitar lógica de domínio no componente visual.
