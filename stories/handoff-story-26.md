---
title: "Handoff — Story 26"
type: handoff
last_updated: 2026-04-05
for: próxima sessão de IA
---

# Handoff — Story 26: Bugfix Áudio de Jogadores

## Estado atual

A Story 26 está **aguardando teste pelo usuário** (Fase 3 aplicada). Todo o código foi escrito e aplicado. Build TypeScript limpo.

---

## O que foi feito nesta sessão (Fase 3)

### Diagnóstico dos bugs remanescentes

A Fase 2 (remoção de `load()`) não resolveu. Análise profunda do fluxo completo revelou **3 bugs**:

1. **`await AudioContext.resume()` quebrava user gesture context**: `unlock()` era async e fazia `await` antes de notificar subscribers. Firefox/Safari perdem user activation após o primeiro await → `play()` falhava nos subscribers mesmo com gesto do usuário.

2. **Sem fallback quando `play()` falha no subscriber de evento**: O `catch` apenas logava "Autoplay blocked:" e não retentava. Quando o evento Realtime chegava (sem gesto de usuário) e `play()` falhava, o áudio ficava silenciado permanentemente.

3. **Banner dispensado antes da música começar**: Se o jogador clicava o banner antes do GM iniciar música, os subscribers verificavam `isPlayingRef.current === false` e não faziam nada. O banner era dispensado (`dismissedRef = true`) e nunca mais aparecia. Quando a música começava depois, `play()` falhava sem mecanismo de retry.

### Fixes aplicados

**`src/lib/audio-unlock-manager.ts`**
- `unlock()` agora é **síncrono** (void, não async) — subscribers e pending plays são processados SINCRONAMENTE no contexto do click handler, antes de qualquer operação assíncrona
- `AudioContext.resume()` é fire-and-forget (`.catch()`, não await)
- Novo mecanismo **`registerPendingPlay(el)`**: elementos cujo `play()` falhou são registrados numa fila. Um listener de `click`/`touchstart` no `document` (capture phase) retenta todos os pending plays no próximo gesto do usuário, QUALQUER gesto, não só o banner
- `unregisterPendingPlay(el)` para cleanup no unmount

**`src/components/MusicPlayer.tsx`**
- Subscriber de evento: `catch` do `play()` agora chama `audioUnlockManager.registerPendingPlay(audioRef.current)`
- Subscriber de unlock: idem no catch
- Cleanup no `useEffect` return: `unregisterPendingPlay()`

**`src/components/AtmosphericPlayer.tsx`**
- Mesmo padrão do MusicPlayer

**`src/components/AudioUnlockBanner.tsx`**
- `handleUnlock` agora é síncrono (não async, sem await)

---

## Fluxo corrigido (cenário típico)

1. Jogador abre sessão → banner aparece
2. **Cenário A**: Jogador clica banner ANTES da música → `unlock()` dispara subscribers (nada a tocar), banner some → GM inicia música → evento chega → `play()` pode falhar → `registerPendingPlay(el)` → jogador clica em QUALQUER coisa → `play()` retenta com user gesture → funciona
3. **Cenário B**: GM já tocando música → jogador clica banner → `unlock()` dispara subscribers → `play()` executado SINCRONAMENTE no click → funciona

---

## Próximo passo

**Aguardar confirmação do usuário** de que o áudio está funcionando para jogadores.

Se o problema persistir:

1. **Abrir console do jogador** — procurar logs `[MusicPlayer] play() blocked:` ou `[AudioUnlockManager] Pending play retry failed:`. Se aparecer erro diferente de `NotAllowedError` (ex: 404, CORS, NetworkError), o problema é a URL do Supabase.

2. **Verificar se o evento chega** — no console, deve aparecer `setCurrentTrack` sendo chamado (ou adicionar `console.log` no subscriber). Se não aparecer nada, o canal Supabase Realtime não está conectado.

3. **Verificar se o pending play retenta** — clicar em qualquer lugar da página após a música falhar. Se o log `Pending play retry failed` aparecer com erro diferente de `NotAllowedError`, investigar a causa.

---

## Arquivos obrigatórios para carregar

```
1. front_sistema_rpg/AI.md
2. front_sistema_rpg/knowledge/architecture.md
3. front_sistema_rpg/knowledge/conventions.md
4. front_sistema_rpg/stories/story-26-bugfix-jogadores-sem-audio-musica-atmosfera-transmissao.md
```

Se necessário investigar código:
```
5. front_sistema_rpg/src/lib/audio-unlock-manager.ts
6. front_sistema_rpg/src/components/MusicPlayer.tsx
7. front_sistema_rpg/src/components/AtmosphericPlayer.tsx
8. front_sistema_rpg/src/components/AudioUnlockBanner.tsx
9. front_sistema_rpg/src/app/session/[id]/hooks/useSessionScreenControl.ts
```

---

## Resumo técnico dos arquivos modificados (Fase 3)

| Arquivo | Mudança-chave |
|---|---|
| `src/lib/audio-unlock-manager.ts` | `unlock()` síncrono; `registerPendingPlay` + document listener |
| `src/components/MusicPlayer.tsx` | `registerPendingPlay` no catch de play() |
| `src/components/AtmosphericPlayer.tsx` | Idem |
| `src/components/AudioUnlockBanner.tsx` | `handleUnlock` síncrono (sem await) |

---

## Restrições de escopo

- **Não alterar** `voice-chat-manager.ts` nem `VoiceChatPanel.tsx`
- **Não alterar** backend/NestJS
- **Não tocar** no `eventStore.ts`
- Qualquer alteração cross-file deve ser registrada em `/knowledge/architecture.md`
