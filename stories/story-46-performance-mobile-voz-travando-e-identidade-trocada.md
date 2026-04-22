---
title: "Story 46 - Performance Mobile, Voz Travando e Identidade Trocada no Voice Chat"
description: "Três bugs reportados por jogadores: (1) site pesado/travando no celular, (2) jogador no mobile não é ouvido apesar de aparecer no voice, (3) jogador entra como Kzar mas aparece como Lina Clark na mesa Quimeras."
priority: "crítica"
status: "em andamento"
last_updated: "2026-04-22 (Fase 2 parcial + Feature GM Preview Fade)"
tags: [bugfix, performance, mobile, voice-chat, webrtc, identidade, presença]
epic: epic-01-refatoracao-modular
---

# Story 46 - Performance Mobile, Voz Travando e Identidade Trocada no Voice Chat

## Status de Implementação

| Bug | Status | O que foi feito |
|---|---|---|
| Bug 2 — Áudio unidirecional mobile | ✅ **Resolvido** | Veja seção abaixo |
| Bug 3 — Identidade trocada (Kzar/Lina Clark) | ✅ **Resolvido** | Veja seção abaixo |
| Bug 1 — Performance mobile | 🔴 **Parcialmente resolvido** — travamento persiste; causas raiz mais profundas identificadas |

---

## Bug 2 — Jogador no mobile não é ouvido ✅ RESOLVIDO

### O que foi feito
- **`VoiceChatManager.isMobileDevice()`**: detecção via `navigator.maxTouchPoints > 0`.
- **Bluetooth avoidance desabilitado em mobile**: `resolveInputDeviceId` e `tryUpgradeFromBluetoothStream` retornam sem override em dispositivos móveis. O mic do sistema é respeitado diretamente.
- **Guarda de stream health**: após `getBestEffortMicStream`, `joinVoice` verifica `track.readyState === 'live'`. Se não-live, para as tracks e retenta com `{ audio: true }` simples.
- **Log explícito de track state**: `readyState`, `enabled`, `label` logados após captura para diagnóstico futuro.
- **AudioContext resume com retry**: após o primeiro `resume()`, se ainda `suspended`, aguarda 500ms e tenta novamente (resolve comportamento de Safari/Chrome mobile que exigem gesto ativo confirmado).

---

## Bug 3 — Identidade trocada no Voice Chat ✅ RESOLVIDO

### O que foi feito
- **Backend (`events.gateway.ts`)**: corrigido de `data.characterId ?? existing?.characterId` para `data.characterId !== undefined ? data.characterId : existing?.characterId`. Novo `characterId` explícito sempre sobrescreve; `undefined` de heartbeat sem `?c=` preserva o existente.
- **`lastKnownCharacterIdRef.clear()` ao trocar de sessão**: effect de `sessionId` no `VoiceChatPanel` limpa o Map para evitar vazamento de identidade entre mesas.
- **Fallback multi-owner com prioridade `activeInArena`**: `getDisplayName`, `getCharacterImage` e `allUsers` passaram de `find()` cego (primeiro na iteração do objeto) para `filter() → find(activeInArena) ?? last`. Quando um jogador possui Kzar (ativo) e Lina Clark na mesma mesa, o ativo vence.

---

## Bug 1 — Site pesado / travando no celular 🔴 EM ANDAMENTO

### O que já foi feito (Fase 1 parcial)
- `background-attachment: fixed` → `scroll` em mobile (`isMobileNav`). ✅
- `AtmosphericEffects` suprimido em `!isMobileNav`. ✅
- Throttle do speaking poll: 300ms → 500ms em mobile via prop `isMobile`. ✅

### Por que ainda está travando — Diagnóstico Aprofundado

Após as correções de Fase 1, o problema persiste porque as causas raiz mais pesadas não foram endereçadas. O travamento vem de **múltiplas projeções completas da timeline por evento**, **subscribers reativos em todos os componentes** e **CSS de compositing pesado em toda a tela**. Detalhado abaixo.

---

#### Causa A — Projeções `computeState()` em cascata (CRÍTICO)

A cada evento recebido via WebSocket, **cinco chamadas de `computeState()` disparam em cascata** sobre a mesma timeline:

| Local | Frequência | Função |
|---|---|---|
| `page.tsx` → `_earlyState` (L173) | A cada mudança em `events` | Alimenta `useVictoryDefeat` |
| `useSessionDerivations.ts` → `state` (L52) | A cada mudança em `events` | Estado principal da sessão |
| `VoiceChatPanel.tsx` → `state` (L153) | A cada evento (subscriber próprio) | Apenas para resolver nomes de personagens |
| `TextChatPanel.tsx` → `state` (L56) | A cada evento (subscriber próprio) | Apenas para resolver `displayName` de mensagens |
| `FloatingNotes.tsx` (L358) | No `bulkEvents` callback | Apenas para resolver `stickyNotes` do usuário |

`computeState()` itera sobre **toda a timeline de eventos** para reconstruir o estado. Em sessões longas (300+ eventos), cada chamada percorre centenas de eventos. Com 5 chamadas por evento recebido, o custo é multiplicado 5x no thread principal — que em mobile tem 30-50% da velocidade de CPU de um desktop.

**Solução requerida**: centralizar o estado projetado em um único subscriber reativo no `globalEventStore`, exposto via React Context ou store singleton. Todos os componentes leem do store compartilhado em vez de cada um rodar `computeState()` independente.

---

#### Causa B — Event subscribers reativos em componentes sempre montados (ALTO)

Os seguintes componentes estão **sempre montados** (independente da aba ativa) e cada um mantém um subscriber ao `globalEventStore`:

- `VoiceChatPanel` — `globalEventStore.subscribe()` + `setEvents()` a cada evento
- `TextChatPanel` — `globalEventStore.subscribe()` + `setEvents()` a cada evento
- `FloatingNotes` — `globalEventStore.subscribe()` (bulk apenas) + `computeState()`
- `TurnOrderTracker` — `globalEventStore.subscribe()` com `setEvents()`
- `MusicPlayer` — `globalEventStore.subscribe()` com processamento de playback

Cada `setEvents(prev => [...prev, event])` cria um **novo array de estado**, o que invalida todos os `useMemo` dependentes dos componentes, causando re-render em cadeia. Em mobile, cada re-render custa mais caro pelo GPU/CPU limitado.

**Solução requerida**: componentes que só precisam de um subconjunto do estado (ex: TextChatPanel → mensagens, FloatingNotes → stickyNotes) devem receber apenas o slice relevante — não manter cópia do array `events` completo.

---

#### Causa C — `backdrop-filter: blur()` em elementos sempre visíveis (MÉDIO)

O CSS do `session.css` usa `backdrop-filter` em múltiplos elementos que estão sempre na tela:

- `.gm-sidebar-vertical` — `blur(14px)` permanente (sidebar GM)
- `.nav-expanded-shell` — `blur(16px) saturate(1.2)` (menu lateral)
- `.combat-control-bar` — `blur(4px)` (barra de controle)
- `.screenshare-refresh-btn` — `blur(8px)` (botão flutuante)
- `nav-artifact-drawer` — `blur(14px) saturate(1.25)` (gavetas da arena)
- E mais ~8 elementos com `backdrop-filter`

`backdrop-filter` força o browser a criar **stacking contexts separados** e pintar o background de cada elemento independentemente. Em mobile Chromium, isso é particularmente custoso pois desabilita otimizações de compositing em cascata. Quando o scroll acontece, todos os elementos com `backdrop-filter` precisam ser repintados.

**Solução requerida**: remover ou substituir `backdrop-filter` por `background: rgba(...)` sólido em elementos sempre visíveis no mobile via `@media (max-width: 768px)`.

---

#### Causa D — `console.log` em useMemo de render crítico (MÉDIO)

Em `useSessionDerivations.ts` L186-187, há dois `console.log` dentro do `useMemo` de `isCurrentPlayerActive`:

```ts
console.log("🛡️ [isCurrentPlayerActive] ID:", actorUserId, ...);
console.log("🛡️ [isCurrentPlayerActive] User:", actorUserId, ...);
```

Este memo é recalculado a cada mudança em `state.characters`, `currentTurnActorId` ou `actorUserId`. Em mobile, chamadas de `console.log` bloqueiam o thread brevemente — e em conjunto com a frequência de recálculo, contribuem para jank perceptível.

**Solução requerida**: remover os logs de diagnóstico (eram temporários para debug).

---

#### Causa E — `events` array como dependência universal (MÉDIO)

`useSessionDerivations` tem `eventSessionMap` (L284) com `[events, state.sessionNumber]` como deps, e `lastActionTimestamp` (L313) com `[events, state.lastTurnChangeTimestamp]`. Ambos percorrem o array completo de eventos a cada render. Como `events` muda a cada evento recebido (novo array de referência), todos esses memos são invalidados frequentemente mesmo quando a informação derivada não mudou.

---

### Plano de Correção — Fase 2

#### Prioridade 1 — Remover `console.log` de diagnóstico ✅ FEITO
- ~~Remover linhas L186-187 de `useSessionDerivations.ts` (logs emoji dentro de useMemo)~~
- ~~Remover L321 (`[DEBUG] forcing local combat start time`)~~

#### Prioridade 2 — Desabilitar `backdrop-filter` em mobile via CSS ✅ FEITO
- ~~Adicionar `@media (max-width: 768px)` em `session.css` desativando `backdrop-filter` nos elementos permanentes~~
- Complemento adicionado: `touch-action: pan-y`, `content-visibility: auto` no sidebar, `box-shadow: none` em avatar cards, redução de duração de animações contínuas

#### Prioridade 3 — Centralizar `computeState()` em store singleton (alto impacto, médio risco)
- Criar `projectedStateStore` que expõe o estado derivado e se atualiza via subscriber único do `globalEventStore`
- `VoiceChatPanel`, `TextChatPanel`, `FloatingNotes` passam a ler do store em vez de manter `events` locais + `computeState()` próprio
- Resultado: 5 chamadas → 1 chamada de `computeState()` por evento

#### Prioridade 4 — Eliminar subscriber de `VoiceChatPanel` para events (médio risco)
- `VoiceChatPanel` usa `state.characters` apenas para resolver nomes/imagens
- Alternativa mais simples: receber `characters` como prop do `HeaderWrapper`, que por sua vez recebe do `projectedStateStore` (após Prioridade 3)
- Enquanto Prioridade 3 não está pronta: passar `characters` via prop direto do `SessionHeader` usando hook `useHeaderLogic` expandido

---

## Arquivos Afetados (pendentes)

| Arquivo | Bug | Alterações Pendentes |
|---|---|---|
| `src/lib/projectedStateStore.ts` *(novo)* | 1-A | Singleton que expõe `computeState()` reativo compartilhado |
| `src/components/VoiceChatPanel.tsx` | 1-A/B | Remover subscriber de events + computeState; usar projectedStateStore |
| `src/components/TextChatPanel.tsx` | 1-A/B | Idem |
| `src/components/FloatingNotes.tsx` | 1-A/B | Idem |

## Arquivos Afetados (já corrigidos)

| Arquivo | Bug(s) | Alterações Aplicadas |
|---|---|---|
| `src/app/session/[id]/page.tsx` | 1, feature | `backgroundAttachment: scroll` em mobile; `AtmosphericEffects` suprimido em `!isMobileNav`; GM preview fade (4s após início de transmissão) |
| `src/app/session/[id]/session.css` | 1-C, feature | `@media mobile`: desabilitar backdrop-filter, `touch-action: pan-y`, `content-visibility`, `box-shadow: none` em cards, fade de preview do GM |
| `src/app/session/[id]/hooks/useSessionDerivations.ts` | 1-D | Removidos 3 `console.log` de diagnóstico dentro de useMemos |
| `src/components/HeaderWrapper.tsx` | 1 | Detecta mobile; passa `isMobile` ao `VoiceChatPanel` |
| `src/components/VoiceChatPanel.tsx` | 1, 3 | Throttle poll 300→500ms em mobile; `lastKnownCharacterIdRef.clear()` ao trocar sessão; fallback multi-owner com `activeInArena` |
| `src/lib/VoiceChatManager.ts` | 2 | `isMobileDevice()`; Bluetooth avoidance desabilitado em mobile; guarda de stream health; AudioContext resume com retry |
| `back_sistema_rpg/src/events/events.gateway.ts` | 3 | `characterId !== undefined ?` em vez de `??` para evitar retenção de ID stale |

---

## Critérios de Aceitação

### Bug 1 — Performance Mobile
- [ ] O site carrega e navega sem travamento perceptível em dispositivos Android mid-range (4GB RAM).
- [x] `background-attachment: fixed` não é aplicado em viewports ≤768px.
- [x] `AtmosphericEffects` não é renderizado em mobile.
- [ ] `computeState()` é chamado **uma única vez** por evento recebido (não 5 vezes).
- [x] `backdrop-filter` desabilitado em elementos permanentes no mobile.
- [x] O polling de speaking em mobile opera a ≥500ms de intervalo.
- [x] `console.log` de diagnóstico removidos do caminho crítico de render.

### Bug 2 — Áudio Mobile Unidirecional
- [x] Jogador em dispositivo mobile consegue **ser ouvido** por todos os participantes após entrar no voice.
- [x] Se o `getUserMedia` retornar track com `readyState !== 'live'`, o sistema tenta fallback com `{ audio: true }` simples.
- [x] Em mobile, o Bluetooth auto-avoidance é desabilitado (respeita device do sistema).
- [x] O `AudioContext` é garantidamente `running` antes de emitir `voice-join`.
- [x] Console exibe log do estado do track (`readyState`, `enabled`, `label`) após captura.

### Bug 3 — Identidade Trocada
- [x] Na mesa Quimeras, jogador que entra como Kzar aparece como **Kzar** (e não Lina Clark) no painel de voz.
- [x] Backend sobrescreve `characterId` na presença quando o novo valor é explícito (`!== undefined`).
- [x] `lastKnownCharacterIdRef` é limpo ao trocar de sessão (`sessionId`).
- [x] Quando há múltiplos personagens do mesmo owner, o fallback prioriza `activeInArena`.
- [x] A identidade no voice está correta após reconexão (F5, troca de aba, softReconnect).

---

---

## Feature — GM Preview Fade durante Transmissão de Tela ✅ IMPLEMENTADO

### Motivação
Quando o GM compartilha a tela, o `<video>` na página do GM exibe o próprio stream local (muted, para evitar feedback). Esse elemento continua sendo pintado pelo browser mesmo que o GM não precise olhar para ele — custo de GPU desnecessário enquanto o GM gerencia a mesa.

Jogadores não são afetados: eles recebem o stream via WebRTC (`RTCPeerConnection`), não via o `<video>` da página do GM.

### Comportamento implementado
- **4 segundos** após o início da transmissão, o `<video>` do GM é **pausado** (`videoEl.pause()`) — para decodificação de frames e libera CPU/GPU real — e recebe `opacity: 0.08` via CSS.
- Um hint discreto aparece no topo: **"Transmitindo · clique para ver"**.
- Clicar no hint ou no próprio vídeo chama `videoEl.play()` e restaura a opacidade.
- Quando a transmissão encerra (`videoStream` passa a `null`), o estado é resetado automaticamente.
- `content-visibility: auto` **não foi aplicado** no sidebar (risco de layout shift).

### Arquivos modificados
- **`page.tsx`**: estado `gmPreviewFaded` + `useEffect` com `setTimeout(4000)` + classe condicional `.screenshare-video--gm-faded` + hint JSX.
- **`session.css`**: `.screenshare-video--gm-faded { opacity: 0.08; pointer-events: auto; cursor: pointer; }` + `.screenshare-gm-faded-hint`.

### O que NÃO muda
- Stream WebRTC para os jogadores: intacto, independente da opacity do `<video>` local.
- Qualidade/resolução da transmissão: não afetada.
- Comportamento em desktop (sem `videoStream`): não afetado.

---

## Micro-otimizações Mobile — Fase 2 Complemento ✅ IMPLEMENTADO

Adicionadas ao `@media (max-width: 768px)` em `session.css`:

| Otimização | Elemento | Impacto |
|---|---|---|
| `touch-action: pan-y` | Barras e sidebars | Elimina 300ms de delay antes do scroll em áreas interativas |
| ~~`content-visibility: auto`~~ | ~~`.gm-sidebar-vertical`~~ | **Removido** — risco de layout shift |
| `box-shadow: none` | `.combat-avatar-card`, `.arena-char-card` | Remove layer de compositing em cards repetidos na arena |
| Duração de animação reduzida | `.pulse-dot`, `.speaking-indicator`, `.voice-speaking-ring` | Reduz frequência de repaints de animações contínuas |
| `transition: opacity 1.5s ease` no screenshare | `.screenshare-video` | Remove `transition: all` em mobile (mantém só opacity) |

---

## Não-Escopo

- Migração de topologia mesh para SFU.
- Refatoração completa do `page.tsx`.
- Suporte a iOS Safari (foco em Android Chrome).
- Alterações no schema de eventos ou domain.ts.
- Performance de desktop (foco exclusivo em mobile).
