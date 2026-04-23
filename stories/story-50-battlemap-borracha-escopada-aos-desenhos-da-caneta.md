---
title: "Story 50 — Battlemap: Borracha escopada aos desenhos da caneta"
description: "Restringir a ferramenta Borracha a apagar apenas conteúdo criado pela Caneta (traços livres e formas geométricas da story-49). Imagem de fundo, tokens/objetos e grade nunca são afetados pela borracha."
priority: "média"
status: "planejada"
last_updated: "2026-04-22"
tags: [ui, vtt, battlemap, componente, eventsourcing]
epic: epic-03-battlemap-camadas-formas-edicao-fundo-grade
depends_on: [story-48, story-49]
---

# Story 50 — Battlemap: Borracha escopada aos desenhos da caneta

## Contexto

A borracha atual (`handlePointerMove` com `activeTool === "ERASER"` em `Battlemap.tsx`) faz hit-test apenas contra `strokes` — o que acidentalmente já limita o escopo. Porém, com a introdução de `shapes` na **story-49**, a borracha precisa ser estendida para também apagar formas geométricas. E o requisito do épico é explícito: borracha nunca apaga imagem de fundo, tokens/objetos ou grade — apenas desenhos da caneta.

Esta story formaliza o escopo da borracha e estende o hit-test para incluir formas. Também garante que o indicador visual (cursor) comunique claramente o alvo.

Depende de **story-48** (camadas — a borracha só afeta camadas `DRAWING`) e **story-49** (formas).

---

## Comportamento Esperado

### Hit-test estendido

Em `handlePointerMove` com `activeTool === "ERASER" && e.buttons === 1`:

1. Converter ponteiro para coordenadas do canvas (já existe: `getCanvasPos`).
2. Definir `eraseRadius = 20 / localZoom`.
3. Para cada camada com `kind === "DRAWING"` e `visible === true`:
   - **Strokes**: lógica atual preservada — remove stroke se qualquer ponto cai dentro do raio.
   - **Shapes**: remove shape se o ponto do ponteiro cai dentro do bounding box da shape **ou** a um raio de `eraseRadius` do contorno da shape (considera-se que o desenho é só contorno, então hit = distância ao bounding box ≤ raio).
4. Coletar todos os `strokeIds` e `shapeIds` removidos e emitir um único `BATTLEMAP_UPDATED` com:
   - `strokes: strokes.filter(...)`.
   - `shapes: shapes.filter(...)`.
   - `layers`: mesmas camadas com `strokeIds`/`shapeIds` filtrados.

### O que a borracha NÃO faz

A borracha **não** itera:
- `layers` de `kind === "IMAGE"` (imagem de fundo).
- `layers` de `kind === "OBJECTS"` (tokens).
- `layers` de `kind === "BACKGROUND_COLOR"`.
- A grid layer (é puramente visual, `<div>` com CSS; borracha nem tem acesso).

Testes manuais devem comprovar que passar a borracha sobre um token ou sobre a imagem não produz nenhum `BATTLEMAP_UPDATED`.

### Cursor

Ao selecionar `ERASER`, o cursor do canvas vira círculo com raio `eraseRadius * localZoom` (preview visual do alcance). Implementar via `<circle>` SVG overlay seguindo o mouse OU via `cursor: url(...)` gerado dinamicamente. Preferência pelo overlay SVG para performance e consistência cross-browser.

### Camadas ocultas

Strokes e shapes de camadas com `visible === false` **não são afetados** pela borracha. Isso é natural pela iteração acima, mas deve ser testado.

### Desempenho

Lote de remoções em um só `BATTLEMAP_UPDATED` por `pointerUp`, não por `pointerMove`, para evitar spam de eventos quando o GM arrasta continuamente. Implementação: acumular `removedIds` durante o drag e emitir no `pointerUp` (análogo ao `isDrawing` da caneta).

Alternativa descartada: emitir a cada move (comportamento atual). Isso polui `eventStore` e pode saturar WS em mapas densos.

---

## Escopo

### Incluído
- Estender hit-test da borracha para `shapes`.
- Garantir que a borracha **ignora** imagem/tokens/grid.
- Cursor-preview circular durante `ERASER`.
- Consolidar remoções em um único evento por drag.

### Excluído
- Undo/redo (fora do épico).
- Borracha parcial que apaga só parte de um stroke (hit-test é por stroke inteiro — já era assim).
- Apagar tokens com a borracha (tokens são deletados pelo fluxo existente em `BattlemapObjects`).

---

## Arquivos afetados
- `src/components/Battlemap.tsx` (hit-test estendido + consolidação + cursor preview).
- `src/styles/Battlemap.css` (estilo do cursor-preview).

Nenhuma mudança em `domain.ts`, `projections.ts` ou store — reutiliza o que as stories 48/49 já entregaram.

---

## Critérios de Aceitação
- [ ] Borracha apaga strokes e shapes em camadas `DRAWING` visíveis.
- [ ] Arrastar a borracha sobre imagem de fundo não emite evento nem altera `imageUrl`.
- [ ] Arrastar a borracha sobre um token não apaga o token.
- [ ] Arrastar a borracha sobre grid layer não afeta `gridSize`/`gridColor`/`gridThickness`.
- [ ] Strokes/shapes em camadas com `visible === false` ficam preservados.
- [ ] Drag contínuo emite **apenas um** `BATTLEMAP_UPDATED` ao soltar, não um por move.
- [ ] Cursor-preview circular visível durante a ferramenta Borracha.
- [ ] Nenhum `prompt()` ou `confirm()` introduzido.
