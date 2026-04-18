---
title: "Story 41 - Bugfix: Voice Chat — Estabilidade da Chamada, Qualidade de Áudio e Conflito com MusicPlayer"
description: "Corrigir três bugs críticos de voz: desaparecimento de peers após eventos de screen share, degradação de áudio ao usar VLC, e MusicPlayer silenciado durante chamada de voz."
priority: "crítica"
status: "em_andamento"
last_updated: "2026-04-13"
tags: [bugfix, voice-chat, webrtc, audio, screenshare, music-player]
epic: epic-01-refatoracao-modular
---

# Story 41 - Bugfix: Voice Chat — Estabilidade da Chamada, Qualidade de Áudio e Conflito com MusicPlayer

## Contexto

Três bugs distintos foram reportados em sessão de jogo real, todos relacionados ao subsistema de voz (`VoiceChatManager` + `VoiceChatPanel`). Os bugs impactam diretamente a experiência de jogo e têm causas raiz técnicas identificáveis.

---

## Bug 1 — Peers desaparecem do Voice Chat após reiniciar Screen Share

### Descrição
Após reiniciar o compartilhamento de tela, **todos os jogadores desapareceram simultaneamente** do painel de voz. A chamada se torna invisível para todos mas, na prática, pode ainda estar ativa no estado interno — ou os peers genuinamente se desconectam.

### Causa Raiz Suspeita
O `VoiceChatPanel` usa `refreshKey` como dependência no `useEffect` que cria e destrói o `VoiceChatManager` (linha 271 do `VoiceChatPanel.tsx`). Quando algo dispara `setRefreshKey(prev => prev + 1)` — como o handler de restart do screen share — o cleanup do effect chama `mgr.disconnect()`, destruindo **todas** as peer connections WebRTC ativas.

O screen share e o voice são operações independentes; reiniciar um não deveria afetar o outro. O ciclo de vida do manager está acoplado indevidamente ao `refreshKey` que também é usado para outras ações de "refresh".

### Solução Proposta
Separar o `refreshKey` de voz (`voiceRefreshKey`) do `refreshKey` genérico. O voice só deve ser recriado quando o usuário explicitamente solicita reset de voz — não quando o screen share é reiniciado. O manager deve sobreviver a qualquer evento de UI ou screen share.

---

## Bug 2 — Degradação de áudio ao tocar VLC durante transmissão

### Descrição
Ao reproduzir um vídeo no VLC enquanto o compartilhamento de tela estava ativo, **o áudio da chamada caiu de qualidade rapidamente** para todos os participantes.

### Causa Raiz Suspeita
O `VoiceChatManager` cria um `AudioContext` por peer (`getPeerAudioContext`) com `latencyHint: 'interactive'`. Quando o VLC é iniciado, ele pode disputar o dispositivo de áudio do sistema ou alterar a taxa de amostragem (sample rate) do hardware. Com múltiplos `AudioContext` ativos (um por peer), o browser pode ficar em conflito com o driver de áudio do SO, causando degradação de qualidade (crackling, distorção, queda de sample rate).

Adicionalmente, se o screen share captura o áudio do sistema (`getDisplayMedia` com `audio: true`), o VLC pode ser capturado e realimentado em loopback através dos peers, multiplicando o sinal e causando artefatos.

### Solução Proposta
1. Consolidar os `AudioContext` por peer em **um único `AudioContext` compartilhado** (ao invés de um por peer). Isso reduz a pressão sobre o driver de áudio.
2. Verificar se o `getDisplayMedia` está solicitando `audio: true` para screen share e, se sim, garantir que o loopback guard (`suppressPeerPlaybackForScreenShare`) cubra também o stream do VLC quando ativo.

---

## Bug 3 — MusicPlayer silenciado para jogadora no Voice Chat

### Descrição
Uma jogadora **deixou de ouvir as músicas** do MusicPlayer ao entrar no voice chat. Ao sair do voice, voltou a ouvir normalmente. Os outros participantes não foram afetados.

### Causa Raiz Suspeita
O `VoiceChatPanel` tenta mudar o dispositivo de saída dos `HTMLAudioElement` de peers via `setSinkId(audioOutputDeviceId)`. Se o `audioOutputDeviceId` salvo no `localStorage` apontar para um dispositivo inválido ou diferente do padrão do sistema, o `setSinkId` pode falhar silenciosamente ou redirecionar o áudio para um sink que não existe, incluindo indiretamente os `<audio>` elements criados pelo `MusicPlayer`.

Alternativamente, a criação de múltiplos `AudioContext` pelo manager pode atingir o limite de contexts simultâneos do browser, causando suspensão/falha de contextos criados por outros módulos (como o MusicPlayer, caso use `AudioContext` internamente via `react-player`).

### Solução Proposta
1. Isolar o `setSinkId` dos audio elements do voice para que **nunca interfira** com audio elements fora do scope do `VoiceChatManager`.
2. Adicionar log de erro ao falhar `setSinkId` para facilitar diagnóstico futuro.
3. Garantir que o `MusicPlayer` não seja afetado pelo limite de `AudioContext` — preferir reutilizar o `AudioContext` do manager ao invés de criar novos.

---

## Arquivos Afetados

| Arquivo | Alterações Previstas |
|---|---|
| `src/components/VoiceChatPanel.tsx` | Separar `voiceRefreshKey` do `refreshKey` genérico; garantir que screen share não dispare recriação do manager |
| `src/lib/VoiceChatManager.ts` | Consolidar AudioContexts por peer em um único context compartilhado; isolar `setSinkId`; melhorar loopback guard |

---

## Critérios de Aceitação

### Bug 1
- [ ] Reiniciar o compartilhamento de tela **não** desconecta os peers do voice chat.
- [ ] O voice chat permanece ativo após qualquer ação de screen share (iniciar, parar, reiniciar).
- [ ] O voice só é desconectado quando o usuário clica em "Sair da Chamada" ou reseta a página.

### Bug 2
- [ ] Tocar um vídeo no VLC (ou qualquer app externo) durante a transmissão **não degrada** a qualidade de áudio da chamada.
- [ ] Há no máximo **1 `AudioContext`** ativo no `VoiceChatManager` por instância (não um por peer).

### Bug 3
- [ ] Jogadoras (e todos os participantes) **continuam ouvindo as músicas** do MusicPlayer enquanto estão no voice chat.
- [ ] Entrar e sair do voice chat não silencia nem restaura o MusicPlayer de forma inesperada.
- [ ] `setSinkId` de peers do voice não afeta audio elements externos ao manager.

---

## Notas Técnicas

- O `VoiceChatManager` já possui `attachScreenShareLoopbackGuard()` / `detachScreenShareLoopbackGuard()` para tratar o duck de áudio durante screen share — este mecanismo deve ser preservado e apenas expandido.
- O `lastKnownCharacterIdRef` e o `updateCharacterId` (fixes de Story 30) devem ser mantidos intactos.
- Qualquer refatoração deve ser cirúrgica e não alterar o comportamento de sinalização WebRTC existente.
