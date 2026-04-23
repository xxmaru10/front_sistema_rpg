---
title: Diretrizes de Estilo de UI
description: Regras de estilo para manter consistencia visual com foco em legibilidade e custo de render.
tags: [ui, css, performance, estilo]
repo: frontend
related:
  - /knowledge/architecture.md
  - /knowledge/conventions.md
last_updated: 2026-04-23 (story-56 shell visual ficha/notas)
status: ativo
---

# Diretrizes de Estilo

## Regra de performance para shell persistente
- Em painéis persistentes (sidebar, nav, header), priorizar `background` semi-opaco em vez de `backdrop-filter`.
- `backdrop-filter` deve ficar restrito a modais e overlays pontuais.
- Evitar combinar `blur(...)` com `saturate(...)` em elementos sempre visíveis.
- Em `box-shadow` de containers persistentes, preferir sombra simples sem `inset` de glow.

## Movimento e acessibilidade
- Animações contínuas de background devem respeitar `@media (prefers-reduced-motion: reduce)`.
- Para temas com animação ambiental, usar fallback explícito com `animation: none` em reduced motion.

## Consistência visual
- Ajustes de performance visual não devem remover hierarquia de leitura (contraste, borda e estado ativo).
- Mudanças em estilo global devem preservar a identidade do app em modais e estados críticos.
