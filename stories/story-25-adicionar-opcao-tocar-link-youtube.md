---
title: "Story 25 - Adicionar Opção de Tocar Link do YouTube"
description: "Criar uma opção no MusicPlayer para que o Mestre (GM) possa colar um link do YouTube e reproduzir seu áudio diretamente no sistema, sincronizando com todos os jogadores via Event Sourcing."
status: "concluído"
priority: "alta"
last_updated: 2026-04-05
tags: [ui, audio, youtube, react-player, eventsourcing]
related: []
---

# Story 25 - Adicionar Opção de Tocar Link do YouTube

## Objetivo
Atualmente o `MusicPlayer` reproduz apenas arquivos de áudio enviados para o storage do Supabase (bucket `campaign-uploads`). O objetivo desta tarefa é permitir que o Mestre (GM) possa simplesmente colar um link do YouTube e tocá-lo para todos os jogadores na sala.

## Estratégia de Implementação — Renderização Condicional (não substituição)

> **Princípio**: Manter `<audio>` para tracks do Supabase. Usar `ReactPlayer` condicionalmente apenas para URLs de YouTube. Não substituir a tag nativa.

### Helper de detecção
```ts
const isYouTubeUrl = (url: string) =>
  /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(url);
```

### Renderização dual
```tsx
{isYouTubeUrl(currentTrack)
  ? <ReactPlayer
      ref={reactPlayerRef}
      url={currentTrack}
      playing={isPlaying}
      loop={isLooping}
      volume={isMuted ? 0 : volume}
      width={0}
      height={0}
      onEnded={handleTrackEnded}
      onReady={() => { /* sync startedAt se necessário */ }}
      config={{ youtube: { playerVars: { controls: 0 } } }}
    />
  : <audio ref={audioRef} onEnded={handleTrackEnded} />
}
```

## Escopo Técnico

### 1. Entrada de Dados (GM only)
- Adicionar um campo de input text visível apenas para `userRole === "GM"`, ao lado dos selects de playlist.
- Botão "Tocar Link" que chama `handleTrackChange(youtubeUrl)`.

### 2. Guard no `getSupabaseUrl` (dois pontos de aplicação)
- **Subscriber** (`MusicPlayer.tsx`, evento `MUSIC_PLAYBACK_CHANGED`): antes de chamar `getSupabaseUrl(url)`, verificar `isYouTubeUrl(url)`. Se YouTube, usar a URL direta.
- **`broadcastUpdate`**: a URL do YouTube deve ser enviada tal qual no payload do evento (sem prefixar com bucket).

```ts
// No subscriber:
const fullUrl = isYouTubeUrl(url) ? url : getSupabaseUrl(url);

// No broadcastUpdate: nenhuma mudança necessária — já envia `url` crua.
```

### 3. Sincronia Temporal (`startedAt`)
- Para `<audio>`: manter lógica existente com `audioRef.current.currentTime` e `.duration`.
- Para `ReactPlayer`: usar `reactPlayerRef.current.getCurrentTime()` e `.getDuration()`.
- Extrair a lógica de cálculo de `startedAt` para um helper que recebe o ref ativo:

```ts
const getActiveCurrentTime = (): number => {
  if (isYouTubeUrl(currentTrack) && reactPlayerRef.current) {
    return reactPlayerRef.current.getCurrentTime();
  }
  return audioRef.current?.currentTime ?? 0;
};
```

### 4. Controles de Volume
- `<audio>`: manter `audioRef.current.volume = isMuted ? 0 : volume` (como hoje).
- `ReactPlayer`: controlado via props `volume` e `muted` — já reativo pelo React state.

### 5. `handleTrackEnded`
- Já funciona para ambos: `<audio>` usa `onEnded={handleTrackEnded}` no elemento, `ReactPlayer` usa a prop `onEnded`.
- Nenhuma mudança no corpo do callback.

### 6. Event Sourcing (Payload)
- O payload de `MUSIC_PLAYBACK_CHANGED` **não precisa de alteração**: `{ url, playing, loop, startedAt }`.
- A projeção em `projections.ts` salva apenas `url`, `loop`, `playing` — compatível sem mudanças.
- Opcional (qualidade): adicionar `source?: "supabase" | "youtube"` ao tipo em `domain.ts` para clareza semântica. Não é bloqueante.

## Arquivos Afetados
| Arquivo | Alteração |
|---|---|
| `src/components/MusicPlayer.tsx` | - Adicionar `import ReactPlayer from "react-player/youtube"`<br>- Criar `isYouTubeUrl()` helper<br>- Criar `reactPlayerRef` via `useRef`<br>- Renderizar `ReactPlayer` condicionalmente (YouTube) ao lado de `<audio>` (Supabase)<br>- Guard `isYouTubeUrl` no subscriber antes de `getSupabaseUrl`<br>- Adaptar `broadcastUpdate` para usar `getActiveCurrentTime()`<br>- Adicionar input de URL + botão "Tocar Link" (GM only) |
| `src/types/domain.ts` | (Opcional) Adicionar `source?: "supabase" \| "youtube"` ao payload de `MUSIC_PLAYBACK_CHANGED` |

## Critérios de Aceitação
- [x] O Mestre (GM) verá um campo para colar um link do YouTube no player de música.
- [x] Ao clicar em "Tocar Link", um evento `MUSIC_PLAYBACK_CHANGED` é disparado contendo a URL externa no payload.
- [x] As URLs do bucket do Supabase **não podem quebrar** com esta implementação — `<audio>` continua ativo para elas.
- [x] O áudio do vídeo do YouTube é reproduzido em modo oculto (`width=0 height=0`) em todos os clientes conectados.
- [x] Os controles de Mute, Volume, Play/Pause e Loop afetam a música do YouTube (via props reativas do `ReactPlayer`).
- [x] `startedAt` funciona para ambos os tipos de mídia (sincronia temporal ao entrar na sala).
- [x] Ao avançar a faixa ou ao terminar (`onEnded`), o comportamento de loop e next track funciona para ambos.
- [x] Import otimizado: `react-player/youtube` (não o bundle completo) para reduzir bundle size.
