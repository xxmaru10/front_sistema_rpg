---
title: "Story 55 - MusicPlayer Receiver: Sync do YouTube sem idempotencia causa loop PLAYING/BUFFERING"
description: "Receiver em YouTube oscila perpetuamente entre YT_NATIVE_STATE 1 (PLAYING) e 3 (BUFFERING), consumindo CPU continua em aparelhos fracos. Causa: seekTo, playVideo, pauseVideo e stopVideo sao aplicados sem guard de drift nem guard de estado, ao contrario do ramo de audio local que ja tem guard de drift. Plano em quatro passos: instrumentacao, guard de seekTo por epsilon, guard de estado para play/pause, e consolidacao dos ramos delta e bulk."
priority: "alta"
status: "pronto"
last_updated: "2026-04-23"
tags: [musicplayer, youtube, sync, receiver, performance, bugfix]
epic: epic-01-refatoracao-modular
---

# Story 55 - MusicPlayer Receiver: Sync do YouTube sem idempotencia causa loop PLAYING/BUFFERING

## Problema Reportado

Jogadora relatou travamento do site durante sessao. Trecho do log da aba dela (build `layout-8cd6c8fd73586959.js`, host de preview Vercel):

```text
[MusicPlayer] YT_NATIVE_READY
[MusicPlayer] YT_NATIVE_STATE: -1
[MusicPlayer] YT_NATIVE_STATE: 0
[MusicPlayer] YT_UNLOCK_APPLIED — reason=first-user-gesture
[MusicPlayer] YT_NATIVE_STATE: 1
[MusicPlayer] YT_NATIVE_STATE: 3
[MusicPlayer] YT_NATIVE_STATE: 1
[MusicPlayer] YT_NATIVE_STATE: 3
... (30+ ciclos sem convergir)
```

Codigos do YouTube IFrame API: `-1 = UNSTARTED`, `0 = ENDED`, `1 = PLAYING`, `2 = PAUSED`, `3 = BUFFERING`, `5 = CUED`. O player entra e sai de buffering indefinidamente. A jogadora e **receiver** (sem logs de WebRTC broadcast no mesmo console). O log vem de `src/components/MusicPlayer.tsx:316`, que e `onStateChange` — ou seja, as transicoes 1<->3 sao reais, nao so ruido de console.

Sintoma lateral no mesmo console:
```
Failed to execute 'postMessage' on 'DOMWindow':
target origin 'https://www.youtube.com' does not match recipient origin '...vercel.app'
```
E consequencia de ciclo de vida instavel do iframe, nao causa raiz.

## Diagnostico

### Assimetria de guards entre audio local e YouTube

Para audio local (tag `<audio>`), o receiver aplica `currentTime` apenas se o drift for maior que 2s:

- `src/components/MusicPlayer.tsx:454` (ramo delta):
  ```ts
  if (audioRef.current && Math.abs(audioRef.current.currentTime - elapsed) > 2) {
      audioRef.current.currentTime = elapsed % (audioRef.current.duration || 1);
  }
  ```
- `src/components/MusicPlayer.tsx:574` (ramo bulk/snapshot restore): mesma checagem.

Para YouTube, **nao ha guard equivalente** em nenhum dos tres sites que aplicam posicao:

- `src/components/MusicPlayer.tsx:418-419` (ramo delta do `subscribe` em `globalEventStore`):
  ```ts
  if (isYouTubePlayerAttached() && ytPlayerRef.current && typeof ytPlayerRef.current.seekTo === 'function') {
      ytPlayerRef.current.seekTo(elapsed, true);
  }
  ```
- `src/components/MusicPlayer.tsx:547-548` (ramo bulk/snapshot restore): idem.
- `src/components/MusicPlayer.tsx:308-311` (`onReady` do player YT, aplicando `pendingSeekRef.current`):
  ```ts
  if (pendingSeekRef.current !== null) {
      ytPlayerRef.current?.seekTo?.(pendingSeekRef.current, true);
      pendingSeekRef.current = null;
  }
  ```

Cada chamada de `seekTo(elapsed, true)` leva o YT a estado 3 (BUFFERING) antes de voltar para 1 (PLAYING). Se o caminho e re-executado com o mesmo `elapsed`, o player oscila indefinidamente.

### Pontos analogos sem idempotencia

- `pauseVideo()` / `stopVideo()` em `MusicPlayer.tsx:433-434` (delta), `:560-561` (bulk) e `:625-626` (`handleTrackChange`, GM-only): chamados sem consultar `getPlayerState()`.
- `playVideo()` em `MusicPlayer.tsx:312` (`onReady`) e `:707` (`forceYouTubeAudioUnlock`): chamados sem checar se o estado ja e `PLAYING` ou `BUFFERING`.

### Gatilhos candidatos (refinados em 2026-04-23 apos coleta pos-deploy)

`broadcastUpdate` so dispara em acoes discretas do GM (`MusicPlayer.tsx:631`, `:637`, `:643`, `:657`, `:667`, `:889`), entao o receiver **nao deveria** receber seeks em loop. Apos o deploy das stories 54 e 55, o loop original `1 <-> 3 <-> 1 <-> 3` **sumiu** em campo (ver `Registro de Campo - 2026-04-23 (pos-deploy)` abaixo). Ficou um residual `-1 -> 3 -> -1` num receiver que nao convergiu para `1` (PLAYING). As hipoteses foram re-avaliadas contra o codigo atual e o log novo:

**Hipoteses reduzidas (nao dominantes no log pos-deploy):**
- ~~Re-mount do portal do iframe~~ — log mostra apenas **um** `YT_NATIVE_READY`. Re-mount do portal em `MusicPlayer.tsx:910` geraria `onReady` duplicado e nao e o que se ve.
- ~~Ramo bulk sobrescrevendo delta~~ — `snapshotInitRef` e o flag `sawLiveMusicEventRef` em `MusicPlayer.tsx:511` hoje distinguem snapshot de delta, reduzindo essa chance. Nao e impossivel, mas fica como ultima carta.

**Hipoteses abertas (a discriminar via flag `debugMusicPlayer`):**
1. **`pauseVideo` / `stopVideo` vindo do `state-sync-effect` em `MusicPlayer.tsx:506`**, acionado por delta com `isPlaying === false` logo apos o `BUFFERING`. O guard do Passo 3 tem chance de marcar `pause-skipped`; se o log mostrar `pauseVideo` real com `reason: 'state-sync-effect'`, e esse o caminho.
2. **Cenario benigno: o GM ainda nao apertou play no momento da captura.** Com `playing === false` no estado global, `-1 -> 3 -> -1` e o YT passando por BUFFERING no `cue` e voltando para UNSTARTED. Nao e bug — apenas nao fecha a aceitacao sem o log estruturado. A distincao em relacao a (1) e que aqui **nao** havera nenhum call site de play/pause ativo no log do `logYt`, so transicoes nativas de estado.
3. **`YT_UNLOCK_APPLIED` em `MusicPlayer.tsx:713` reaplicando `playVideo` apos seek** — possivel, mas o guard do Passo 3 agora intercepta com `playVideo-skipped` se o estado ja e PLAYING/BUFFERING. Se o log mostrar `playVideo` real com `reason: 'unlock'` numa sequencia que reinicia `-1`, investigar este caminho.

Passo 1 (instrumentacao) continua sendo o gate para discriminar entre (1), (2) e (3). **Nao mudar comportamento antes de ter o log estruturado.** Uma decisao precipitada aqui — por exemplo, engrossar o guard de `pauseVideo` — pode mascarar o caso benigno (2) e introduzir regressao.

## Plano de Execucao

### Passo 1 — Instrumentacao (obrigatoria antes dos Passos 2-4)

Alvo: `src/components/MusicPlayer.tsx`.

1. Criar helper no topo do arquivo:
   ```ts
   function logYt(op: 'seekTo' | 'seekTo-skipped' | 'playVideo' | 'pauseVideo' | 'stopVideo',
                  reason: string,
                  data?: Record<string, unknown>) {
       if (process.env.NODE_ENV !== 'development' &&
           !(typeof window !== 'undefined' && window.localStorage?.getItem('debugMusicPlayer') === '1')) {
           return;
       }
       console.debug('[MusicPlayer/YT]', { op, reason, ...data });
   }
   ```
   - Early return antes de construir qualquer payload: overhead zero em producao sem flag.

2. Adicionar chamada a `logYt` em **todos os call sites** antes da operacao real:
   - `MusicPlayer.tsx:309` — `reason: 'on-ready-pending-seek'`, `data: { target, current: getCurrentTime() }`.
   - `MusicPlayer.tsx:312` — `op: 'playVideo'`, `reason: 'on-ready-was-playing'`.
   - `MusicPlayer.tsx:418-419` — `reason: 'delta-event'`, incluir `seq` do evento.
   - `MusicPlayer.tsx:433-434` — `op: 'pauseVideo' | 'stopVideo'`, `reason: 'delta-switch-to-audio'`.
   - `MusicPlayer.tsx:547-548` — `reason: 'bulk-restore'`, incluir `seq`.
   - `MusicPlayer.tsx:560-561` — `reason: 'bulk-switch-to-audio'`.
   - `MusicPlayer.tsx:625-626` — `reason: 'gm-track-change'`.
   - `MusicPlayer.tsx:707` — `op: 'playVideo'`, `reason: 'unlock'`.

3. Nao tocar em `YT_NATIVE_READY` (`:298`), `YT_NATIVE_STATE` (`:316`), `YT_UNLOCK_APPLIED` (`:713`). Eles ja sao estruturais e ajudam a correlacionar causa (call site) com efeito (transicao de estado).

**Checkpoint 1:** em preview, setar `localStorage.debugMusicPlayer = '1'`, abrir sessao como receiver, iniciar musica do YouTube pelo GM, gravar 30s de console. Anexar trecho ao fim desta story com o `reason` dominante identificado. Se nenhum `reason` aparecer repetidamente, investigar re-mount do portal antes de seguir.

### Passo 2 — Guard de drift em `seekTo`

Alvos: `MusicPlayer.tsx:309`, `:418-419`, `:547-548`.

1. Extrair helper privado:
   ```ts
   const YT_SEEK_EPSILON_SEC = 2;
   function seekYouTubeWithGuard(player: YT.Player | null, targetSec: number, reason: string): void {
       if (!player || typeof player.seekTo !== 'function') return;
       const current = typeof player.getCurrentTime === 'function' ? (player.getCurrentTime() || 0) : 0;
       if (Math.abs(current - targetSec) <= YT_SEEK_EPSILON_SEC) {
           logYt('seekTo-skipped', reason, { target: targetSec, current, delta: Math.abs(current - targetSec) });
           return;
       }
       logYt('seekTo', reason, { target: targetSec, current });
       player.seekTo(targetSec, true);
   }
   ```
2. Substituir as tres chamadas diretas de `seekTo` por `seekYouTubeWithGuard(...)`.
3. Epsilon = 2s espelha o ramo de audio local (`MusicPlayer.tsx:454`, `:574`) para consistencia.
4. Limpar `pendingSeekRef.current = null` **apos** a chamada do helper (mesmo no caminho skipped), para nao deixar pendente.

### Passo 3 — Guard de estado em `playVideo` / `pauseVideo` / `stopVideo`

Alvos: `MusicPlayer.tsx:312`, `:433-434`, `:560-561`, `:625-626`, `:707`.

1. Extrair helpers:
   ```ts
   function playYouTubeWithGuard(player: YT.Player | null, reason: string): void {
       if (!player || typeof player.playVideo !== 'function') return;
       const state = typeof player.getPlayerState === 'function' ? player.getPlayerState() : null;
       if (state === YT.PlayerState.PLAYING || state === YT.PlayerState.BUFFERING) {
           logYt('playVideo', reason + '-skipped', { state });
           return;
       }
       logYt('playVideo', reason, { state });
       player.playVideo();
   }

   function pauseYouTubeWithGuard(player: YT.Player | null, reason: string): void {
       if (!player || typeof player.pauseVideo !== 'function') return;
       const state = typeof player.getPlayerState === 'function' ? player.getPlayerState() : null;
       if (state === YT.PlayerState.PAUSED || state === YT.PlayerState.ENDED || state === YT.PlayerState.UNSTARTED) {
           logYt('pauseVideo', reason + '-skipped', { state });
           return;
       }
       logYt('pauseVideo', reason, { state });
       player.pauseVideo();
   }
   ```
2. Substituir todos os call sites listados.
3. `stopVideo` (`MusicPlayer.tsx:434`, `:561`, `:626`) pode continuar como esta se ja vier precedido de `pauseVideo` com guard. Em `handleTrackChange` (`:625-626`), o par `pauseVideo + stopVideo` e intencional para desmontar a faixa antes de trocar — manter os dois, ambos com log.

### Passo 4 — Consolidar ramos delta e bulk

Alvos: `MusicPlayer.tsx:401-428` (delta) e `:530-552` (bulk).

1. Extrair helper:
   ```ts
   function applyYouTubeRemoteState({
       url, playing, loop, startedAt, reason, seq
   }: {
       url: string; playing: boolean; loop: boolean;
       startedAt?: string; reason: 'delta-event' | 'bulk-restore'; seq?: number;
   }): void {
       // parar audio local, setar estado, aplicar seek com guard
   }
   ```
2. Substituir os dois ramos pela mesma chamada.
3. Elimina risco futuro de uma copia receber guard e a outra nao.
4. **Fora do escopo:** refatorar o ramo de audio; ele ja tem guard de drift e nao esta implicado no bug.

## Criterios de Aceitacao

- [x] Passo 1: `logYt` helper implementado com gate `NODE_ENV === 'development'` OU `localStorage.debugMusicPlayer === '1'`, com early return quando desligado.
- [x] Passo 1: **todos** os oito call sites listados instrumentados com `reason` identificavel.
- [ ] Passo 1: captura de console (receiver em preview, 30s de musica YT) anexada ao fim desta story, com o `reason` dominante identificado.
- [x] Passo 2: nenhuma chamada direta de `ytPlayerRef.current.seekTo` fora do helper `seekYouTubeWithGuard`.
- [ ] Passo 2: reproducao do cenario original nao produz mais `seekTo` repetido no log instrumentado (aparecem `seekTo-skipped` no lugar).
- [x] Passo 3: `playVideo` e `pauseVideo` sempre passam por helpers com guard de estado.
- [x] Passo 4: ramos delta e bulk chamam o mesmo `applyYouTubeRemoteState`.
- [x] `tsc --noEmit` passa.
- [x] `npm run build` passa.

### Nota de implementacao (2026-04-23)
- Build local validado apos limpeza de `.next` (houve erro inicial de artefatos concorrentes ao executar checks em paralelo).
- Validacoes funcionais em receiver real (preview/producao/celular) permanecem pendentes.

## Validacao Executada

- [ ] Cenario 1 — bootstrap (snapshot restore): entrar numa sessao que ja tem musica YT tocando. Receiver deve aplicar seek **uma vez** (ou zero, se dentro de epsilon) e ficar em estado 1 (PLAYING) estavel.
- [ ] Cenario 2 — GM troca faixa: receiver deve aplicar nova URL, dar play, e ficar em 1 estavel.
- [ ] Cenario 3 — GM pausa: receiver pausa sem transitar por BUFFERING.
- [ ] Cenario 4 — GM da play de novo: receiver volta para PLAYING sem loop.
- [ ] Cenario 5 — GM faz seek grande (> 2s) no player dele e re-emite: receiver aplica seek (ratificar que o guard nao bloqueia desvios reais).
- [ ] Cenario 6 — GM faz seek pequeno (< 2s): receiver **nao** aplica seek (log mostra `seekTo-skipped`).
- [ ] Validar em `cronosvtt.com`, nao so em preview Vercel.
- [ ] Receiver em celular: CPU subjetivamente mais estavel durante musica YT.

## Registro de Campo - 2026-04-23 (pos-deploy)

### Ambiente
- Receiver: jogadora em notebook (Windows / Chrome).
- Build: `layout-23e6337338b13369.js` / `page-cbf3e4b7d151e928.js`.
- Deploy: Vercel preview `crownvtt-ddewsuue5-daniels-projects-f6cc46bd.vercel.app`.

### Log bruto
```text
[SocketClient] WS_URL: https://api.cronosvtt.com
[Supabase] Cliente inicializado com sucesso.
[Home] Buscando sessoes...
[Home] Sessoes encontradas: 5
[EventStore] Inicializando sessao: 3d6b11d4 (forcado: false)
[EventStore] WebSocket connected, joining session: 3d6b11d4
[EventStore] Snapshot encontrado: seq 6983
[EventStore] 0 eventos carregados via NestJS.
www-widgetapi.js:210 Failed to execute 'postMessage' on 'DOMWindow':
  target origin 'https://www.youtube.com' does not match recipient origin 'vercel.app'
www-widgetapi.js:210 Failed to execute 'postMessage' on 'DOMWindow': (repeat)
[MusicPlayer] YT_NATIVE_READY
[MusicPlayer] YT_UNLOCK_APPLIED — reason=first-user-gesture
[MusicPlayer] YT_NATIVE_STATE: -1
[MusicPlayer] YT_NATIVE_STATE: 3
[MusicPlayer] YT_NATIVE_STATE: -1
[useDiceRoller] finishRoll eval
```

### O que melhorou (bug primario resolvido)
- **Loop `1 <-> 3 <-> 1 <-> 3 ...` desapareceu.** Era o sintoma primario desta story. Nao ha mais oscilacao perpetua PLAYING/BUFFERING.
- **`YT_NATIVE_READY` aparece uma unica vez.** Elimina a hipotese historica de re-mount do portal como causa.
- **`YT_UNLOCK_APPLIED` aparece uma unica vez** (`first-user-gesture`). Unlock nao esta sendo re-aplicado em cascata.

### O que sobra (caso residual)
- Transicao `YT_NATIVE_STATE: -1 -> 3 -> -1` (UNSTARTED -> BUFFERING -> UNSTARTED). Nao converge para `1` (PLAYING).
- **Este log foi coletado sem a flag `debugMusicPlayer` ligada.** Sem os eventos `[MusicPlayer/YT]` do helper `logYt` (`MusicPlayer.tsx:62`), nao da para discriminar entre as hipoteses 1, 2 e 3 listadas em `Gatilhos candidatos`.

### Proxima coleta obrigatoria (para fechar Cenario 1)

Executar **exatamente** nesta ordem, pela jogadora receiver (ou qualquer outro receiver reproduzivel):

1. Abrir a sessao no Chrome com DevTools aberto (Console).
2. No Console, rodar:
   ```js
   localStorage.setItem('debugMusicPlayer', '1');
   ```
3. Recarregar a pagina (F5). A flag e lida no momento do `logYt` — recarga garante que o primeiro tick ja esteja instrumentado.
4. Entrar na sessao. Aguardar o GM iniciar musica do YouTube (ou entrar numa sessao que ja tenha musica tocando, para validar bootstrap).
5. Capturar **30 segundos** de console a partir do `YT_NATIVE_READY`. Copiar tudo, inclusive os eventos prefixados `[MusicPlayer/YT]`.
6. Colar o trecho abaixo (em novo bloco `### Log capturado com debugMusicPlayer=1`).
7. Anotar **qual `reason` dominou** o log residual:
   - Se aparecer `pauseVideo` com `reason: 'state-sync-effect'` seguido de `-1` => hipotese 1 confirmada.
   - Se aparecer `playVideo` com `reason: 'unlock'` num ciclo => hipotese 3 confirmada.
   - Se **nao aparecer nenhuma chamada real de play/pause/seek** durante as transicoes -1 → 3 → -1, restando so eventos `-skipped` => hipotese 2 confirmada (cenario benigno: GM nao apertou play).

### Decisao condicional pos-coleta

- Se **hipotese 1**: reforcar o guard do `state-sync-effect` para ignorar delta com `isPlaying === false` quando o estado atual ja for `UNSTARTED` / `ENDED` (evitar `pauseVideo` inutil que transita por BUFFERING antes de UNSTARTED).
- Se **hipotese 2**: este caso nao e bug. Atualizar Cenario 1 de `Validacao Executada` para exigir que o GM **esteja** tocando musica no momento da entrada do receiver. Marcar `[x]`.
- Se **hipotese 3**: engrossar o guard em `MusicPlayer.tsx:713` para consultar `getPlayerState()` antes de `forceYouTubeAudioUnlock` chamar `playVideo`. Usar `playYouTubeWithGuard` (Passo 3 desta story) se ainda nao estiver sendo usado no caminho do unlock.

**Nao alterar comportamento antes da coleta.** Toda decisao nesta secao e condicional ao log estruturado.

### Ruido conhecido (ignorar)

- `Failed to execute 'postMessage' on 'DOMWindow'` do `www-widgetapi.js` e ruido do SDK do YouTube no handshake cross-origin entre iframe e origem Vercel. Nao e causa raiz. Aparece historicamente mesmo em casos que terminam em PLAYING estavel.

## Relacao com Outras Stories

- **Story 54** (performance geral): independente desta. Mesmo com todos os passos de 54 aplicados, o loop 1<->3 do receiver persistiria sem os guards aqui. Pode ser implementada em paralelo.
- Story 54 Passo 4 (logs em caminho quente) **nao deve remover** os logs estruturais `YT_NATIVE_READY` (`:298`), `YT_NATIVE_STATE` (`:316`) e `YT_UNLOCK_APPLIED` (`:713`) — eles sao baixa frequencia em operacao normal e sao o sinal mais barato de diagnostico para este bug. A telemetria nova desta story (Passo 1) tambem **nao deve** ser tratada como log quente por 54: ela ja vem gated por flag.

## Fora de Escopo

- Reescrever o ciclo de vida do iframe do YouTube (portal em `MusicPlayer.tsx:910`). Investigar apenas se o log do Passo 1 mostrar re-mount como gatilho dominante — nesse caso, abrir story separada.
- Sincronizacao fine-grained de taxa de play (drift < 2s). Tolerancia de 2s e aceitavel para musica ambiente.
- Suporte a playlists do YouTube (`list=`, `start_radio=1`). Ja canonizado em `normalizeYouTubeUrl` (`MusicPlayer.tsx:23`).
- Migrar o portal para um componente dedicado.

## Referencias

- Story 54 — performance geral (screen share, voz, FateDice3D, logs).
- Log da jogadora (incidente de 2026-04-23) — evidencia primaria do loop 1<->3.
- YouTube IFrame API — `PlayerState` codes: https://developers.google.com/youtube/iframe_api_reference#Playback_status
