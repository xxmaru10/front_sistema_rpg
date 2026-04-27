---
title: "Story 49 — Battlemap: Caneta com Submenu de Formas (quadrado, círculo, losango, triângulo)"
description: "Evoluir o botão Caneta para ter uma seta lateral que abre dropdown de formas geométricas. Ao escolher uma forma, o próximo drag cria a forma na camada ativa. Traço livre segue como default."
priority: "alta"
status: "concluída"
last_updated: "2026-04-27"
tags: [ui, vtt, battlemap, componente, eventsourcing]
epic: epic-03-battlemap-camadas-formas-edicao-fundo-grade
depends_on: [story-48]
---

# Story 49 — Battlemap: Caneta com Submenu de Formas

## Contexto

Hoje o botão Caneta (`Tool === "PEN"` em `BattlemapToolbar.tsx`) só permite traço livre: o Mestre segura o botão e o `pointerMove` acumula pontos em `currentStroke.points`. Não há forma de desenhar um quadrado, círculo ou triângulo — o Mestre precisa contornar à mão, o que polui o mapa.

Esta story adiciona uma **seta lateral** ao botão Caneta abrindo um dropdown com 4 formas geométricas. Com uma forma selecionada, o primeiro drag no canvas vira um retângulo/círculo/losango/triângulo bem definido. Com "Traço livre" selecionado (default), comportamento atual é preservado.

Depende da **story-48** (modelo de camadas) porque cada forma criada vira um item na camada ativa.

---

## Comportamento Esperado

### Tipo `BattlemapShape`

Adicionar a `src/types/domain.ts`:

```ts
export type BattlemapShapeKind = "FREEHAND" | "RECT" | "CIRCLE" | "DIAMOND" | "TRIANGLE";

export type BattlemapShape = {
  id: string;
  kind: Exclude<BattlemapShapeKind, "FREEHAND">;
  color: string;
  strokeWidth: number;
  x: number;       // canto superior-esquerdo do bounding box
  y: number;
  width: number;
  height: number;
};
```

`BattlemapState` ganha `shapes?: BattlemapShape[]` na raiz (paralelo a `strokes`), e `BattlemapLayer` ganha `shapeIds?: string[]`.

Alternativa descartada: unificar `Stroke` e `Shape` em uma estrutura polimórfica — rejeitada para manter compatibilidade com desserialização de sessões antigas.

### Store

Em `battlemapToolStore.ts` adicionar:
- `activeShape: BattlemapShapeKind = "FREEHAND"`
- `setActiveShape(kind)`

### Toolbar

- O botão `PenTool` mantém comportamento atual (clique → `setTool("PEN")`).
- Ao lado dele, um **chevron `ChevronDown`** (~10px, mesma altura do ícone) abre o dropdown `BattlemapShapesMenu`.
- Dropdown ancorado, fundo glass, 5 opções:
  - Traço livre (ícone `PenTool`)
  - Retângulo (ícone `Square`)
  - Círculo (ícone `Circle`)
  - Losango (ícone `Diamond`)
  - Triângulo (ícone `Triangle`)
- Selecionar uma forma fecha o dropdown, ativa `Tool === "PEN"` e atualiza `activeShape`. Um badge pequeno (ícone da forma) aparece sobreposto ao canto do botão Caneta para indicar o modo atual.

Novo componente: `src/components/BattlemapShapesMenu.tsx`.

### Canvas (`Battlemap.tsx`)

- `handlePointerDown` quando `activeTool === "PEN"`:
  - Se `activeShape === "FREEHAND"`: fluxo atual (cria `currentStroke`).
  - Caso contrário: registra `shapeDragStart = pos`, `isShaping = true`, limpa `currentStroke`.
- `handlePointerMove` durante `isShaping`: renderiza **preview** da forma entre `shapeDragStart` e `pos` (SVG, não persistido).
- `handlePointerUp` durante `isShaping`: se `Math.abs(dx) > 3 && Math.abs(dy) > 3`, cria `BattlemapShape`, adiciona a `shapes` + `shapeIds` da `activeLayerId` e emite `BATTLEMAP_UPDATED`. Caso contrário, descarta (clique acidental).

### Renderização

Adicionar renderer SVG por `kind` dentro da mesma camada `<svg>` já usada para strokes:
- `RECT` → `<rect x y width height fill="none" stroke={color} strokeWidth={strokeWidth} />`
- `CIRCLE` → `<ellipse cx={x+w/2} cy={y+h/2} rx={w/2} ry={h/2} ... />`
- `DIAMOND` → `<polygon points="topMid rightMid bottomMid leftMid" ... />`
- `TRIANGLE` → `<polygon points="topMid bottomLeft bottomRight" ... />`

Todas respeitam `visible` da camada dona.

### Borracha

Não é escopo desta story mudar a borracha; a story-51 cuida disso. Enquanto story-51 não entregar, a borracha atual continua apagando só strokes — as shapes ficam "persistentes" até a story-51 estender o hit-test.

---

## Escopo

### Incluído
- Tipos `BattlemapShape`/`BattlemapShapeKind` e extensão de `BattlemapState`/`BattlemapLayer`.
- `activeShape` em `battlemapToolStore`.
- `BattlemapShapesMenu` + chevron no botão Caneta.
- Fluxo de criação por drag com preview.
- Persistência via `BATTLEMAP_UPDATED` com `shapes` e `layers` atualizados.
- Renderização SVG das 4 formas.

### Excluído
- Borracha apagar formas (story-51 amplia).
- Seleção/edição de forma existente pós-criação (não solicitado).
- Preenchimento (`fill`) — todas as formas são contorno apenas nesta story. Pode ser adicionado depois sem quebrar o tipo.

---

## Arquivos afetados
- `src/types/domain.ts` (tipos `BattlemapShape*`, extensão de `BattlemapState`/`BattlemapLayer`).
- `src/lib/projections.ts` (defaults e migração para `shapes: []`, `shapeIds: []`).
- `src/lib/battlemapToolStore.ts` (`activeShape`).
- `src/components/header/BattlemapToolbar.tsx` (chevron + badge no botão Caneta).
- `src/components/BattlemapShapesMenu.tsx` **novo**.
- `src/components/Battlemap.tsx` (ciclo pointer + renderização das formas).
- `src/styles/BattlemapToolbar.css` (badge + chevron).

---

## Critérios de Aceitação
- [ ] Chevron ao lado do botão Caneta abre o dropdown de formas.
- [ ] Selecionar "Traço livre" preserva o comportamento atual 1:1.
- [ ] Selecionar qualquer das 4 formas ativa `Tool === "PEN"` e muda o modo da caneta.
- [ ] Drag no canvas com forma selecionada mostra preview e, ao soltar, persiste a forma na camada ativa.
- [ ] Clique sem drag (sub-3px) não cria forma.
- [ ] Badge da forma atual aparece no canto do botão Caneta.
- [ ] Formas novas respeitam `color` atual (`penColor`) e `strokeWidth` (usar `4` — mesmo default dos strokes).
- [ ] Formas criadas pertencem à `activeLayerId`; ocultar a camada oculta as formas.
- [ ] Sessão antiga (sem `shapes`) carrega sem erro — default `[]`.
- [ ] Nenhum `prompt()` introduzido.
