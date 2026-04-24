---
title: "Story 51 — Battlemap: Edição In-Canvas da Imagem de Fundo (resize/rotate/mover + ✓ + reabrir por camadas)"
description: "Ao colocar uma imagem de fundo, ela entra encaixada no viewport pequeno em modo edição, com 8 handles de resize, handle de rotação e drag para mover. Botão flutuante ✓ confirma e sai do modo edição. Reabrir edição é feito pelo painel de camadas."
priority: "alta"
status: "planejada"
last_updated: "2026-04-22"
tags: [ui, vtt, battlemap, componente, eventsourcing]
epic: epic-03-battlemap-camadas-formas-edicao-fundo-grade
depends_on: [story-48]
---

# Story 51 — Battlemap: Edição In-Canvas da Imagem de Fundo

## Contexto

Hoje, ao selecionar uma imagem de fundo pelo `ImageLibraryModal`, o handler `handleSelectImage` em `Battlemap.tsx` emite `BATTLEMAP_UPDATED` com `{ imageUrl }` e a imagem é renderizada via `<img className="battlemap-background-img" />`. O CSS atual (`Battlemap.css`) força a imagem em tamanho natural/fixed — o Mestre não tem controle fino sobre posicionamento, escala ou rotação da imagem. Mapas com proporções fora do padrão ficam mal-encaixados.

Esta story transforma a imagem em um **elemento editável in-canvas**: ao ser colocada, entra em **modo edição** com tamanho default encaixado ao viewport (letterbox), handles de resize nas 8 âncoras, handle de rotação no topo, drag para mover, e um botão flutuante `✓` para confirmar. Após confirmar, vira a camada IMAGE da story-48 — reabrir o editor é feito pelo painel de camadas (duplo-clique ou menu de contexto).

Depende de **story-48** porque a imagem é renderizada como camada `IMAGE` com `order = 1`.

---

## Comportamento Esperado

### Estado da camada IMAGE

A `BattlemapLayer` de `kind === "IMAGE"` ganha campos de transformação:

```ts
export type BattlemapLayer = {
  // ... (story-48) ...
  imageTransform?: {
    x: number;          // px no espaço do canvas
    y: number;
    width: number;      // px no espaço do canvas
    height: number;
    rotation: number;   // graus
  };
  editing?: boolean;    // quando true, overlay de edição ativo (estado local-only)
};
```

Semântica:
- `imageTransform` é persistido via `BATTLEMAP_UPDATED`.
- `editing` é um flag **local** — não entra no payload nem na projeção. Vive em `battlemapToolStore` como `editingLayerId: string | null`.

### Fluxo de entrada em modo edição

Quando o GM seleciona uma imagem no `ImageLibraryModal` e confirma "FUNDO":

1. Calcular `imageTransform` default para encaixar no viewport pequeno (letterbox):
   - `containerRect = containerRef.current.getBoundingClientRect()`.
   - Descontar `localZoom` e `localOffset` para obter o retângulo visível no espaço do canvas.
   - `imageTransform.width = viewportWidthCanvas * 0.6` (60% do viewport).
   - Manter aspect ratio da imagem (carregar `<img>` offscreen para descobrir naturalWidth/Height).
   - Centrar `x`/`y` no meio do viewport visível.
   - `rotation: 0`.
2. Emitir `BATTLEMAP_UPDATED` com a `IMAGE` layer atualizada (`imageUrl` + `imageTransform` + `visible: true`).
3. Ativar localmente `editingLayerId` = id da camada IMAGE.

O `confirm()` atual em `handleSelectImage` (que pergunta FUNDO ou OBJETO) **é substituído** por dois botões explícitos no `ImageLibraryModal` — removendo uma das chamadas a `confirm()` da toolbar/battlemap (alinhado com o critério do épico de eliminar `prompt`/`confirm` nativos). O fluxo "adicionar como OBJETO" continua inalterado internamente, mas o gatilho vira um botão.

### Componente `BattlemapBackgroundEditor`

Novo: `src/components/BattlemapBackgroundEditor.tsx`.

- Renderizado **dentro** do `battlemap-transform-layer` no `Battlemap.tsx`, sobrepondo a camada IMAGE quando `editingLayerId` está setado e aponta para ela.
- Overlay posicionado em `imageTransform.x/y/width/height`, rotacionado `rotation`.
- 8 handles (NE, N, NW, W, SW, S, SE, E) — quadrados 12×12px com borda.
- 1 handle rotacional (círculo 12px) acima do handle N, ligado por linha vertical curta.
- Corpo do overlay é arrastável para mover.
- Botão flutuante `✓` (ícone lucide `Check`, fundo glass, 28px) posicionado no canto externo inferior-direito do bounding box — clicar sai do modo edição (`editingLayerId = null`). O estado final já está persistido (cada move/resize/rotate emite durante o drag — vide Throttling).

### Throttling

Para evitar spam de eventos durante arrasto de handles:
- Acumular mudanças no estado **local** do editor.
- Emitir `BATTLEMAP_UPDATED` apenas a cada **100ms** durante o drag, via `requestAnimationFrame` + throttle simples.
- Sempre emitir um evento final no `pointerUp`.

### Reabrir edição

No `BattlemapLayersPanel` (story-48), item da camada IMAGE tem:
- **Duplo-clique** no thumbnail: ativa `editingLayerId = layer.id` → editor reaparece.
- Também um ícone pequeno `Edit2` dentro do item (visível em hover) faz o mesmo.

Após refresh/reload: `editingLayerId` é local e volta a `null` — o Mestre vê a imagem confirmada. Reabrir é sempre manual via painel.

### Interação com outras ferramentas

- Enquanto `editingLayerId !== null`, as ferramentas `PEN` / `ERASER` / `ZOOM` ficam desabilitadas (cursor badge mostra "Modo edição ativo"). `MOVE` continua funcional (pan do viewport). Opcional: desabilitação visual do botão da ferramenta.

Alternativa descartada: permitir desenhar por cima durante o modo edição — gera ambiguidade de clique nos handles.

### Visibilidade para jogadores

O overlay de edição (handles, botão `✓`) é **GM-only**. Jogadores continuam vendo apenas a imagem renderizada com `imageTransform` atualizada em tempo real conforme o Mestre manipula — é esperado; equivale ao Mestre arrumar o mapa ao vivo.

---

## Escopo

### Incluído
- Campo `imageTransform` na camada IMAGE.
- Editor in-canvas com 8 handles de resize, handle de rotação, drag para mover, botão `✓`.
- Cálculo de encaixe default ao viewport.
- Throttling de eventos durante drag.
- Reabrir edição via painel de camadas.
- Substituir `confirm()` de "FUNDO vs OBJETO" no `ImageLibraryModal` por dois botões.

### Excluído
- Crop da imagem (fora do escopo).
- Inverter horizontal/vertical (flip) — adiar.
- Opacidade da imagem — adiar.
- Suporte a múltiplas camadas IMAGE (por ora, sempre 1).

---

## Arquivos afetados
- `src/types/domain.ts` (campo `imageTransform` em `BattlemapLayer`).
- `src/lib/battlemapToolStore.ts` (`editingLayerId`, `setEditingLayerId`).
- `src/components/Battlemap.tsx` (handler da imagem, render condicional do editor, default transform calc, desativação de outras ferramentas enquanto edita).
- `src/components/BattlemapBackgroundEditor.tsx` **novo**.
- `src/components/ImageLibraryModal.tsx` (dois botões em vez de `confirm()`).
- `src/components/BattlemapLayersPanel.tsx` (duplo-clique + ícone `Edit2` reabrem edição).
- `src/styles/Battlemap.css` (handles, rotação, botão ✓).

---

## Critérios de Aceitação
- [ ] Ao colocar imagem de fundo, ela entra encaixada no viewport pequeno (~60% da largura visível, mantendo aspect ratio).
- [ ] 8 handles permitem resize a partir de cada vértice/aresta do bounding box.
- [ ] Handle de rotação gira a imagem em torno do centro.
- [ ] Drag no corpo move a imagem.
- [ ] Botão `✓` (flutuante) sai do modo edição localmente.
- [ ] Recarregar a página mantém a imagem com a transform confirmada; modo edição fica desligado.
- [ ] Duplo-clique no item IMAGE do painel de camadas reabre a edição.
- [ ] Durante o drag, eventos `BATTLEMAP_UPDATED` são emitidos em no máximo ~10Hz (throttling 100ms), + um final no `pointerUp`.
- [ ] Ferramentas PEN/ERASER/ZOOM ficam desabilitadas durante edição (MOVE segue ativo).
- [ ] `confirm()` do `handleSelectImage` é eliminado (substituído por botões no modal).
- [ ] Jogadores veem a imagem atualizar em tempo real mas não veem os handles/botão ✓.
