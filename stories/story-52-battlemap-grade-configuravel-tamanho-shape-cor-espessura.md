---
title: "Story 52 — Battlemap: Grade Configurável (tamanho H/V, shape, cor RGB, espessura via submenus)"
description: "Substituir os 3 prompts nativos atuais (tamanho, cor, espessura) por um submenu ancorado no botão Grade, com campos separados para tamanho horizontal e vertical, seletor de shape (quadrado/círculo/triângulo/hexágono), sub-submenu de cor RGB e sub-submenu de espessura."
priority: "alta"
status: "planejada"
last_updated: "2026-04-22"
tags: [ui, vtt, battlemap, componente, eventsourcing]
epic: epic-03-battlemap-camadas-formas-edicao-fundo-grade
---

# Story 52 — Battlemap: Grade Configurável

## Contexto

Hoje o botão `Grid` e os dois botões vizinhos (`Palette` para cor, `LineChart` para espessura) em `BattlemapToolbar.tsx` disparam `prompt()` nativos para capturar valor. Isso é frágil (sem validação, sem feedback visual, péssimo em mobile), e o tamanho da grade é **isotrópico** (`gridSize: number`) — não há como ter grade com células retangulares. Além disso, a grade só é desenhada como **linhas ortogonais** via `background-image` — sem suporte a formatos de célula (círculo, triângulo, hexágono).

Esta story substitui os três `prompt()` por um submenu ancorado no botão `Grid`, adiciona sub-submenus para cor RGB e espessura, permite tamanho H/V independente e introduz a escolha de shape da célula.

Story é **independente das demais** do épico — só estende tipos e toolbar.

---

## Comportamento Esperado

### Modelo de dados

Em `src/types/domain.ts`, `BattlemapState` passa a ter (todos opcionais para compatibilidade):

```ts
gridSizeX?: number;   // px horizontal — migra de gridSize
gridSizeY?: number;   // px vertical  — migra de gridSize
gridShape?: "square" | "circle" | "triangle" | "hex";
// gridColor e gridThickness já existem
```

`gridSize` permanece na raiz como legado — o reducer escreve em ambos durante a transição para preservar sessões antigas.

### Migração no reducer

Em `projections.ts` case `BATTLEMAP_UPDATED`, após o spread:
- Se `gridSize` foi atualizado e `gridSizeX`/`gridSizeY` não: setar `gridSizeX = gridSizeY = gridSize`.
- Se `gridSizeX`/`gridSizeY` atualizados e `gridSize` não: setar `gridSize = gridSizeX` (para clientes antigos que ainda leem `gridSize` continuarem renderizando algo coerente; dupla-escrita é aceitável aqui).
- Default de `gridShape`: `"square"`.

### Renderização da grade por shape

Em `Battlemap.tsx`, o `div.battlemap-grid-layer` atual funciona apenas para `gridShape === "square"`. Para os outros shapes, trocar para um `<svg>` que usa `<pattern>`:

- `"square"`: mantém o `background-image` atual para performance.
- `"circle"`: `<pattern>` com `<circle>` no centro, raio = `min(sizeX, sizeY) / 2 - thickness`.
- `"triangle"`: `<pattern>` com `<polygon>` equilátero cabendo na célula.
- `"hex"`: `<pattern>` com `<polygon>` hexagonal; offset de linha ímpar em `sizeX/2` (padrão de favo).

Todos respeitam `gridColor` (stroke) e `gridThickness`.

### Submenu `BattlemapGridMenu`

Novo: `src/components/BattlemapGridMenu.tsx`.

- Aberto ao clicar no botão Grid (substitui o `prompt` atual).
- Popover glass ancorado sob o botão, largura ~240px.
- Conteúdo:
  1. **Tamanho** — dois inputs numéricos lado a lado com labels `H` e `V` (px). Range 5–300. Cada mudança (onBlur/Enter) emite `BATTLEMAP_UPDATED`.
  2. **Shape** — grupo de 4 ícones toggleáveis:
     - `Square` (quadrado)
     - `Circle`
     - `Triangle`
     - `Hexagon` (ícone lucide `Hexagon`)
  3. **Cor da grade** — botão swatch (quadrado com `background: gridColor`) que abre **sub-submenu**: `<input type="color">` + input HEX/RGBA manual (sincronizados). Ao escolher, emite `BATTLEMAP_UPDATED`.
  4. **Espessura** — botão com label "Espessura: Npx" que abre **sub-submenu**: slider `<input type="range" min=1 max=8 step=1>` + preview de uma linha renderizada na espessura atual.

Sub-submenus abrem ao lado (direita) do submenu principal, não o substituem — usuário pode ajustar cor/espessura sem fechar o menu de grade.

### Toolbar

- Os **3 botões** atuais (`Grid`, `Palette`, `LineChart`) são consolidados em **1 único botão `Grid`** que abre o `BattlemapGridMenu`. Isso limpa a toolbar e elimina 3 `prompt()` de uma vez.
- Botão `X` (desativar battlemap) e botão `Trash2` (limpar desenhos) permanecem. O `confirm("Limpar desenhos?")` sai do escopo desta story (pode virar uma pendência no épico — ver nota abaixo).

### Comportamento cross-client

Todos os campos (`gridSizeX`, `gridSizeY`, `gridShape`, `gridColor`, `gridThickness`) são parte de `BattlemapState` e propagam normalmente via `BATTLEMAP_UPDATED` para todos os jogadores conectados.

---

## Escopo

### Incluído
- Campos `gridSizeX`, `gridSizeY`, `gridShape` em `BattlemapState`.
- Migração dupla-escrita de `gridSize` no reducer.
- Renderização SVG `<pattern>` para `circle`/`triangle`/`hex`; `square` mantém CSS.
- `BattlemapGridMenu` + sub-submenus de cor e espessura.
- Consolidação dos 3 botões (`Grid`/`Palette`/`LineChart`) em um só botão `Grid`.
- Substituição dos 3 `prompt()` associados.

### Excluído
- Snap-to-grid (tokens alinharem à célula) — fora do escopo.
- Rotação da grade — fora do escopo.
- Padrões mistos (ex: hex + square) — fora do escopo.
- Remoção do `confirm("Limpar desenhos?")` — fora do escopo (pode ser anotado como follow-up do épico).

---

## Arquivos afetados
- `src/types/domain.ts` (`gridSizeX`, `gridSizeY`, `gridShape` em `BattlemapState`).
- `src/lib/projections.ts` (dupla-escrita de `gridSize` ↔ `gridSizeX`/`gridSizeY`).
- `src/components/Battlemap.tsx` (renderer condicional por `gridShape` + SVG pattern).
- `src/components/BattlemapGridMenu.tsx` **novo**.
- `src/components/header/BattlemapToolbar.tsx` (consolidação dos 3 botões em 1 + abrir o menu).
- `src/styles/BattlemapToolbar.css` (popover + sub-popovers glass).

---

## Critérios de Aceitação
- [ ] Clicar no botão Grid abre o submenu ancorado (sem `prompt`).
- [ ] Inputs H e V aceitam valores independentes e a grade renderiza células retangulares.
- [ ] Seletor de shape alterna entre quadrado, círculo, triângulo e hexágono — todos respeitam cor e espessura.
- [ ] Swatch de cor abre sub-submenu com `input[type=color]` + input HEX/RGBA (com alpha funcional).
- [ ] Espessura abre sub-submenu com slider e preview; valores fora do range [1,8] são clampados.
- [ ] Jogadores recebem atualizações em tempo real.
- [ ] Sessões antigas (só `gridSize`) renderizam como células quadradas com `gridSizeX === gridSizeY === gridSize`.
- [ ] Ao alterar `gridSizeX` ou `gridSizeY`, o campo legado `gridSize` também é atualizado.
- [ ] Os botões `Palette` e `LineChart` não aparecem mais na toolbar.
- [ ] Nenhum dos 3 `prompt()` relacionados a grade permanece no código.
