---
title: "Story 66 — Eliminar lag na arena: fan-out do EventStore no finishRoll, persistencia sincrona e iframe YouTube em idle"
description: "Trace `Trace-20260425T232705.json` (45.1s) capturado durante sessao com lag leve relatado, sem musica tocando. Identifica tres causas concorrentes: (1) cada rolagem de dado dispara picos de 167ms / 152ms na main thread porque `finishRoll` em useDiceRoller faz 2 a 3 chamadas back-to-back de `globalEventStore.append`, e cada append faz `_sort()` O(n log n) + `JSON.stringify` sincrono de ate 12k eventos no localStorage + spread `[...this.events]` para todos os bulkListeners + recompute completo do `projectedStateStore` (mais um sort + reducer pass sobre 12k eventos) + re-render React em cascata; (2) iframe do YouTube consome ~52% do CPU nao-idle mesmo sem musica tocando porque o portal em MusicPlayer.tsx:1074 esta gated apenas em `isPlayableYouTubeUrl(currentTrack)`, ignora `isPlaying`; (3) `_persistCurrentSessionCache` e chamado em 6 pontos do `eventStore.ts` (linhas 270, 282, 349, 373, 388, 394), todo append paga `JSON.stringify` de ate 12k eventos. Story corrige os tres em ordem de impacto."
priority: "alta"
status: "concluida"
last_updated: "2026-04-26"
related: ["story-54-performance-transmissao-voz-e-render-cpu-100", "story-58-performance-abas-ficha-notas-header", "story-59-rerender-cascata-musicplayer-main-thread", "story-61-musicplayer-yt-setstate-fanout-e-iframe-desacoplado"]
tags: [performance, eventsourcing, react, main-thread, vtt, fluxo]
epic: epic-01-refatoracao-modular
repo: frontend
---

# Story 66 — Eliminar lag na arena: fan-out do EventStore no finishRoll, persistencia sincrona e iframe YouTube em idle

## Contexto

Jogador relatou lag leve durante sessao na arena (sem musica tocando). Trace `DEBUG_CELULAR/Trace-20260425T232705.json` (45.1s) analisado.

**Escopo desta story:** plataforma (eventStore, projectedStateStore, MusicPlayer, useDiceRoller). Nao mexe em codigo de plugin de sistema (Fate/Vampiro). Tudo o que e tocado vale para todas as mesas, todos os sistemas.

## Sintomas medidos no trace

| Momento | Evento | Custo na main thread |
|---|---|---|
| +23.5s | TimerFire id=90 (settle 2000ms de useFateDiceSimulation) | **183ms** |
| +39.1s | TimerFire id=95 (settle 2000ms de useFateDiceSimulation) | **164ms** |
| Idle continuo | YouTube `sample` em `base.js:5243` | **31.8% das amostras de CPU** |
| Idle continuo | YouTube anon em `base.js:956` | **20.2% das amostras de CPU** |
| Por evento | `_saveCachedEvents` (chunk 863) | 0.7% das amostras (~1045 amostras) |
| Burst | UpdateLayoutTree com 259 elementos | 40.9ms |
| Periodico | MajorGC | 33ms |

**628 frames dropados** durante o trace. CPU efetivo: ~52% so para o YouTube ocioso.

## Causa-raiz — investigacao do `finishRoll`

`useFateDiceSimulation.ts:569` agenda `setTimeout(onSettledRef.current, 2000)`. O `onSettledRef.current` esta plugado em `useDiceRoller.ts:329-334` que chama `finishRollRef.current(charId, results, breakdown, hidden)`. O corpo do `finishRoll` (`useDiceRoller.ts:139-265`) faz:

1. **`globalEventStore.append(event)`** do `ROLL_RESOLVED` (linha 176)
2. Se ha alvo + (`CREATE_ADVANTAGE` ou ataque com dano > 0): **`globalEventStore.append`** do `COMBAT_TARGET_SET` (linha 196)
3. Se e reacao defensiva contra ataque pendente: **`globalEventStore.append`** do `COMBAT_OUTCOME` (linha 229)
4. Quatro `setState` (`setDiceResults`, `setDiceRotations`, `setLastTotal`, `setIsRolling`, `setSelectedSkill`, `setManualBonus`, `setTargetIds`)

Cada `globalEventStore.append` em `eventStore.ts:366-407` faz **sincronamente, antes do await**:

| Operacao | Custo em ~5k eventos (sessao tipica) |
|---|---|
| `this.events.push(optimisticEvent)` | O(1) |
| `this._sort()` (linha 372) — `Array.prototype.sort` sobre o array inteiro | O(n log n) sobre ate 12000 eventos |
| `this._persistCurrentSessionCache()` (linha 373) — `JSON.stringify` de ate 12000 eventos + `localStorage.setItem` | Sincrono na main thread, alto custo de string + GC |
| `this.listeners.forEach(l => l(optimisticEvent))` (linha 374) | Por listener |
| `this.bulkListeners.forEach(l => l([...this.events]))` (linha 375) | **Spread de 12k eventos por listener** |

Em seguida o `projectedStateStore.recompute` (bulk listener registrado em `projectedStateStore.ts:94-97`) faz:

1. `sortEvents(events)` — **outro sort** sobre o array clonado
2. `computeState(projectionEvents, baseState)` — **reducer pass completo** sobre todos os eventos pos-snapshot
3. `this.listeners.forEach((l) => l())` — notifica todos os `useSyncExternalStore`

E o React entao reconcilia toda a sub-arvore que le `useProjectedState()` ou `useProjectedCharacters()`.

**Resultado:** uma rolagem de dado faz, na pior hipotese, **3 ciclos completos** (sort + stringify de 12k eventos + spread + recompute + reducer pass + re-render React) **sequencialmente, sincronos**. Os 167ms medidos no trace sao isso.

## Plano de correcao (em ordem de impacto)

### 1. Batch de appends em `useDiceRoller.finishRoll`

`globalEventStore` ja tem `appendQueue` para serializar a chamada de rede, mas **nao** debata os listeners locais nem o sort/persist. Solucao mais barata: introduzir um modo "burst" no event store que:

- aceita um array de eventos
- faz UM `push` de todos
- faz UM `_sort()`
- agenda UM `_persistCurrentSessionCache` (debounced — ver item 3)
- dispara UMA chamada de `bulkListeners` apos todos entrarem
- cada evento ainda dispara o listener single-event (compatibilidade), mas **nao** dispara bulk individualmente

Acao concreta: criar `globalEventStore.appendBurst(events: ActionEvent[])` em `eventStore.ts` e refatorar `finishRoll` para colecionar os 1-3 eventos em um array e chamar `appendBurst` uma vez no fim. **Reduz fan-out 3x para 1x.**

Arquivos:
- `src/lib/eventStore.ts` — novo metodo `appendBurst`
- `src/hooks/useDiceRoller.ts` — usar `appendBurst` no `finishRoll`

### 2. Debounce de `_persistCurrentSessionCache` (1.5s)

Persistir 12k eventos em localStorage a cada append e desperdicio. A perda em caso de crash do tab e de no maximo a janela de debounce. Solucao:

- substituir as 6 chamadas diretas de `_persistCurrentSessionCache()` por `_schedulePersist()` que usa `setTimeout` com janela de 1500ms, com `flushPersist()` chamado em `beforeunload` para garantir gravacao final
- manter chamada sincrona apenas no `clearEvents` / `setSessionId` se necessario

Arquivos:
- `src/lib/eventStore.ts` — adicionar `_schedulePersist`, `_pendingPersistTimer`, `flushPersist`; substituir as 6 chamadas; registrar `beforeunload` na inicializacao

### 3. Gate do iframe YouTube em `isPlaying`

`MusicPlayer.tsx:1074` hoje:

```tsx
{isMounted && isPlayableYouTubeUrl(currentTrack) && (() => {
    return createPortal(...)
```

Mesmo pausado, o iframe roda o poller interno do YouTube (`g.az`/`g.p.start`/`sample`/`g.p.zn` em `base.js:611/4336/5243/4341`) e gera as 52% de CPU vistas no trace.

**Atencao** — story-61 ja teve cuidado com NAO desmontar o player durante PLAYER role para nao perder o `MUSIC_PLAYBACK_CHANGED`. A correcao precisa preservar isso:

- continuar montando o iframe quando ha URL YouTube valida
- mas se `!isPlaying && currentTime === 0` (parado de fato), permitir desmontar
- alternativa mais segura: chamar `player.stopVideo()` quando `!isPlaying` (ja chamado em alguns paths) e investigar se o `sample` interno reduz frequencia com o player parado. Se nao reduzir, partir para desmonte condicional com gate de `userRole === 'GM'` (so GM controla, PLAYER mantem montado para receber sync).

Arquivos:
- `src/components/MusicPlayer.tsx` — refinar a guarda do portal em volta da linha 1074

**Importante:** validar que mesa com PLAYER role continua recebendo `MUSIC_PLAYBACK_CHANGED` corretamente — pode exigir que o portal so seja desmontado para GM.

### 4. Evitar spread de 12k eventos em cada notificacao bulk

`eventStore.ts:374-375, 389, 395`:

```ts
this.bulkListeners.forEach(l => l([...this.events]));
```

O `[...this.events]` clona o array a cada notificacao. Como o `projectedStateStore` ja faz `[...events].sort(...)` no `sortEvents`, podemos passar `this.events` direto (read-only by convention) e o consumidor que clone se precisar. **Reduz alocacao de memoria e pressao de GC** (vinculado ao MajorGC de 33ms visto no trace).

Acao: passar referencia direta do array e documentar que listeners nao devem mutar.

Arquivos:
- `src/lib/eventStore.ts` — remover spread nas 4 chamadas de `bulkListeners.forEach`
- Verificar todos os bulk listeners (`projectedStateStore.ts:96`, demais subscribers em `MusicPlayer`, `AtmosphericPlayer`, `useSessionEvents`, `useSessionNotesDiary`, `useCombatAutomation`, `SessionTools`, `TurnOrderTracker`) para garantir que nenhum muta o array recebido

### 5. (Opcional) Sort condicional no `_sort()`

Se o evento que acabou de entrar tem `seq=0` (otimista) e foi simplesmente empurrado pro fim, o array continua "quase ordenado". O `Array.prototype.sort` do V8 e Timsort, ja eficiente em arrays quase ordenados, mas ainda assim escaneia. Avaliar se vale checar `if (lastSeq <= newSeq) skip-sort` para o caso comum.

Arquivos:
- `src/lib/eventStore.ts` — heuristica em `_sort` ou em `append`

## Criterios de aceitacao

- [ ] Trace novo (mesmo cenario: rolar 2-3 dados em 30s, sem YT tocando) mostra picos < 60ms na main thread em vez de 167ms.
- [ ] Sem YT tocando, "YouTube `sample`" deixa de aparecer no top-5 de tempo de CPU (idealmente sem aparecer).
- [ ] `_saveCachedEvents` aparece **no maximo 1x por janela de 1.5s**, nao por evento.
- [ ] `appendBurst` cobre o cenario de 3 eventos do `finishRoll` com **1** notificacao bulk + **1** persist + **1** recompute.
- [ ] Mesa PLAYER continua recebendo `MUSIC_PLAYBACK_CHANGED` mesmo com o gate adicional do iframe (testar: GM da play numa URL YouTube; PLAYER ouve sem precisar tocar nada).
- [ ] Sem regressao em sincronia de eventos (2 abas abertas, GM e PLAYER, rolar dado num lado e ver chegando no outro com a mesma latencia de hoje).
- [ ] Frames dropados em uma sessao de 45s caem de 628 para < 100 nos mesmos cenarios.

## Riscos e mitigacoes

- **`appendBurst` pode mascarar um evento que o backend rejeita** (so descobre no fim da fila). Mitigacao: cada evento ainda vai individualmente para `apiClient.appendEvent` dentro do `appendQueue`; o burst e apenas para listeners e persistencia local.
- **Debounce de persist + crash do tab** = perda de ate 1.5s de eventos locais. Mitigacao: registrar `beforeunload` para flush; eventos ja foram para o backend via `appendQueue` (e a fonte da verdade), o cache local e apenas hidratacao rapida.
- **Desmonte do iframe YT pode quebrar autoplay subsequente**. Mitigacao: limitar o desmonte a GM (PLAYER mantem montado), e medir tempo de re-mount + `loadVideoById` antes de aprovar.
- **Listeners bulk recebendo array sem clone** podem ter side effect inesperado se algum mutar. Mitigacao: auditar os 8 chamadores antes do merge; se algum mutar, deixar o spread so para esse caller especifico.

## Fora do escopo

- Reducer-level memoization / projection caching (e proxima evolucao, se a soma das 4 acoes acima nao for suficiente).
- Snapshot incremental (servidor ja tem snapshots; frontend nao usa para evitar replay completo de 12k eventos — assunto para outra story).
- Migrar dice rendering para offscreen canvas / web worker (escopo grande demais para esta story).
- Reduzir o DOM da sessao para corrigir os 40ms de UpdateLayoutTree (`UpdateLayoutTree elementCount=259`) — story 60 ja tratou parte; ha mais a fazer mas e discussao separada.

## Como medir antes/depois

1. Capturar trace de 45s rolando 2 dados em sessao com ~5k eventos, sem musica tocando. Salvar em `DEBUG_CELULAR/`.
2. Rodar o snippet de analise abaixo (Python) e comparar:
   - `Heaviest events on MAIN APP FRAME (>30ms, top 25)` — picos de chunk 559 / TimerFire devem cair de 167ms / 152ms para < 60ms.
   - `TIME BY APP CHUNK` — chunk 559 deve cair pela metade.
   - `_saveCachedEvents` deve aparecer no maximo 1x por 1.5s no perfil.
3. Cenario com mesa pausada, URL YouTube setada mas nao tocando: medir % CPU de YouTube `sample` — deve cair para < 5%.
