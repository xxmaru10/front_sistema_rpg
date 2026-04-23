---
title: "Story 48 — Battlemap: Modelo e Painel de Camadas (estilo Canva/Photoshop)"
description: "Introduzir o modelo de camadas no Battlemap e um painel lateral (GM-only) com renomear, reordenar por drag, alternar visibilidade, apagar e selecionar camada ativa. Camada 0 = fundo sólido, Camada 1 = imagem, Camadas 2+ = desenhos/formas/tokens. Compatível com sessões antigas."
priority: "alta"
status: "planejada"
last_updated: "2026-04-22"
tags: [ui, vtt, battlemap, eventsourcing, componente]
epic: epic-03-battlemap-camadas-formas-edicao-fundo-grade
---

# Story 48 — Battlemap: Modelo e Painel de Camadas (estilo Canva/Photoshop)

## Contexto

O Battlemap atual (`src/components/Battlemap.tsx`) renderiza em ordem fixa: imagem de fundo → tokens (`BattlemapObjects`) → desenhos (SVG de `strokes`) → grid overlay. Essa ordem é hardcoded no JSX e não há conceito de "camada" selecionável ou reordenável. O modelo de dados em `src/types/domain.ts` expõe `BattlemapState` com três coleções planas (`imageUrl`, `strokes`, `objects`).

Esta story introduz o conceito de **camada** como unidade de organização do mapa, com painel de controle lateral para o Mestre — paradigma Canva/Photoshop. É a **fundação** do épico: as stories 49, 51 e 52 dependem dela para escrever/ler em camadas específicas.

---

## Comportamento Esperado

### Modelo de camadas

Nova estrutura adicionada a `BattlemapState`:

```ts
export type BattlemapLayerKind = "BACKGROUND_COLOR" | "IMAGE" | "DRAWING" | "OBJECTS";

export type BattlemapLayer = {
  id: string;
  kind: BattlemapLayerKind;
  name: string;        // editável pelo Mestre
  order: number;       // 0 = mais embaixo
  visible: boolean;
  locked: boolean;     // camadas 0 e 1 nascem locked=true para exclusão
  // Conteúdo específico por kind:
  color?: string;            // BACKGROUND_COLOR
  imageUrl?: string;         // IMAGE
  strokeIds?: string[];      // DRAWING — referencia Stroke[].id
  objectIds?: string[];      // OBJECTS — referencia BattlemapObject[].id
};
```

- `BattlemapState.layers?: BattlemapLayer[]` adicionado como **opcional**.
- `BattlemapState.activeLayerId?: string` adicionado (qual camada recebe novos desenhos).
- `strokes` e `objects` permanecem na raiz como coleções de conteúdo — `layers` apenas referencia por id. Isso mantém o reducer `BATTLEMAP_UPDATED` simples (spread de `Partial<BattlemapState>`).

### Migração lazy no reducer

Em `src/lib/projections.ts` (case `BATTLEMAP_UPDATED`):

- Se `state.battlemap.layers` é `undefined` após o spread, derivar camadas **uma única vez** a partir do estado:
  - Camada 0: `BACKGROUND_COLOR`, nome "Fundo", `color: "#1a1a1a"`, `locked: true`.
  - Camada 1: `IMAGE`, nome "Imagem de Fundo", `imageUrl: state.battlemap.imageUrl || ""`, `locked: true`, `visible: !!imageUrl`.
  - Camada 2: `OBJECTS`, nome "Tokens", `objectIds: objects.map(o => o.id)`, `locked: false`.
  - Camada 3: `DRAWING`, nome "Desenhos", `strokeIds: strokes.map(s => s.id)`, `locked: false`.
- A migração acontece na primeira leitura pós-deploy; não escreve evento retroativo.
- Quando um `BATTLEMAP_UPDATED` novo chega com `layers` no payload, o spread normal atualiza.

### Painel de Camadas (UI)

Novo componente `src/components/BattlemapLayersPanel.tsx`:

- Renderiza **apenas quando `userRole === "GM"` e `battlemapToolStore.showLayersPanel === true`**.
- Ancorado à direita do `battlemap-canvas-area`, largura ~220px, altura = viewport do mapa. Estilo glass igual aos painéis da Arena (épico 02).
- Lista em ordem **descendente** (topo visual = camada com maior `order`), como Canva.
- Cada item exibe:
  - Mini-thumbnail (placeholder por `kind`: ícone `Image`, `PenTool`, `Users` ou swatch de cor).
  - Nome (clique simples seleciona, duplo-clique entra em modo edição via `<input>` inline).
  - Botão olho (`Eye`/`EyeOff` do lucide) para alternar `visible`.
  - Botão lixeira (`Trash2`) — desabilitado quando `locked === true`.
- Drag-and-drop por handle à esquerda (ícone `GripVertical`) reordena — ao soltar, emite `BATTLEMAP_UPDATED` com o array `layers` inteiro recomputado com novos `order`.
- A camada ativa (`activeLayerId`) tem borda destacada `--accent-color`.
- Botão `+ Nova camada de desenho` no topo adiciona `DRAWING` vazia na ordem mais alta.

### Integração com o canvas

- `Battlemap.tsx` passa a renderizar iterando `layers` ordenadas por `order` ascendente:
  - `BACKGROUND_COLOR` → `<div style={{ backgroundColor: color }} />`.
  - `IMAGE` → `<img />` atual (só renderiza se `visible && imageUrl`).
  - `OBJECTS` → `<BattlemapObjects />` filtrando pelos `objectIds`.
  - `DRAWING` → `<svg><path /></svg>` filtrando pelos `strokeIds`.
- Traços novos criados pela caneta entram na camada com `id === activeLayerId`. Se `activeLayerId` aponta para camada não-`DRAWING` (ou indefinida), o Battlemap usa a camada de desenho de maior `order`; se nenhuma existe, cria uma e emite.

### Store

Em `src/lib/battlemapToolStore.ts` adicionar:
- `showLayersPanel: boolean`
- `toggleLayersPanel()`
- `setShowLayersPanel(v: boolean)`

### Toolbar

Em `BattlemapToolbar.tsx` adicionar botão GM-only `Layers` (lucide `Layers`) que abre/fecha o painel.

---

## Escopo

### Incluído
- Tipo `BattlemapLayer` e campos `layers`, `activeLayerId` em `BattlemapState`.
- Migração lazy no reducer `BATTLEMAP_UPDATED`.
- Painel `BattlemapLayersPanel` com renomear, reordenar por drag, visibilidade e apagar.
- Renderização do canvas guiada por `layers` na ordem correta.
- Botão `Layers` na toolbar + flags no `battlemapToolStore`.
- Criação de nova camada de desenho via botão "+".
- `activeLayerId` é respeitado pela caneta (integrado nesta story para não bloquear story-49).

### Excluído (fica em stories seguintes)
- Submenu de formas da caneta (story-49).
- Editor de imagem de fundo com handles (story-52).
- Comportamento da borracha mudar (story-51).
- Botões de zoom +/- (story-50).
- Novo submenu de grade (story-53).

---

## Arquivos afetados
- `src/types/domain.ts` (novos tipos e campos).
- `src/lib/projections.ts` (reducer `BATTLEMAP_UPDATED`).
- `src/components/Battlemap.tsx` (renderização por camadas, roteamento de novos strokes para `activeLayerId`).
- `src/components/BattlemapLayersPanel.tsx` **novo**.
- `src/components/header/BattlemapToolbar.tsx` (botão Layers).
- `src/lib/battlemapToolStore.ts` (`showLayersPanel`).
- `src/styles/Battlemap.css` (painel glass + handles drag).

---

## Critérios de Aceitação
- [ ] Sessão nova: ao ativar battlemap, quatro camadas default aparecem (Fundo, Imagem, Tokens, Desenhos) na ordem correta.
- [ ] Sessão antiga carregada: o reducer migra para camadas sem perder strokes/objects/imageUrl existentes e sem emitir evento retroativo.
- [ ] GM renomeia camada por duplo-clique; o nome persiste via `BATTLEMAP_UPDATED` e aparece para outros clientes (informativo — jogador não vê o painel).
- [ ] Drag reordena camadas; a ordem visual do canvas atualiza imediatamente.
- [ ] Olho oculta/mostra a camada no canvas de todos os clientes.
- [ ] Lixeira apaga camadas `DRAWING`/`OBJECTS`; tenta apagar `BACKGROUND_COLOR`/`IMAGE` está desabilitado.
- [ ] Painel só aparece para `userRole === "GM"`.
- [ ] Criar nova camada de desenho funciona; a caneta (já existente) escreve nela quando selecionada como ativa.
- [ ] Nenhum `prompt()` ou `confirm()` novo foi introduzido.
- [ ] Paridade visual/funcional com o Battlemap atual preservada quando o painel está fechado.
