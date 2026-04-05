---
title: "Story 26 - Bugfix: Jogadores sem áudio de Música, Atmosfera e Transmissão de Tela"
description: "Jogadores não ouvem nada do MusicPlayer, AtmosphericPlayer nem da transmissão de tela — apenas a chamada de voz WebRTC funciona. Root cause real: race condition load()+play(), não autoplay policy."
status: "aguardando teste"
priority: "crítica"
last_updated: 2026-04-05
tags: [audio, autoplay, webrtc, ui, eventsourcing]
related:
  - /knowledge/architecture.md
  - /stories/story-18-bugfix-voice-chat-visibilidade-e-audio-bidirecional.md
  - /stories/story-19-bugfix-transmissao-tela-otimizacao-conexoes-e-refresh.md
  - /stories/story-25-adicionar-opcao-tocar-link-youtube.md
---

# Story 26 — Bugfix: Jogadores sem áudio de Música, Atmosfera e Transmissão de Tela

## Problema

Jogadores conectados à sessão **não ouvem**:
- Músicas do `MusicPlayer` (tracks Supabase e YouTube)
- Ambiência do `AtmosphericPlayer`
- Áudio da transmissão de tela do Mestre (screen share)

Apenas o áudio da chamada de voz (WebRTC `VoiceChatPanel`) funciona normalmente.

---

## Diagnóstico Final (root cause real)

### ❌ Hipótese inicial descartada: Autoplay Policy pura
O diagnóstico inicial apontou para a política de autoplay do browser como causa. Essa hipótese levou à implementação do `AudioUnlockBanner` + `audioUnlockManager` — que **não resolveu o problema**.

### ✅ Root cause confirmado: Race condition `load()` + `play()`

Em ambos `MusicPlayer.tsx` e `AtmosphericPlayer.tsx`, o subscriber do `globalEventStore` executava:

```ts
audioRef.current.src = fullUrl;
audioRef.current.load();        // ← inicia fetch assíncrono
await audioRef.current?.play(); // ← browser lança ERRO
```

O browser lança `"The play() request was interrupted by a new call to load()"`. O `catch` rotulava isso como `"Autoplay blocked:"` — **mensagem enganosa que mascarou o bug real**.

**Por que o retry também falhou:** O `AudioUnlockBanner` disparava o retry, mas `load()` ainda estava em andamento → `play()` era interrompido de novo → silêncio persistente.

**Por que o GM funciona:** O evento otimista local do GM dispara `play()` em contexto de gesto de usuário, onde browsers são mais tolerantes ao race. Players recebem via Supabase Realtime (assíncrono), onde a race é fatal.

### Screen Share — diagnóstico secundário mantido
`useSessionScreenControl.ts`: fallback `videoEl.muted = true` ao falhar `play()`. O `audioUnlockManager.registerMutedVideo()` já registra o vídeo para desmutar no unlock. **Esse fluxo está correto e não precisou de alteração.**

---

## Implementação Realizada

### Fase 1 — Implementação inicial (parcialmente correta)
Arquivos criados/editados com base no diagnóstico de autoplay:

| Arquivo | O que foi feito |
|---|---|
| `src/components/AudioUnlockBanner.tsx` | **CRIADO** — banner para PLAYER, chama `audioUnlockManager.unlock()` |
| `src/lib/audio-unlock-manager.ts` | **CRIADO** — singleton com subscribe/unlock/registerMutedVideo |
| `src/components/MusicPlayer.tsx` | Adicionado `isPlayingRef`, subscriber do `audioUnlockManager` |
| `src/components/AtmosphericPlayer.tsx` | Idem MusicPlayer |
| `src/app/session/[id]/hooks/useSessionScreenControl.ts` | Adicionado `registerMutedVideo` e `unregisterVideo` |
| `src/app/session/[id]/page.tsx` | Montado `<AudioUnlockBanner userRole={userRole} />` |

### Fase 2 — Fix do root cause real (race condition load+play)
Após diagnóstico da race condition, aplicadas correções:

**`src/components/MusicPlayer.tsx`**
- Removido `audioRef.current.load()` do subscriber de `MUSIC_PLAYBACK_CHANGED`
- Retry do `audioUnlockManager` agora verifica `readyState >= HAVE_FUTURE_DATA` antes de tocar, ou aguarda evento `canplay`

**`src/components/AtmosphericPlayer.tsx`**
- Removido `audioRef.current.load()` do subscriber de `ATMOSPHERIC_PLAYBACK_CHANGED`
- Mesmo padrão de retry robusto com `readyState`/`canplay`

### Fase 3 — Fix definitivo: user gesture context + pending plays ✅
Fase 2 não resolveu. Diagnóstico revelou 3 bugs remanescentes:

1. **`await AudioContext.resume()` em `unlock()` quebrava o user gesture context**: Subscribers eram chamados DEPOIS do await — Firefox/Safari perdem user activation após o primeiro await, fazendo `play()` falhar novamente
2. **Sem fallback quando `play()` falha no subscriber de evento**: O erro era engolido silenciosamente e nunca retentado
3. **Banner clicado antes da música começar**: Subscribers disparavam mas `isPlayingRef` era `false` → nenhum efeito. Banner era dispensado permanentemente. Quando música começava depois, `play()` falhava sem retry

**`src/lib/audio-unlock-manager.ts`**
- `unlock()` agora é **síncrono** (não async) — subscribers e pending plays são processados ANTES de qualquer operação assíncrona, mantendo user gesture context
- `AudioContext.resume()` agora é fire-and-forget (não await)
- Novo mecanismo `registerPendingPlay(el)` / `unregisterPendingPlay(el)`: elementos cujo `play()` falhou são re-tentados automaticamente no próximo click/touchstart em qualquer lugar da página (document-level listener)

**`src/components/MusicPlayer.tsx`**
- Quando `play()` falha no subscriber de evento → chama `audioUnlockManager.registerPendingPlay(audioRef.current)` para retry no próximo gesto
- Quando `play()` falha no subscriber de unlock → idem
- Cleanup no unmount: `unregisterPendingPlay()`

**`src/components/AtmosphericPlayer.tsx`**
- Mesmo padrão de registerPendingPlay do MusicPlayer

**`src/components/AudioUnlockBanner.tsx`**
- `handleUnlock` agora é síncrono (não async) — não faz `await unlock()`, chama diretamente

---

## Arquivos Modificados (estado final)

| Arquivo | Status |
|---|---|
| `src/components/AudioUnlockBanner.tsx` | ✅ Criado — intacto |
| `src/lib/audio-unlock-manager.ts` | ✅ Editado — unlock síncrono + registerPendingPlay |
| `src/components/MusicPlayer.tsx` | ✅ Editado — `load()` removido + registerPendingPlay no catch |
| `src/components/AtmosphericPlayer.tsx` | ✅ Editado — idem MusicPlayer |
| `src/components/AudioUnlockBanner.tsx` | ✅ Editado — handleUnlock síncrono |
| `src/app/session/[id]/hooks/useSessionScreenControl.ts` | ✅ Editado — intacto |
| `src/app/session/[id]/page.tsx` | ✅ Editado — intacto |

---

## Critérios de Aceitação

- [ ] Jogador conectado ouve música que o GM inicia em tempo real
- [ ] Jogador conectado ouve atmosfera que o GM inicia em tempo real
- [ ] Jogador que entra após o GM ter iniciado música: ao clicar no banner, ouve a música em andamento
- [ ] Áudio da transmissão de tela chega com som para o jogador (sem mute)
- [ ] Banner some após o clique e não reaparece
- [ ] GM não vê o banner
- [ ] Se o GM pausou, o unlock não inicia reprodução — apenas prepara
- [ ] `VoiceChatPanel` continua funcionando sem regressão
- [ ] Console não exibe `"Autoplay blocked:"` para música/atmosfera em fluxo normal pós-banner

---

## Notas Técnicas

- `play()` em `<audio>` **já aciona loading interno** quando a `src` é nova. `load()` explícito só é necessário para abortar um fetch anterior ou pré-bufferizar sem tocar.
- O `audioUnlockManager` continua sendo necessário para o caso de jogadores que abrem a sessão diretamente via link (sem interação prévia na aba) — o banner garante user activation para o retry.
- O `AudioContext.resume()` no unlock é independente do `<audio>.play()`. São APIs separadas. O AudioContext não precisa estar ativo para `<audio>` tocar.
- A normalização `.trim().toLowerCase()` em `userId`/`actorUserId` está aplicada em todos os hooks modificados.
