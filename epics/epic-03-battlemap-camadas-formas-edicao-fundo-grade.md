---
title: "Épico 03 — Battlemap: Camadas, Formas, Zoom, Borracha, Edição de Fundo e Grade Configurável"
description: "Ampliar o modo Battlemap com painel de camadas (tipo Canva/Photoshop), caneta com formas geométricas, zoom dedicado do GM, borracha, edição in-canvas da imagem de fundo e submenu completo de Grade (tamanho H/V, shape, cor RGB, espessura)."
tags: [ui, vtt, battlemap, canvas, eventsourcing, frontend]
repo: frontend
related:
  - /knowledge/architecture.md
  - /knowledge/conventions.md
  - src/components/Battlemap.tsx
  - src/components/BattlemapObjects.tsx
  - src/components/header/BattlemapToolbar.tsx
  - src/lib/battlemapToolStore.ts
  - src/lib/projections.ts
  - src/types/domain.ts
  - src/styles/Battlemap.css
  - src/styles/BattlemapToolbar.css
status: planejado
last_updated: 2026-04-22
---

# Épico 03 — Battlemap: Camadas, Formas, Zoom, Borracha, Edição de Fundo e Grade Configurável

## Objetivo
Transformar o Battlemap atual (fundo fixo + desenhos livres + objetos) num editor em camadas operável pelo Mestre, equivalente em ergonomia a Canva/Photoshop. O resultado do épico deve entregar: painel de **Camadas** com controle de ordem/nome/exclusão, **Caneta** com dropdown de formas geométricas, **Zoom** dedicado do GM, **Borracha** restrita a desenhos da caneta, edição in-canvas da **Imagem de Fundo** com handles e confirmação, e um botão **Grade** com submenu completo (tamanho horizontal/vertical independente, shape, cor RGB, espessura).

Todo o estado é sincronizado via Event Sourcing (`BATTLEMAP_UPDATED`), sem alterações no backend além da evolução do payload.

## Contexto necessário para trabalhar neste épico
Antes de iniciar qualquer story deste épico, carregar:
- `/knowledge/architecture.md` (Event Sourcing, projeções)
- `/knowledge/conventions.md` (padrões de nomenclatura)
- `src/types/domain.ts` (tipos `BattlemapState`, `Stroke`, `BattlemapObject`)
- `src/lib/projections.ts` (reducer `BATTLEMAP_UPDATED`)
- `src/components/Battlemap.tsx` (canvas + transform layer + input handling)
- `src/components/header/BattlemapToolbar.tsx` (toolbar atual com `prompt` temporário)
- `src/lib/battlemapToolStore.ts` (store local do modo)

## Frentes do épico
1. **Modelo de Camadas**: introduzir `BattlemapLayer` em `BattlemapState`, preservando compatibilidade com `imageUrl`/`strokes`/`objects` existentes (migração por projeção, não no backend). Camada 0 = fundo sólido (cor), Camada 1 = imagem de fundo (quando houver), Camadas 2+ = desenhos/formas/tokens adicionados pelo Mestre.
2. **Painel de Camadas** (UI): lista vertical ancorada ao canvas, cada item com thumbnail, nome editável (duplo-clique), drag-to-reorder, visibility toggle, botão apagar, seleção da camada ativa. Apenas GM enxerga o painel.
3. **Caneta com Formas**: `Tool === "PEN"` mantém traço livre; seta lateral abre submenu de formas (`RECT`, `CIRCLE`, `DIAMOND`, `TRIANGLE`). Ao escolher uma forma, o próximo drag cria a forma naquela camada ativa; após soltar, a forma vira item individual com hit-test próprio.
4. **Zoom dedicado do GM**: botões `+`/`-` na toolbar (independente do wheel existente), com escala mínima 0.1 e máxima 5; estado local por cliente (zoom é visual, não entra em `BATTLEMAP_UPDATED`).
5. **Borracha escopada**: `Tool === "ERASER"` apaga apenas strokes/formas da caneta — nunca imagem de fundo, tokens/objetos ou grade. Sem toggle global.
6. **Edição da Imagem de Fundo**: ao upload/seleção, a imagem entra como Camada 1 em modo edição, encaixada no viewport pequeno por padrão; handles de vértice (8 âncoras) permitem resize, âncora rotacional permite girar, drag do corpo permite mover. Botão flutuante `✓` (lucide `Check`) confirma e sai do modo edição; reabrir sempre via painel de camadas (duplo-clique ou menu de contexto).
7. **Grade Configurável**: botão `Grid` abre submenu ancorado com:
   - **Tamanho**: campos numéricos separados `horizontal` / `vertical` (px).
   - **Shape**: `quadrado` | `circulo` | `triangulo` | `hexagono` (renderizado via SVG pattern, não só `background-image` de linhas).
   - **Cor da grade**: sub-submenu com seletor RGB (color picker nativo + input HEX/RGBA).
   - **Espessura**: sub-submenu com slider numérico (1–8 px) e preview.

## Arquivos afetados (previsão)
- `src/types/domain.ts` — novos tipos: `BattlemapLayer`, `BattlemapShape`, `BattlemapGridShape`, extensão de `BattlemapState` com `layers`, `gridSizeX`, `gridSizeY`, `gridShape`, `activeLayerId`. Payload de `BATTLEMAP_UPDATED` passa a aceitar `layers`.
- `src/lib/projections.ts` — estender reducer `BATTLEMAP_UPDATED` com defaults de camadas e migração lazy de `imageUrl`/`strokes`/`objects` antigos para layers (sem perder replays históricos).
- `src/components/Battlemap.tsx` — renderizar por ordem de camadas, suportar modo edição da imagem, suportar formas geométricas no ciclo `handlePointerDown`/`Move`/`Up`, restringir borracha a conteúdo de caneta.
- `src/components/BattlemapObjects.tsx` — possivelmente absorvido pelo renderer de camadas (tokens passam a ser um tipo de camada `OBJECT`).
- `src/components/header/BattlemapToolbar.tsx` — trocar os quatro `prompt()` atuais (tamanho/cor/espessura/grade) por submenus ancorados; adicionar botões de zoom `+/-`; adicionar seta lateral no botão Caneta para abrir dropdown de formas; adicionar botão "Camadas".
- `src/components/BattlemapLayersPanel.tsx` — **novo**, painel lateral tipo Canva.
- `src/components/BattlemapGridMenu.tsx` — **novo**, submenu de Grade com sub-submenus.
- `src/components/BattlemapShapesMenu.tsx` — **novo**, dropdown de formas da caneta.
- `src/components/BattlemapBackgroundEditor.tsx` — **novo**, overlay de handles + `Check` de confirmação.
- `src/lib/battlemapToolStore.ts` — novos campos locais: `activeShape`, `backgroundEditing`, `localZoom` (se migrar), `showLayersPanel`, `showGridMenu`.
- `src/styles/Battlemap.css` e `src/styles/BattlemapToolbar.css` — estilos de painéis, submenus, handles.

## Histórias planejadas (numeradas na ordem de entrega)
| ID | Título | Arquivo | Status |
|---|---|---|---|
| story-48 | Battlemap — Modelo e Painel de Camadas | `/stories/story-48-battlemap-modelo-e-painel-de-camadas.md` | planejada |
| story-49 | Battlemap — Caneta com Submenu de Formas | `/stories/story-49-battlemap-caneta-com-submenu-de-formas.md` | planejada |
| story-50 | Battlemap — Borracha escopada aos desenhos da caneta | `/stories/story-50-battlemap-borracha-escopada-aos-desenhos-da-caneta.md` | planejada |
| story-51 | Battlemap — Edição In-Canvas da Imagem de Fundo | `/stories/story-51-battlemap-edicao-in-canvas-da-imagem-de-fundo.md` | planejada |
| story-52 | Battlemap — Grade Configurável | `/stories/story-52-battlemap-grade-configuravel-tamanho-shape-cor-espessura.md` | planejada |
| story-53 | Battlemap — Zoom dedicado do Mestre | `/stories/story-53-battlemap-zoom-dedicado-do-mestre.md` | planejada |

## Dependências entre stories
- **story-48** entrega o modelo de camadas e o painel; **story-49, 50, 51** dependem dele para escrever/ler em camadas específicas.
- **story-50** (Borracha) depende de **story-48** e **story-49** (hit-test precisa cobrir strokes e shapes).
- **story-51** (Edição de fundo) depende de **story-48** (camada 1 = imagem) mas pode desenvolver o editor de handles em paralelo, integrando por último.
- **story-52** (Grade) é independente das demais — só estende o submenu da toolbar e os campos de grade em `BattlemapState`.
- **story-53** (Zoom) é independente (puramente visual, sem tocar em `BattlemapState`).
- Ordem de entrega (já refletida na numeração): **48 → 49 → 50 → 51 → 52 → 53**.

## Critérios de aceitação do épico
- [ ] Painel de Camadas funcional (apenas GM) com renomear, reordenar drag-and-drop, alternar visibilidade, apagar; camada 0 (fundo sólido) e camada 1 (imagem) nunca são apagáveis, apenas ocultáveis.
- [ ] Caneta funciona em traço livre e em cada uma das 4 formas (quadrado, círculo, losango, triângulo). Cada item criado aparece como elemento da camada ativa e pode ser apagado pela borracha.
- [ ] Zoom do Mestre controla apenas a visualização local (não emite evento, não afeta jogadores).
- [ ] Borracha nunca apaga imagem de fundo, tokens ou grade — apenas desenhos da caneta (traço livre e formas).
- [ ] Imagem de fundo entra encaixada no viewport pequeno, permite resize por 8 âncoras, rotação por âncora dedicada, move por drag; confirma com botão `✓`; reabrir edição é feito pelo painel de camadas e funciona após refresh.
- [ ] Botão Grade abre submenu ancorado (não `prompt()`) com campos `horizontal` e `vertical` separados, seletor de shape (quadrado/círculo/triângulo/hexágono), sub-submenu de cor RGB e sub-submenu de espessura; mudanças são imediatas e sincronizadas entre GM e jogadores via `BATTLEMAP_UPDATED`.
- [ ] Compatibilidade com mesas pré-existentes: sessões que já têm `imageUrl`/`strokes`/`objects` antigos continuam carregando sem perda, migrados para o modelo de camadas via projeção.
- [ ] Nenhuma alteração no backend além da aceitação do payload estendido de `BATTLEMAP_UPDATED` (que é `Partial<BattlemapState>` — já permissivo).
- [ ] Paridade desktop/mobile preservada (sem regressão nos demais botões da toolbar).
- [ ] Documentação em `/knowledge/architecture.md` atualizada com a seção "Battlemap em camadas".
- [ ] Nenhuma das quatro chamadas atuais a `prompt()` na `BattlemapToolbar.tsx` permanece ao final do épico.

## Fora do escopo
- Colaboração simultânea de múltiplos jogadores desenhando ao mesmo tempo (desenho segue sendo do GM, com difusão única).
- Fog of War / visão por jogador.
- Tokens com IA, geração procedural de mapa, snap-to-grid avançado.
- Export/import de mapas em arquivo.
- Qualquer mudança no protocolo/WebSocket além de aceitar os novos campos no payload já existente.

## Riscos e mitigações
- **Migração de sessões antigas**: risco de quebrar projeção ao introduzir `layers`. Mitigação: reducer cria `layers` a partir de `imageUrl`/`strokes`/`objects` quando ausente; nunca reescreve eventos passados.
- **Complexidade do editor de imagem**: handles + rotação podem regressar sobre a experiência existente de arrastar tokens. Mitigação: editor da imagem só ativa para a camada marcada como `IMAGE` em `backgroundEditing === true`; tokens seguem outro fluxo.
- **Performance do painel de camadas em mapas com 50+ formas**: mitigação com memoização e thumbnails lazy.
- **Color picker RGB**: usar `<input type="color">` + input HEX/RGBA para alpha; evitar dependência nova pesada.
