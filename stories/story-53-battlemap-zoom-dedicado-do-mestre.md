---
title: "Story 53 — Battlemap: Zoom dedicado do Mestre (+/- na toolbar)"
description: "Adicionar botões +/- de zoom na toolbar do Battlemap, operados pelo Mestre, com escala mínima 0.1x e máxima 5x. O zoom é estritamente visual e local (não emite evento nem afeta jogadores). O wheel/pinch atual permanece funcional."
priority: "média"
status: "planejada"
last_updated: "2026-04-22"
tags: [ui, vtt, battlemap, componente]
epic: epic-03-battlemap-camadas-formas-edicao-fundo-grade
---

# Story 53 — Battlemap: Zoom dedicado do Mestre

## Contexto

O zoom hoje só é acessível via `wheel` do mouse (`handleWheel` em `Battlemap.tsx`) ou clique com a ferramenta `ZOOM` ativa. Usuários em touchpad/touchscreen ou com mouse sem roda ficam sem alternativa ergonômica. Em tablet/mobile isso inviabiliza ajuste fino do zoom.

Esta story adiciona dois botões dedicados `+` e `-` na toolbar, que ajustam `localZoom` com passo fixo centrado no ponto médio do viewport. O estado continua **estritamente local por cliente** — o zoom é visual, não vai para o `BattlemapState` e não é emitido em `BATTLEMAP_UPDATED`.

Story é **independente das demais** do épico.

---

## Comportamento Esperado

### Botões na toolbar

Em `BattlemapToolbar.tsx`, antes do divider que precede o botão Teatro:

- Botão `-` (ícone lucide `Minus`, 14px): aplica `zoom * 0.8`, clamp em `0.1`.
- Botão `+` (ícone lucide `Plus`, 14px): aplica `zoom * 1.25`, clamp em `5`.
- Tooltips: `"Diminuir zoom"` / `"Aumentar zoom"`.
- Ambos são **GM-only** (o zoom do jogador continua via wheel; não há requisito de botão para ele nesta task).

### Transporte do estado

O `localZoom` vive em `Battlemap.tsx` como `useState`. Para a toolbar (que é renderizada fora do componente `Battlemap`, via `BattlemapToolbar`) conseguir chamá-lo, usar o padrão já existente no projeto:

- Adicionar em `battlemapToolStore.ts`:
  - `zoomNudgeRequest: number = 0` (contador puro — incrementa quando `+` é pressionado, decrementa quando `-` é pressionado).
  - `requestZoomIn()`, `requestZoomOut()`.
- `Battlemap.tsx` observa `zoomNudgeRequest` via `subscribe` e, ao mudar, aplica o ajuste no `localZoom` centrando no meio do `containerRef.current`.

Alternativa considerada: elevar `localZoom` para o store. Descartada porque o zoom é por-cliente e não queremos que ele sobreviva a navegações — mantê-lo como state local é mais simples e não corre risco de estado stale.

### Centragem

O ajuste mantém o centro geométrico do viewport fixo durante o zoom:

```
rect = containerRef.current.getBoundingClientRect()
cx = rect.width / 2
cy = rect.height / 2
newZoom = clamp(localZoom * factor, 0.1, 5)
scaleChange = newZoom - localZoom
offsetX -= (cx - localOffset.x) * (scaleChange / localZoom)
offsetY -= (cy - localOffset.y) * (scaleChange / localZoom)
```

(Mesma fórmula de `handleWheel`, com `cx/cy` no centro em vez do mouse.)

### Interação com `Tool === "ZOOM"`

A ferramenta `ZOOM` existente (clique no canvas faz zoom in/out) continua funcional e inalterada. Os novos botões `+/-` operam independente da ferramenta ativa — o GM não precisa estar em `Tool === "ZOOM"` para usá-los.

### Wheel

O `handleWheel` atual continua restrito a `activeTool === "MOVE"` (comportamento existente) — **não é alterado** nesta story.

---

## Escopo

### Incluído
- Botões `+/-` na toolbar, GM-only.
- `requestZoomIn`/`requestZoomOut` + `zoomNudgeRequest` no store.
- `Battlemap.tsx` aplica o ajuste centralizado no viewport ao detectar mudança.
- Tooltips.

### Excluído
- Zoom via atalho de teclado.
- Zoom por pinça em mobile (fora do escopo).
- Persistir zoom entre sessões ou sincronizar com jogadores.
- Mudar o comportamento da ferramenta `ZOOM` existente.

---

## Arquivos afetados
- `src/components/header/BattlemapToolbar.tsx` (dois botões).
- `src/lib/battlemapToolStore.ts` (`zoomNudgeRequest` + métodos).
- `src/components/Battlemap.tsx` (subscribe que reage ao nudge e ajusta `localZoom`/`localOffset`).
- `src/styles/BattlemapToolbar.css` (possível ajuste de spacing dos dois novos botões).

---

## Critérios de Aceitação
- [ ] Botões `+/-` aparecem apenas para `userRole === "GM"`.
- [ ] Clicar `+` aumenta o zoom em ~25% centrado no viewport; clicar `-` diminui ~20%.
- [ ] Zoom clampa em `[0.1, 5]` — cliques extras além dos limites não fazem nada.
- [ ] Wheel continua funcionando como hoje.
- [ ] Ferramenta `ZOOM` continua funcionando como hoje.
- [ ] Nenhum `BATTLEMAP_UPDATED` é emitido quando o GM clica `+/-` (verificável em `eventStore`).
- [ ] Jogadores não observam mudança de zoom quando o GM clica nos botões.
- [ ] Nenhum `prompt()` introduzido.
