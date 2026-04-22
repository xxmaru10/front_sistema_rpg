---
title: "Story 46 - Performance Mobile, Voz Travando e Identidade Trocada no Voice Chat"
description: "Três bugs reportados por jogadores: (1) site pesado/travando no celular, (2) jogador no mobile não é ouvido apesar de aparecer no voice, (3) jogador entra como Kzar mas aparece como Lina Clark na mesa Quimeras."
priority: "crítica"
status: "proposta"
last_updated: "2026-04-22"
tags: [bugfix, performance, mobile, voice-chat, webrtc, identidade, presença]
epic: epic-01-refatoracao-modular
---

# Story 46 - Performance Mobile, Voz Travando e Identidade Trocada no Voice Chat

## Contexto

Três bugs críticos reportados por múltiplos jogadores em sessões reais. Todos afetam diretamente a experiência de jogo, com ênfase em dispositivos móveis.

---

## Bug 1 — Site pesado / travando no celular

### Descrição
Ao entrar pelo celular, o site trava muito — vários jogadores reportaram a mesma experiência. A interface fica lenta, com input lag perceptível e scrolls engasgados.

### Causa Raiz Provável (Análise)

O `page.tsx` da sessão (1048 linhas) monta simultaneamente múltiplos subsistemas pesados, **todos ativos independentemente da aba visível**:

1. **`VoiceChatPanel`** — cria `VoiceChatManager` + polling de speaking a cada 300ms (`setInterval`) + `computeState()` completo para resolver nomes de personagens (reprojeção toda da timeline apenas para exibir nomes no painel de voz).
2. **`FateDice3D`** — componente Three.js com simulação de física 3D carregado via `dynamic()` mas sempre montado quando `diceVisible` é true; em mobile, o WebGL render loop consome GPU significativa.
3. **`AtmosphericEffects`** — partículas CSS/Canvas renderizadas em modo combate.
4. **Projeção duplicada** — `page.tsx` faz `computeState()` em `_earlyState` (L173-190), e o `VoiceChatPanel` faz outra `computeState()` independente (L147-164). Cada evento novo aciona duas projeções completas.
5. **Múltiplos `useEffect` com timers** — heartbeat de voz (30s), polling de speaking (300ms), detecção de fala local (contínua via `analyser`), heartbeat de presença.
6. **`backgroundAttachment: fixed`** — no modo combate, o body recebe `background-attachment: fixed` que causa repaint contínuo em mobile (Chromium issue conhecido).
7. **Event subscribers ativos em todas as abas** — `globalEventStore.subscribe()` no `VoiceChatPanel` dispara setState a cada evento, independentemente da aba ativa.

### Solução Proposta

#### Fase 1 — Otimizações de baixo risco (sem refatoração estrutural)
- **Eliminar `background-attachment: fixed` em mobile**: detectar via media query e usar `background-attachment: scroll` (ou removê-lo totalmente em `max-width: 768px`).
- **Desmontar `AtmosphericEffects` em mobile**: renderização condicional baseada em `isMobileNav` (já disponível no `page.tsx`).
- **Throttle do polling de speaking**: aumentar intervalo de 300ms para 500ms em mobile (detectado por `isMobileNav`).
- **Guard de `computeState` no VoiceChatPanel**: mover resolução de nomes para uma consulta direta ao `state.characters` do `page.tsx` passado via prop, eliminando a segunda projeção completa.

#### Fase 2 — Otimizações estruturais (se Fase 1 for insuficiente)
- **Lazy mount do Three.js**: desmontar `FateDice3D` quando `!diceVisible` em vez de apenas ocultar.
- **Debounce do event subscriber no VoiceChatPanel**: trocar `subscribe` por leitura snapshot periódica (a cada 2s) em vez de reativa.

---

## Bug 2 — Jogador no mobile não é ouvido (áudio unidirecional)

### Descrição
Um jogador entra no voice chat pelo celular. Ele **aparece corretamente** no canal de voz para todos os participantes, mas **ninguém consegue ouvi-lo**. O jogador consegue ouvir os demais normalmente — o problema é exclusivamente o áudio de saída do mobile para os peers.

### Causa Raiz Provável (Análise)

1. **`getUserMedia` com constraints restritivas em mobile**: `getPreferredAudioConstraints()` solicita `noiseSuppression: true`, `autoGainControl: true`, `echoCancellation: true` simultaneamente. Em devices mobile (especialmente Android com Chrome), a combinação pode falhar silenciosamente — o browser retorna um stream com track de áudio **mutado de fábrica** ou com nível extremamente baixo.

2. **Bluetooth HFP auto-avoidance em mobile**: `resolveInputDeviceId()` e `tryUpgradeFromBluetoothStream()` podem estar descartando o único microfone disponível em mobile (ex: fone Bluetooth conectado) e tentando usar um fallback inexistente, resultando em stream sem áudio real.

3. **`AudioContext` suspended sem resume em mobile**: Safari/Chrome mobile exigem gesto do usuário para `AudioContext.resume()`. O `joinVoice()` faz `audioCtx.resume()` mas o timing pode não ter gesto ativo — resultando em `localAudioContext.state === 'suspended'`, o que impede o `localGainNode` de processar áudio.

4. **Track `enabled = false` sem feedback visual**: Se `setMicMuted(false)` não alcançar o track correto (ex: após `getBestEffortMicStream` trocar o stream por upgrade), o track pode ficar disabled sem o UI refletir.

5. **Offer/Answer sem codec comum**: Em mobile, a negociação SDP pode não encontrar Opus entre os codecs disponíveis (o `setCodecPreferences` referenciado em architecture.md pode falhar silenciosamente em mobile Safari).

### Solução Proposta

- **Adicionar guarda de stream health**: após `getUserMedia`, verificar `track.readyState === 'live'` e `track.enabled === true`. Se não, logar warning e tentar fallback com `{ audio: true }` simples.
- **Remover auto-avoidance de Bluetooth em mobile**: em dispositivos móveis (`isMobile` detection via `navigator.maxTouchPoints > 0` ou `ontouchstart`), respeitar o device solicitado sem override automático (o jogador mobile conecta exatamente o mic que tem).
- **Forçar `AudioContext.resume()` no gesto de "Entrar no Voice"**: mover o resume para dentro do handler de click do botão (já é assim, mas adicionar retry com 500ms se `state` permanecer `suspended`).
- **Log detalhado de estado do track + sender**: Após `addTrack` e `createOffer/createAnswer`, logar `sender.track?.readyState`, `sender.track?.enabled`, `sender.track?.muted` para diagnóstico.

---

## Bug 3 — Identidade trocada no Voice Chat (Kzar aparece como Lina Clark)

### Descrição
Na mesa **Quimeras**, um jogador entra como o personagem **Kzar**, mas no painel de voz aparece como **Lina Clark** (outro personagem da mesma mesa). A identidade visual (nome e possivelmente retrato) está trocada.

### Causa Raiz Provável (Análise)

O fluxo de resolução de identidade no voice chat tem três camadas de fallback, e o bug pode ocorrer em qualquer uma:

1. **`characterId` stale no cache do backend** (`events.gateway.ts` L94-103): O backend faz merge de presença com `existing?.characterId` — se o jogador entrou antes com Lina Clark e reconectou com Kzar, o backend pode reter o `characterId` antigo porque o `voice-presence` com o novo ID não chegou a tempo (race condition entre `initialize()` e `updateCharacterId()`).

2. **`lastKnownCharacterIdRef` stale no VoiceChatPanel** (L237-247): O cache local de characterId por userId no panel persiste o último ID conhecido. Se o jogador trocou de personagem entre sessões (ou abriu link sem `?c=`), o cache retém o stale.

3. **Fallback por `ownerUserId` matching errado** (L474-481): Quando `characterId` é `undefined`, o código busca personagem por `norm(c.ownerUserId) === uidNorm || norm(c.name) === uidNorm`. Se o `ownerUserId` do jogador coincidir com **múltiplos personagens** (ex: o jogador possui tanto Kzar quanto Lina Clark na mesma mesa), o `find()` retorna o **primeiro** na iteração de `Object.values(state.characters)` — que pode ser Lina Clark por ordem de inserção no objeto.

4. **`characterId` undefined no mount** (VoiceChatPanel L251): O manager é criado com `characterId` prop que pode ser `undefined` no primeiro render (assincronicidade do `searchParams.get("c")`). O `updateCharacterId` effect (L410-414) atualiza depois, mas a primeira emissão de `voice-presence` já foi com `characterId: undefined`, e o backend pode ter cacheado essa presença.

### Solução Proposta

- **Backend: não retornar `existing?.characterId` se o novo `data.characterId` for explícito** (`events.gateway.ts` L101): Se `data.characterId` está presente e definido, deve **sempre** sobrescrever o `existing?.characterId`, nunca fazer merge com null-coalescing (`??`).
- **Frontend: filtrar múltiplos personagens do mesmo owner**: No fallback por `ownerUserId` (VoiceChatPanel L474-481), quando houver múltiplos personagens do mesmo owner, priorizar o personagem com `activeInArena === true` ou o último criado (`createdAt` mais recente), em vez do primeiro encontrado pelo `find()`.
- **Frontend: limpar `lastKnownCharacterIdRef` ao trocar de sessão**: Adicionar cleanup no effect de `sessionId` para evitar vazamento entre mesas.
- **Frontend: atrasar primeira emissão de presence**: No `initialize()`, aguardar até `characterId` estar definido (ou até 500ms max) antes de emitir `voice-presence`, evitando presença sem identidade.

---

## Arquivos Afetados

| Arquivo | Bug(s) | Alterações Previstas |
|---|---|---|
| `src/app/session/[id]/page.tsx` | 1 | Remover `background-attachment: fixed` em mobile via useEffect; passar `state.characters` como prop para VoiceChatPanel; condicionar AtmosphericEffects em `!isMobileNav` |
| `src/app/session/[id]/session.css` | 1 | Media query `@media (max-width: 768px)` para `background-attachment: scroll` e redução de partículas |
| `src/components/VoiceChatPanel.tsx` | 1, 2, 3 | Eliminar `computeState()` interno (usar prop); throttle de speaking poll em mobile; limpar `lastKnownCharacterIdRef` ao trocar sessão; melhorar fallback de characterId multi-owner |
| `src/lib/VoiceChatManager.ts` | 2 | Adicionar guarda de stream health pós-getUserMedia; desabilitar Bluetooth auto-avoidance em mobile; reforçar AudioContext resume; logging de track state |
| `back_sistema_rpg/src/events/events.gateway.ts` | 3 | Corrigir merge de `characterId` na presença para não reter IDs stale via null-coalescing |

---

## Critérios de Aceitação

### Bug 1 — Performance Mobile
- [ ] O site carrega e navega sem travamento perceptível em dispositivos Android mid-range (4GB RAM).
- [ ] `background-attachment: fixed` não é aplicado em viewports ≤768px.
- [ ] `AtmosphericEffects` não é renderizado em mobile (ou renderiza versão reduzida).
- [ ] O `VoiceChatPanel` **não** executa `computeState()` próprio; usa estado derivado do `page.tsx`.
- [ ] O polling de speaking em mobile opera a ≥500ms de intervalo.

### Bug 2 — Áudio Mobile Unidirecional
- [ ] Jogador em dispositivo mobile consegue **ser ouvido** por todos os participantes após entrar no voice.
- [ ] Se o `getUserMedia` retornar track com `readyState !== 'live'`, o sistema tenta fallback com `{ audio: true }` simples.
- [ ] Em mobile, o Bluetooth auto-avoidance é desabilitado (respeita device do sistema).
- [ ] O `AudioContext` é garantidamente `running` antes de emitir `voice-join`.
- [ ] Console exibe log do estado do track (`readyState`, `enabled`, `label`) após captura.

### Bug 3 — Identidade Trocada
- [ ] Na mesa Quimeras, jogador que entra como Kzar aparece como **Kzar** (e não Lina Clark) no painel de voz.
- [ ] Backend sobrescreve `characterId` na presença quando o novo valor é explícito (`!== undefined`).
- [ ] `lastKnownCharacterIdRef` é limpo ao trocar de sessão (`sessionId`).
- [ ] Quando há múltiplos personagens do mesmo owner, o fallback prioriza `activeInArena` ou `fixedCharacterId`.
- [ ] A identidade no voice está correta após reconexão (F5, troca de aba, softReconnect).

---

## Não-Escopo

- Migração de topologia mesh para SFU.
- Refatoração completa do `page.tsx` (apenas otimizações cirúrgicas).
- Suporte a iOS Safari (foco em Android Chrome, que é o device reportado).
- Alterações no schema de eventos ou domain.ts.
- Performance de desktop (foco exclusivo em mobile).

---

## Notas Técnicas

- **Projeção duplicada**: O `VoiceChatPanel` atualmente faz `computeState()` próprio nos L147-164 apenas para acessar `state.characters`. Este é o item de maior impacto de performance — remover e passar como prop elimina ~50% do custo computacional por evento.
- **`background-attachment: fixed` em mobile**: Chromium aplica compositing layer separada para fixed backgrounds, forçando repaint do body inteiro a cada scroll. Remover em mobile é o fix de maior retorno por menor risco.
- **Bluetooth em mobile**: A lógica de auto-avoidance (L210-244, L247-284) foi desenhada para desktop com headsets; em mobile, o mic do sistema já é o correto e a troca automática causa falha silenciosa.
- **Gateway presence merge** (`events.gateway.ts` L101): A linha `characterId: data.characterId ?? existing?.characterId` usa null-coalescing, o que preserva o ID antigo quando o novo é `undefined`. Isso é correto para updates parciais (heartbeat), mas incorreto quando o jogador troca de personagem e o `?c=` é lido assincronamente.
