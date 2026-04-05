---
title: "Story 26 - Bugfix: Jogadores sem áudio de Música, Atmosfera e Transmissão de Tela"
description: "Jogadores não ouvem nada do MusicPlayer, AtmosphericPlayer nem da transmissão de tela — apenas a chamada de voz WebRTC funciona. Causa: política de autoplay do browser bloqueando .play() sem gesto do usuário."
status: "aguardando aprovação"
priority: "crítica"
last_updated: 2026-04-05
tags: [audio, autoplay, webrtc, ui, eventsourcing, estável]
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

## Diagnóstico (root cause)

### 1. MusicPlayer — Autoplay Policy (`MusicPlayer.tsx`)
O subscriber do `globalEventStore` chama `audioRef.current?.play()` diretamente em resposta a um evento WebSocket. O browser **não reconhece isso como gesto do usuário** e bloqueia a reprodução silenciosamente:
```
console.warn("Autoplay blocked:", e)  // linha ~201
```
O `ReactPlayer` (YouTube) também fica em estado `playing=true` via prop, mas o browser pode bloquear igualmente sem interação prévia.

### 2. AtmosphericPlayer — Mesmo padrão (`AtmosphericPlayer.tsx`)
Idêntico ao MusicPlayer:
```
console.warn("Atmospheric Autoplay blocked:", e)  // linha ~133
```

### 3. Screen Share — Fallback silencia o vídeo (`useSessionScreenControl.ts`)
Quando `videoEl.play()` falha (autoplay bloqueado), o hook executa um fallback que **muta o vídeo**:
```ts
videoEl.muted = true;  // linha ~102
```
O jogador vê a transmissão mas sem áudio — e não há mecanismo para desmutar depois.

### Por que o VoiceChat funciona?
O `VoiceChatPanel` conecta à chamada de voz somente após clique explícito do usuário ("Entrar na Chamada"), satisfazendo a política de autoplay do browser. Os outros players não têm esse gatilho.

---

## Escopo

### O que está **dentro** do escopo
- Implementar mecanismo de desbloqueio de áudio (`AudioUnlockBanner`)
- Tratar o fallback muted do screen share vídeo
- Garantir que, após o unlock, o estado de áudio mais recente (música + atmosfera) seja retocado

### O que está **fora** do escopo
- Refatoração dos controles de volume/mute do GM
- Qualquer alteração no WebRTC de voz (`voice-chat-manager.ts`)
- Alterações no backend/NestJS

---

## Estratégia de Implementação

### Componente `AudioUnlockBanner`
Um banner não-modal, fixado no canto inferior da tela, visível **somente para jogadores** (`userRole === "PLAYER"`) enquanto o áudio da sessão ainda não foi desbloqueado.

```
[ 🔇 Clique aqui para ativar o áudio da sessão ]
```

Ao clicar:
1. Cria e resume um `AudioContext` para desbloquear a Web Audio API do browser
2. Chama `audioUnlockManager.unlock()` — dispatcha um evento interno para que `MusicPlayer` e `AtmosphericPlayer` tentem `.play()` novamente com o estado atual
3. Remove `muted` do elemento `<video>` do screen share e toca
4. Oculta o banner permanentemente na sessão (via `useRef`)

### Fluxo de retry nos players
Ambos `MusicPlayer` e `AtmosphericPlayer` devem escutar um novo evento interno `AUDIO_UNLOCK_REQUESTED`. Quando recebido, se `isPlaying === true` no estado atual, tentam `.play()` novamente.

```ts
// Dentro do subscriber existente (sem novo useEffect):
} else if (event.type === "AUDIO_UNLOCK_REQUESTED") {
    if (isPlayingRef.current && audioRef.current?.src) {
        audioRef.current.play().catch(e => console.warn("Retry play blocked:", e));
    }
}
```

### Screen Share — remover muted após unlock
Em `useSessionScreenControl.ts`, após o fallback `muted = true`, registrar o elemento de vídeo no `audioUnlockManager`. No unlock, o manager chama `videoEl.muted = false` e `videoEl.play()`.

---

## Arquivos Afetados

| Arquivo | Tipo de Alteração |
|---|---|
| `src/components/AudioUnlockBanner.tsx` | **CRIAR** — banner com botão de unlock, visível apenas para PLAYER |
| `src/lib/audio-unlock-manager.ts` | **CRIAR** — singleton que gerencia estado de unlock e notifica subscribers |
| `src/components/MusicPlayer.tsx` | **EDITAR** — adicionar handler para `AUDIO_UNLOCK_REQUESTED` no subscriber existente; exportar ref de `isPlayingRef` para retry |
| `src/components/AtmosphericPlayer.tsx` | **EDITAR** — idem MusicPlayer |
| `src/app/session/[id]/hooks/useSessionScreenControl.ts` | **EDITAR** — registrar `videoEl` no `audioUnlockManager` ao fazer fallback muted; desmutar no unlock |
| `src/app/session/[id]/page.tsx` | **EDITAR** — montar `<AudioUnlockBanner>` na sessão passando `userRole` |

---

## Critérios de Aceitação

- [ ] Jogador vê o banner "🔇 Clique aqui para ativar o áudio da sessão" ao entrar na sala
- [ ] Após clicar no banner, o áudio que o GM está tocando no `MusicPlayer` começa a reproduzir no cliente do jogador
- [ ] Após clicar no banner, a ambiência do `AtmosphericPlayer` começa a reproduzir no cliente do jogador
- [ ] Após clicar no banner, o áudio da transmissão de tela do Mestre é ouvido pelo jogador (sem mute)
- [ ] O banner some após o clique e **não reaparece** durante a sessão
- [ ] O GM **não vê** o banner (ele já é o emissor dos eventos)
- [ ] Se o áudio estiver pausado (GM pausou), o unlock não inicia reprodução — apenas prepara o desbloqueio
- [ ] Se o jogador clicar no banner **antes** de qualquer música estar tocando, ao iniciar uma música depois ela toca imediatamente (sem necessidade de segundo clique)
- [ ] O `VoiceChatPanel` (WebRTC voz) continua funcionando sem regressão
- [ ] Sem novos erros no console além dos warnings já existentes de autoplay

---

## Notas Técnicas

- `AUDIO_UNLOCK_REQUESTED` é um evento **local** (não persistido no Event Store, não enviado ao backend). Deve ser disparado via `globalEventStore.dispatchLocal()` ou equivalente — verificar se o store já suporta eventos locais; caso não suporte, usar um `EventEmitter` simples no `audio-unlock-manager.ts`.
- O `AudioContext` deve ser criado **uma única vez** (singleton) para evitar o aviso "AudioContext was not allowed to start" em múltiplos creates.
- Para o `ReactPlayer` (YouTube), o desbloqueio é feito indiretamente: ReactPlayer respeita `playing={true}` após o primeiro gesto do usuário. Nenhuma ação extra necessária além do `AudioContext.resume()`.
- A normalização de `userId` (`.trim().toLowerCase()`) deve ser mantida nas alterações feitas nos hooks existentes, conforme convenções.
