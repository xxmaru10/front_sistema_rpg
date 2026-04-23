---
title: "Story 54 - Performance Geral: Transmissao, Voz e Render travando CPU em 100%"
description: "Site atinge 100 por cento de uso de CPU e trava em celulares e notebooks fracos; durante transmissao, o problema se agrava ate travar o PC inteiro do transmissor. Plano em cinco passos sequenciais com checkpoint de medicao apos cada passo."
priority: "critica"
status: "em-revisao"
last_updated: "2026-04-23"
related: ["story-55-musicplayer-receiver-youtube-idempotencia"]
tags: [performance, webrtc, screenshare, voice-chat, three-js, cpu, bugfix]
epic: epic-01-refatoracao-modular
---

# Story 54 - Performance Geral: Transmissao, Voz e Render travando CPU em 100%

## Problema Reportado

> "Site esta atingindo 100 por cento do uso de CPU, travando muito em celulares e notebooks mais fracos e se estiver em transmissao pode atingir 100 por cento de uso e travar todo o computador."

Evidencia central: `logs_travamento_geral_site.txt` mostra uma sessao de 5 participantes com voz mesh ativa, musica do YouTube e tela compartilhada. No log aparecem multiplos `YT_MOUNT` para a mesma URL, reconexoes por `visibilitychange` e trafego WebRTC normal. A combinacao soma varias fontes de custo contante de CPU; durante transmissao o encoder da captura vira o gargalo dominante.

## Diagnostico (validado em duas rodadas de analise independentes)

### Causa raiz (durante transmissao)
`screen-share-manager.ts` pede captura em `1920x1080 ideal`, `2560x1440 max`, `30-60 fps`, com `contentHint = 'detail'`, e em `setParameters` **deleta** `maxFramerate` e aplica `degradationPreference = 'maintain-resolution'`. Em maquina fraca, isso significa manter resolucao cheia a qualquer custo, sacrificando CPU e FPS. O proprio broadcaster vira o pior caso.

### Custos continuos (sempre ativos enquanto a call esta conectada)
- Voz em topologia mesh: 1 `RTCPeerConnection` por peer; com 5 participantes, cada cliente carrega 4 encodes/decodes simultaneos.
- Analisadores de fala: `setInterval(250ms)` local em `VoiceChatManager.startLocalSpeakingDetection` e um por peer em `VoiceChatManager.startPeerSpeakingDetection`, ambos com `fftSize = 512`.
- Poll do `VoiceChatPanel` a 300ms (desktop) / 500ms (mobile) chamando `setPeers` com comparacao fraca (threshold 0.05 em `audioLevel`), forcando re-render continuo do painel.

### Amplificadores
- `console.log` em caminhos quentes: `VoiceChatManager.sendSignal`, `screen-share-manager.sendSignal`.
- Handler de `visibilitychange` em `useSessionScreenControl` loga em todo foco de aba (debounce so protege o reconnect, nao o log).
- `FateDice3D` via `useFateDiceSimulation` mantem rAF 60fps mesmo em `phase === 'idle'` enquanto `isVisible` estiver ativo e nao ha guard para `document.hidden`.
- Os logs `YT_NATIVE_STATE` (`MusicPlayer.tsx:316`) podem aparecer em alta frequencia em cenarios de bug do receiver (loop `PLAYING <-> BUFFERING`). **Isso nao e um log ruidoso por natureza** — e uma consequencia de bug de idempotencia no sync do YouTube, tratado separadamente em **story 55**. Nao silenciar este log aqui.

### Hipotese de build stale (a validar)
O log mostra URL `m.youtube.com/...&list=...&pp=...` intacta, mas o `normalizeYouTubeUrl` em `MusicPlayer.tsx:23` deveria ter canonizado para `https://www.youtube.com/watch?v=ID`. O build local atual (`.next`) tem hashes diferentes de `layout-1fdb04bea1e6f960.js` que aparece no log. Isso prova "log != build local atual", mas nao fecha "producao atrasada" - isso depende de verificacao do hash servido em `cronosvtt.com`.

## Plano de Execucao (ordem fixa, com checkpoint apos cada passo)

### Passo 1 - Pacote de Transmissao
Alvo: `src/lib/screen-share-manager.ts`.

> **Estado atual do codigo (abril 2026):** revisao em `screen-share-manager.ts:415-424` mostra que parte deste passo ja esta aplicada no broadcaster: `params.encodings[0].maxFramerate = this.qualityTier === '720p' ? 24 : 30`, `setDegradationPreference('balanced')` e um `qualityTier` adaptativo (720p/1080p). O que ainda precisa de verificacao formal: os constraints de `getDisplayMedia` (faixa de ~120-145) e a decisao documentada sobre `contentHint = 'detail'`. O **Registro de Campo** mais abaixo foi coletado **com essa implementacao parcial ja em vigor**, portanto os numeros de CPU (~15-20%) nao constituem baseline puro e nao fecham o Checkpoint 1 formal.

- `getDisplayMedia` passa a pedir `{ width: { ideal: 1920, max: 1920 }, height: { ideal: 1080, max: 1080 }, frameRate: { ideal: 30, max: 30 } }` como base.
- Recolocar `params.encodings[0].maxFramerate = 30` no sender (remover o `delete` em `screen-share-manager.ts:401`).
- Trocar `setDegradationPreference('maintain-resolution')` por `'balanced'`.
- Revisar `contentHint = 'detail'` (linha 143) - manter apenas se a nitidez de mapa/texto compensar o custo extra de encode; caso contrario remover.

**Checkpoint 1 (obrigatorio antes de avancar):** medir CPU e FPS em uma maquina fraca com `chrome://webrtc-internals` aberto, durante 30s de transmissao com 3+ participantes. Comparar antes/depois.

### Passo 2 - Auto-Downgrade 1080p -> 720p (sticky)
Alvo: `src/lib/screen-share-manager.ts`.

- Polling de `getStats()` a cada 3-5s durante a transmissao.
- Sinais de pressao, em cascata de precedencia:
  1. `RTCOutboundRtpStreamStats.qualityLimitationReason === 'cpu'` sustentado por 8-10s.
  2. (fallback) `framesPerSecond` < 18 sustentado por 8-10s.
  3. (fallback) `framesDropped / framesEncoded` > 0.15.
- Agregar entre peers: basta um reportar `cpu` para contar, ja que o encoder e compartilhado.
- Ao disparar: `videoTrack.applyConstraints({ width: 1280, height: 720, frameRate: { max: 24 } })` e marcar `hasDowngraded = true`.
- Sticky por sessao de share: nao re-sobe automaticamente.
- Persistir o tier final em `localStorage` (chave `screenshare_tier`); proxima transmissao abre direto em 720p se a maquina nao aguentou da ultima vez.
- UI: badge "Qualidade reduzida para 720p" + botao "Tentar 1080p" que limpa o flag sticky e o `localStorage`.

**Checkpoint 2:** repetir medicao. Confirmar que o downgrade dispara em maquina fraca e que o botao de override volta a 1080p.

### Passo 3 - Voz: analisadores e poll
Alvos: `src/lib/VoiceChatManager.ts`, `src/components/VoiceChatPanel.tsx`.

- Analisadores de fala: 250ms -> 400ms em desktop, 600ms em mobile.
- Pausar analisadores de peers mutados (`peerMuted.get(peerId) === true`).
- Tirar `setPeers` do poll em `VoiceChatPanel.tsx:249-262`. Mover `speaking` e `audioLevel` para um ref/store separado, consumido so pelos avatares (`useSyncExternalStore` por peer). Elimina re-render do painel a cada tick.
- Se possivel, trocar `setLocalSpeaking` / `setLocalAudioLevel` / `setAudioStatus` pelo mesmo store, mantendo o painel estatico entre aberturas.

### Passo 4 - Logs em caminho quente
Alvos:
- `src/lib/VoiceChatManager.ts:541` (`sendSignal`): remover ou reduzir a log condicional (ex. so em `NODE_ENV === 'development'`).
- `src/lib/screen-share-manager.ts:105` (`sendSignal`): idem.
- `src/app/session/[id]/hooks/useSessionScreenControl.ts:247`: remover o log de `visibilitychange` (manter so o comportamento).

> **Nao mexer em logs do `MusicPlayer`.** Os logs `YT_NATIVE_READY` (`MusicPlayer.tsx:298`), `YT_NATIVE_STATE` (`MusicPlayer.tsx:316`) e `YT_UNLOCK_APPLIED` (`MusicPlayer.tsx:713`) sao baixa frequencia em operacao normal e sao o sinal mais barato para diagnosticar o bug tratado na story 55. A instrumentacao nova que a story 55 adiciona ja vem gated por flag (`localStorage.debugMusicPlayer === '1'`). Esta story nao toca em nada de `MusicPlayer`.

### Passo 5 - Guard no FateDice3D
Alvo: `src/hooks/useFateDiceSimulation.ts`.

- Guard no `animate()` em `useFateDiceSimulation.ts:572`: se `document.hidden`, `return` sem chamar `requestAnimationFrame` ate `visibilitychange`.
- Em `phase === 'idle'`: throttle para ~30fps OU skip render quando nada visual mudou (monitorar `die.pos.y` delta < epsilon).
- Listener de `visibilitychange` interno ao hook para religar o loop quando a aba volta.

### Passo 6 - Telemetria e Circuit Breaker do Screen Share (blocker de revisao)

Contexto: a secao "Analise Tecnica" deste documento identificou um loop `create -> addTrack -> safety-timeout -> recreate` para um peer especifico. Revisao de codigo confirmou que **tres caminhos independentes** podem recriar a conexao do mesmo peer no broadcaster, e nenhum deles consulta um breaker global:
- Safety timeout em `screen-share-manager.ts:337` fecha a conexao stuck e chama `createPeerConnection(peerId)` novamente.
- `onconnectionstatechange` em `failed`/`disconnected` (`screen-share-manager.ts:373-388`) agenda outra recriacao com backoff linear (`3000 * (attempts + 1)`).
- `peer-join` entrante em `screen-share-manager.ts:266-283` abre nova conexao sem consultar contadores de tentativa.

`MAX_RECONNECT_ATTEMPTS` cobre apenas os dois primeiros caminhos (compartilham `this.reconnectAttempts[peerId]`); o terceiro caminho ignora totalmente esse contador, entao heartbeat do receiver, refocus de aba (`useSessionScreenControl.ts:250`) ou reconnect manual (`screen-share-manager.ts:552`) reabrem o ciclo indefinidamente.

Este passo e dividido em **duas fases sequenciais**. **Fase A (telemetria) vem antes da Fase B (breaker)**: o breaker sozinho mascara a causa raiz; sem saber onde a negociacao trava, a correcao ficaria cega e poderia esconder bug consertavel.

#### Fase A - Telemetria estruturada

Alvo: `src/lib/screen-share-manager.ts`.

1. Criar helper `logPeerEvent({ peerId, attemptId, role, stage, data })` no topo do arquivo (ou em modulo auxiliar):
   - `peerId: string` - id do peer alvo da operacao.
   - `attemptId: number` - contador local incrementado a cada chamada de `createPeerConnection(peerId)`.
   - `role: 'broadcaster' | 'receiver'` - lado que esta emitindo o log.
   - `stage: string` - um dos estagios listados no item 3.
   - `data?: Record<string, unknown>` - payload opcional com campos relevantes (ex: `connectionState`, `iceConnectionState`, `signalingState`, `lastKnownState`, `origin`, `reason`).
   - Saida: `console.debug('[SS-TELEMETRY]', { peerId, attemptId, role, stage, ...data })`.
   - **So emite se** `process.env.NODE_ENV === 'development'` **OU** `typeof window !== 'undefined' && window.localStorage?.getItem('debugScreenShare') === '1'`.
   - **Early return** antes de construir qualquer objeto quando desligado. Em producao com flag off, overhead deve ser zero (nao montar strings, nao acessar `pc.connectionState` etc.).

2. `attemptId` por peer:
   - Adicionar `private attemptCounters: Map<string, number>` na classe `ScreenShareManager`.
   - Em `createPeerConnection(peerId)`, no topo do metodo, incrementar e ler: `const attemptId = (this.attemptCounters.get(peerId) ?? 0) + 1; this.attemptCounters.set(peerId, attemptId);`.
   - Propagar esse `attemptId` via closure para **todos os callbacks daquele ciclo** (`onicecandidate`, `ontrack`, `oniceconnectionstatechange`, `onconnectionstatechange`, e o `setTimeout` do safety).
   - Se um callback de uma tentativa antiga disparar apos a conexao ter sido substituida, o log ainda deve carregar o `attemptId` original para correlacao.

3. Estagios a instrumentar (transicoes e marcos; **nao** cada `ice-candidate`):
   - `createPeerConnection` - inicio da criacao; `data` inclui `prevExistingState` se havia `existingPc`.
   - `offer-created` / `offer-sent` / `offer-received` (conforme o lado).
   - `remote-description-set` - apos `setRemoteDescription` resolver.
   - `answer-created` / `answer-sent` (no receiver).
   - `ice-connection-state-change` - `data` inclui `iceConnectionState` novo.
   - `connection-state-change` - `data` inclui `connectionState` novo.
   - `safety-timeout` - **obrigatorio** incluir `lastConnectionState`, `lastIceConnectionState`, `lastSignalingState` observados no momento do fechamento. **Este e o sinal mais importante do diagnostico**: determina se o peer travou em `new` (problema de offer/answer) ou em `connecting` (problema de ICE).
   - `reconnect-scheduled` - `data` inclui `origin` (`'safety-timeout'` | `'state-change-failed'` | `'peer-join'`), `delayMs`, `attempt` atual.
   - `peer-join-ignored-by-breaker` - emitido pelo breaker da Fase B.

4. **Nao logar** eventos de alta frequencia:
   - Nao logar cada `ice-candidate` individual (pode gerar dezenas por segundo).
   - Em `ontrack`, logar apenas o primeiro de cada `kind` por `attemptId`.

#### Fase B - Circuit Breaker por peer

Alvos:
- `src/lib/screen-share-manager.ts` (logica do breaker).
- Consumidor do manager (`src/app/session/[id]/hooks/useSessionScreenControl.ts` ou o componente que monta o `ScreenShareManager`) - integracao de UI.

Pre-requisito: Fase A concluida **e** ao menos uma reproducao do caso gravada (deve existir no log estruturado o `lastConnectionState` em que o peer problema trava). Sem essa evidencia, nao aplicar Fase B.

1. Estado do breaker na classe `ScreenShareManager`:
   - `private peerFailureState: Map<string, { failures: number; blockedUntil: number; hardStopped: boolean }>`.
   - Valores iniciais por peer: `{ failures: 0, blockedUntil: 0, hardStopped: false }` (criados sob demanda).
   - Constantes privadas: `private static readonly BREAKER_COOLDOWN_MS = 30_000; private static readonly BREAKER_SOFT_THRESHOLD = 3; private static readonly BREAKER_HARD_THRESHOLD = 5;`.

2. `private isPeerBlocked(peerId: string): boolean`:
   - Retorna `true` se `hardStopped === true` OU `Date.now() < blockedUntil`.
   - Caso contrario, `false`.

3. `private recordPeerFailure(peerId: string, origin: 'safety-timeout' | 'state-change-failed'): void`:
   - Incrementa `failures`.
   - Se `failures >= BREAKER_HARD_THRESHOLD`: seta `hardStopped = true` e chama `this.config.onPeerHardStopped?.(peerId)`.
   - Caso contrario, se `failures >= BREAKER_SOFT_THRESHOLD`: seta `blockedUntil = Date.now() + BREAKER_COOLDOWN_MS`.
   - Emitir `logPeerEvent` com `stage: 'reconnect-scheduled'` ou evento dedicado de hard stop, com `origin` no payload.

4. `private clearPeerFailure(peerId: string): void`:
   - Chamado no handler de `connectionState === 'connected'` (ja existe em `screen-share-manager.ts:389-392`, anexar ao bloco).
   - Reseta `{ failures: 0, blockedUntil: 0, hardStopped: false }`.

5. `public retryPeer(peerId: string): void`:
   - Chamado pela UI quando o usuario clica "tentar novamente" no toast/badge.
   - Reseta `peerFailureState` daquele peer e `this.attemptCounters` (opcional) daquele peer.
   - Se `isBroadcaster` e `localStream` ativo, chama `createPeerConnection(peerId)`.
   - Caso contrario (receiver), envia `peer-join` novamente.

6. Integracao nos tres caminhos:
   - **Safety timeout** (bloco em `screen-share-manager.ts:337-354`): **antes** de chamar `createPeerConnection` novamente, verificar `isPeerBlocked(peerId)`. Se bloqueado, emitir `logPeerEvent({ stage: 'peer-join-ignored-by-breaker', data: { origin: 'safety-timeout' } })` e sair sem recriar. Chamar `recordPeerFailure(peerId, 'safety-timeout')` imediatamente apos fechar a conexao stuck (antes da decisao de reconectar).
   - **`onconnectionstatechange` failed/disconnected** (bloco em `screen-share-manager.ts:373-388`): chamar `recordPeerFailure(peerId, 'state-change-failed')` ao entrar em `failed` ou `disconnected`, **apenas se** veio de `connecting`/`connected` (para evitar double-count com safety-timeout que ja contou). Antes do `setTimeout` de reconexao, consultar `isPeerBlocked(peerId)` e pular o reconnect se bloqueado.
   - **`peer-join` entrante** (bloco em `screen-share-manager.ts:266-283`): se `isBroadcaster` e `isPeerBlocked(peerId)`, emitir `peer-join-ignored-by-breaker` com `origin: 'peer-join'` e `return` sem criar conexao.

7. UI para hard stop:
   - Adicionar campo opcional `onPeerHardStopped?: (peerId: string) => void` na config/construtor do `ScreenShareManager`.
   - Em `useSessionScreenControl` (ou consumidor equivalente), assinar o callback e exibir toast/badge no broadcaster: `"Conexao com {peerId} falhou repetidamente. Clique para tentar novamente."`.
   - Botao no toast chama `screenShareManager.retryPeer(peerId)`.

8. Escopo e limites:
   - Breaker e **por sessao de share**: encerrar a transmissao e reabrir limpa `peerFailureState`.
   - Breaker vive **apenas no broadcaster**; receiver continua respondendo a `peer-join` e `stream-started` como antes.
   - Breaker **nao se aplica ao `VoiceChatManager` nesta fase**, mesmo com o Registro de Campo de 2026-04-23 (segunda coleta) mostrando que a voz exibe a Modalidade 2 (`connected` -> `disconnected` -> `Safety timeout` -> recriacao, ate `Max reconnect attempts reached`) para os mesmos peers e simultaneamente ao screen share. Motivo: nao espelhar breaker antes da telemetria da Fase A atribuir causa. Se a Fase A confirmar que o churn de voz tem a mesma raiz do screen share, abrir **Fase C (breaker espelhado em `VoiceChatManager`)** como extensao desta story - nao nova story.

#### O que NAO fazer neste passo

- Nao alterar `isHealthyConnectionState` sem evidencia da Fase A. A mudanca atual nessa funcao pode mascarar o bug real.
- Nao remover o safety timeout existente. Continua como defesa contra travas; passa so a respeitar o breaker antes de recriar.
- Nao reduzir `MAX_RECONNECT_ATTEMPTS`. O breaker e aditivo, nao substituto.
- Nao aplicar o breaker em `VoiceChatManager`.
- Nao promover a telemetria a `console.log` em producao. Deve permanecer em `console.debug` e so com flag ligada.

## Pre-requisito Operacional (antes do Passo 1)

Validar se producao esta com bundle antigo. Dois caminhos:
1. Abrir `cronosvtt.com` em aba anonima, DevTools Network, checar o hash do `layout-*.js` servido e comparar com o build atual.
2. Redeployar o commit atual e observar se `YT_MOUNT` (apos o Passo 4) ou equivalente passa a logar URL canonica `www.youtube.com/watch?v=ID`.

Se producao estiver atrasada, um redeploy pode ja reduzir parte do problema - e evita ajustar contra evidencia vazia.

## Medicao e Validacao

### Restricao de hardware

So estao disponiveis **3 dispositivos simultaneos** para teste, todos em maos do proprio dono da mesa:
- **PC (Windows)** - sera sempre o broadcaster (compartilha tela) e o ponto de medicao principal.
- **Tablet** - receiver.
- **Celular** - receiver.

Isso significa uma mesh de 3 clientes: cada cliente carrega **2 peer connections de voz** (contra 4 no cenario real de 5 participantes). Os numeros medidos aqui serao um **limite inferior** do custo real em sessao cheia - um cenario que passa no teste com folga tem mais margem para aguentar 5 pessoas; um cenario que ja trava com 3 nao vai melhorar com mais gente.

### Setup padrao de medicao

Executar antes de cada checkpoint, para manter os cenarios comparaveis:

1. **PC (broadcaster):**
   - Abrir a sessao de teste em Chrome.
   - Em outra aba: `chrome://webrtc-internals`.
   - Abrir Gerenciador de Tarefas do Windows em Ctrl+Shift+Esc, aba "Processos", ordenar por CPU.
   - Entrar no voice chat.
   - Iniciar musica do YouTube (usar a mesma URL em todos os checkpoints).
   - Iniciar transmissao (tela inteira, nao aba).
2. **Tablet:** abrir a mesma sessao em Chrome, entrar no voice, consumir a transmissao.
3. **Celular:** abrir a mesma sessao em Chrome, entrar no voice, consumir a transmissao.
4. Deixar tudo rodando por **30 segundos** antes de comecar a capturar.

### Metricas a capturar

**No PC (broadcaster) - a mais importante:**
- `chrome://webrtc-internals` > procurar o `RTCPeerConnection` de screen share (tem track de video). Dentro dele, `outbound-rtp (video)`:
  - `framesPerSecond` (target: >= 24)
  - `qualityLimitationReason` (target: `none` ou `bandwidth`; `cpu` e sinal de alerta)
  - `framesEncoded` e `framesDropped` (calcular razao; target: dropped/encoded < 0.05)
  - `totalEncodeTime` / `framesEncoded` (tempo medio por frame; target: < 20ms)
- Gerenciador de Tarefas: CPU % total do processo do Chrome durante 30s (anotar pico e media aproximada).

**No tablet e celular:**
- Subjetivo: UI responde a toque? Video da transmissao fluido? Audio sem cortes?
- Se Android com Chrome: habilitar remote debug e ler `framesDecoded` / `framesDropped` do `inbound-rtp (video)`. Se iOS: medicao se limita ao subjetivo.

### Procedimento por checkpoint

#### Baseline (antes de qualquer mudanca)
Rodar o setup padrao. Anotar todas as metricas acima. Esta e a **linha de base** contra a qual tudo sera comparado.

Resultado esperado no estado atual (hipotese): CPU PC >= 70%, `qualityLimitationReason = 'cpu'` aparece, FPS cai abaixo de 20, tablet/celular possivelmente com micro-travas.

#### Checkpoint 1 - apos Passo 1 (Transmissao)
Repetir o setup padrao. Comparar:
- CPU PC deve cair sensivelmente (target: reducao >= 20 pontos percentuais).
- FPS deve estabilizar em >= 28.
- `qualityLimitationReason` deve sair de `cpu` para `none` ou `bandwidth`.

**Gate:** so avancar para o Passo 2 se a reducao de CPU for clara. Se nao houver mudanca, investigar antes de continuar (pode ser build stale, ou os constraints nao foram honrados pelo navegador).

#### Checkpoint 2 - apos Passo 2 (Auto-Downgrade)
Dois sub-testes:

**2a - Downgrade automatico:**
- Forcar pressao de CPU no PC: abrir mais abas pesadas (ex: 3 videos 4K paralelos em outras abas) ou usar um notebook mais fraco se disponivel.
- Iniciar transmissao em 1080p.
- Esperar 10-15s. Verificar:
  - `qualityLimitationReason` sustenta `cpu` por 8-10s.
  - Codigo dispara `applyConstraints` baixando para 720p@24.
  - Badge "Qualidade reduzida para 720p" aparece na UI.
  - `chrome://webrtc-internals` mostra `frameWidth = 1280`, `frameHeight = 720` no outbound-rtp.
  - CPU do PC cai apos o downgrade.

**2b - Override manual e persistencia:**
- Clicar em "Tentar 1080p". Verificar que o badge some e a resolucao volta.
- Encerrar a transmissao. Reabrir. Verificar que abre em 1080p (flag sticky foi limpa pelo override).
- Repetir downgrade automatico. Encerrar sem clicar override.
- Reabrir transmissao. Verificar que ja abre em 720p (persistido em `localStorage`).

#### Checkpoint 3 - apos Passo 3 (Voz)
Foco em nao-regressao + ganho subjetivo:
- Confirmar que avatares ainda pulsam quando alguem fala (speaking detection).
- Confirmar que indicador de nivel de audio ainda anima.
- Com voz ativa + musica + transmissao, CPU PC deve cair mais alguns pontos em relacao ao Checkpoint 1.
- Tablet e celular devem ficar visivelmente mais fluidos (teste subjetivo de scroll e toques).

#### Checkpoint 4 - apos Passo 4 (Logs)
Foco em redução de ruido + nao-regressao:
- Abrir DevTools no PC. Iniciar voz, musica, transmissao.
- Console deve ficar significativamente mais limpo.
- Nenhum `YT_MOUNT`, nenhum `Sending signal` por tick, nenhum `Visibility visible, checking connection`.
- Funcionalidade intacta (voz, musica, transmissao seguem funcionando).

#### Checkpoint 5 - apos Passo 5 (Three.js)
- Abrir a caixa de dados 3D. Deixar em `phase === 'idle'` (dados flutuando).
- Trocar para outra aba por 10s. Voltar. Verificar que dados continuam animando normalmente.
- Com DevTools > Performance, gravar 5s com a caixa aberta em idle. Frame rate do rAF deve estar em <= 30fps.
- Com a aba oculta (outra aba em foco), `requestAnimationFrame` nao deve estar sendo agendado (verificar em DevTools > Performance).
- Com a caixa fechada (`isVisible = false`), comportamento inalterado em relacao a hoje.

#### Checkpoint 6 - apos Passo 6 (Telemetria + Breaker)

**Sub-teste 6a - Telemetria ativa vs desligada:**
- Setar `localStorage.debugScreenShare = '1'` no broadcaster e em um receiver.
- Rodar setup padrao (3 clientes, voz + YouTube + transmissao).
- Validar no console: eventos prefixados `[SS-TELEMETRY]` com campos `peerId`, `attemptId`, `role`, `stage`.
- Remover a flag (`localStorage.removeItem('debugScreenShare')`). Fazer reload. Console deve ficar silencioso para telemetria do screen share em producao.

**Sub-teste 6b - Captura do `lastConnectionState` do peer problema (duas modalidades):**
- Com telemetria ligada, reproduzir (ou aguardar) cada uma das duas modalidades observadas em campo:
  - **Modalidade 1 (negociacao inicial falha):** peer nao completa offer/answer/ice; trava em `new` ou `connecting`. Observada na primeira coleta com `lina clark / bellatrix`.
  - **Modalidade 2 (instabilidade pos-conexao):** peer completa negociacao (passa por `connected`) e depois cai para `disconnected` ou `failed`, disparando `scheduleReconnect` -> nova `createPeerConnection` -> novo `safety-timeout`. Observada na segunda coleta com `salomao castaigne / ben ya hu` e `elara malisorn - el-varnis`, **simultaneamente em `ScreenShareManager` e `VoiceChatManager`**.
- No log do `safety-timeout`, registrar `lastConnectionState`, `lastIceConnectionState` e `lastSignalingState` **para cada modalidade separadamente**.
- Documentar no final desta story (ou em `story-54-medicoes.md`) o estado observado por modalidade. Esse e o insumo para decidir:
  - se `isHealthyConnectionState` precisa follow-up dedicado;
  - se o breaker deve ter criterios distintos entre Modalidade 1 e 2 (ex: contador mais tolerante para pos-conexao, ja que ICE pode cair por motivos transientes de rede);
  - se a Fase C (breaker espelhado em `VoiceChatManager`) e necessaria - ver item 8 da Fase B.

**Sub-teste 6c - Breaker em peer com falha induzida:**
- Simular peer com falha persistente: desativar rede de um cliente via DevTools > Network > Offline durante a negociacao, ou bloquear UDP por firewall local.
- Observar: apos 3 falhas consecutivas, proximos `peer-join` do mesmo peer devem emitir `peer-join-ignored-by-breaker` no log.
- Apos 5 falhas totais, UI exibe toast/badge de retry manual.
- Click em retry limpa estado e permite nova tentativa.

**Sub-teste 6d - Nao-regressao em peer saudavel:**
- Peer que conecta normalmente **nao** deve receber `peer-join-ignored-by-breaker` em momento algum.
- Log deve mostrar `connection-state-change` chegando em `connected` e `clearPeerFailure` zerando contadores.
- Voz (`VoiceChatManager`) permanece funcionando sem alteracao de comportamento.

**Gate final da story 54:** so promover para `concluido` quando:
1. Sub-teste 6b capturou e documentou o `lastConnectionState` do peer que travou em campo.
2. Sub-teste 6c provou que o breaker bloqueia o churn.
3. Sub-teste 6d provou nao-regressao em peer saudavel.
4. Checkpoints 1-5 formalmente registrados (baseline + pos) em Chrome puro, nao Helium.

### Formato de registro da medicao

Cada checkpoint gera uma entrada no final desta story (ou em arquivo anexo `story-54-medicoes.md`), no formato:

```
## Checkpoint N - AAAA-MM-DD

Cenario: [baseline | apos passo X]
PC: [modelo / CPU / RAM]
Build: [commit hash]

Metricas PC (broadcaster):
- CPU % (pico / media): __ / __
- FPS encoder: __
- qualityLimitationReason: __
- framesDropped / framesEncoded: __ / __
- totalEncodeTime medio por frame: __ ms

Observacao tablet: __
Observacao celular: __

Decisao: [avancar | investigar antes de avancar]
```

## Fora de Escopo

- Migracao de topologia mesh para SFU (mediasoup, LiveKit). Registrado como follow-up de medio prazo para sessoes com mais de 6 participantes.
- Refatoracao geral de `VoiceChatManager` ou `screen-share-manager`.
- Suporte dedicado a iOS Safari.
- Reescrita do `FateDice3D` (apenas o guard de visibilidade/idle).
- **Bug do loop `PLAYING <-> BUFFERING` no receiver do YouTube.** Coberto pela **story 55**. Mesmo com todos os passos desta story aplicados, aquele bug persistiria sem os guards de idempotencia propostos em 55. As duas stories sao independentes e podem ser aplicadas em paralelo.

## Criterios de Aceitacao

### Passo 1 - Transmissao
- [ ] `getDisplayMedia` pede no maximo 1920x1080 @ 30fps.
- [ ] `sender.setParameters` aplica `maxFramerate = 30` no encoding de video.
- [ ] `degradationPreference = 'balanced'`.
- [ ] Decisao documentada sobre `contentHint` (manter ou remover).
- [ ] Medicao comparativa registrada (CPU e FPS antes/depois).

### Passo 2 - Auto-Downgrade
- [ ] Downgrade 1080p -> 720p@24 dispara automaticamente quando `qualityLimitationReason === 'cpu'` se sustenta por 8-10s.
- [ ] Fallback por `framesPerSecond` e por `framesDropped/framesEncoded` funcionam quando `qualityLimitationReason` nao esta disponivel.
- [ ] Downgrade e sticky dentro da sessao de share.
- [ ] Tier e persistido em `localStorage` e respeitado na proxima transmissao.
- [ ] Botao "Tentar 1080p" limpa o flag sticky e o `localStorage`.

### Passo 3 - Voz
- [ ] Analisadores operam em 400ms (desktop) e 600ms (mobile).
- [ ] Peers mutados nao tem analisador rodando.
- [ ] `setPeers` removido do poll do `VoiceChatPanel`. Avatares leem `speaking`/`audioLevel` de store externo.
- [ ] Painel de voz nao re-renderiza a cada tick do analisador.

### Passo 4 - Logs
- [ ] `console.log` removido das funcoes `sendSignal` em `VoiceChatManager` e `screen-share-manager` em producao.
- [ ] Log de `visibilitychange` removido de `useSessionScreenControl`.
- [ ] `MusicPlayer.tsx` **nao** foi tocado (escopo da story 55).

### Passo 5 - Three.js
- [ ] `requestAnimationFrame` do `FateDice3D` pausa quando `document.hidden === true`.
- [ ] Em `phase === 'idle'`, loop de render opera em <= 30fps OU faz skip quando delta de posicao e abaixo do epsilon.
- [ ] Loop retoma automaticamente quando a aba volta a ficar visivel.

### Passo 6 - Telemetria e Circuit Breaker

Fase A - Telemetria:
- [ ] Helper `logPeerEvent` implementado com gate `NODE_ENV === 'development'` OU `localStorage.debugScreenShare === '1'`.
- [ ] Early return quando desligado (overhead zero em producao com flag off).
- [ ] `attemptId` por peer correlaciona todos os eventos de um mesmo ciclo de vida, inclusive callbacks de tentativas ja substituidas.
- [ ] Estagios instrumentados: `createPeerConnection`, `offer-created/sent/received`, `remote-description-set`, `answer-created/sent`, `ice-connection-state-change`, `connection-state-change`, `safety-timeout` (com `lastConnectionState` / `lastIceConnectionState` / `lastSignalingState`), `reconnect-scheduled`, `peer-join-ignored-by-breaker`.
- [ ] `role` (`broadcaster` | `receiver`) presente em todo evento.
- [ ] `ice-candidate` **nao** e logado individualmente.
- [ ] Log estruturado de pelo menos uma reproducao do peer que trava coletado e anexado.

Fase B - Breaker:
- [ ] `peerFailureState` rastreado por peer (`failures`, `blockedUntil`, `hardStopped`).
- [ ] Breaker aplicado nos **tres** caminhos (safety timeout, state change, peer-join).
- [ ] Cooldown de 30s apos `BREAKER_SOFT_THRESHOLD` (3) falhas consecutivas.
- [ ] Hard stop apos `BREAKER_HARD_THRESHOLD` (5) falhas; so limpo por `retryPeer`.
- [ ] `clearPeerFailure` disparado em `connectionState === 'connected'`.
- [ ] `onPeerHardStopped` + `retryPeer` expostos e UI consumindo-os.
- [ ] `VoiceChatManager` nao foi alterado.

## Validacao Executada

- [x] `tsc --noEmit` passa.
- [x] `npm run build` passa.
- [ ] Baseline registrado (PC + tablet + celular, broadcaster no PC) antes de qualquer alteracao.
- [ ] Checkpoint 1 registrado com queda clara de CPU no PC apos Passo 1.
- [ ] Checkpoint 2a (downgrade automatico) registrado com badge 720p aparecendo e CPU caindo.
- [ ] Checkpoint 2b (override + persistencia) registrado.
- [ ] Checkpoint 3 registrado com avatares/indicadores de voz intactos e tablet/celular mais fluidos.
- [ ] Checkpoint 4 registrado com console limpo e funcionalidades intactas.
- [ ] Checkpoint 5 registrado com rAF pausando em aba oculta e idle em <= 30fps.
- [ ] Checkpoint 6a registrado (telemetria liga/desliga via flag).
- [ ] Checkpoint 6b registrado com `lastConnectionState` do peer problema documentado.
- [ ] Checkpoint 6c registrado com breaker bloqueando churn em cenario induzido.
- [ ] Checkpoint 6d registrado com nao-regressao em peer saudavel.

> Nota sobre escala: os tres clientes usados no teste representam uma mesh com 2 peer connections de voz por cliente, enquanto sessoes reais chegam a 4. Um cenario que ja trava com 3 clientes nao melhora com 5; um cenario que passa com folga com 3 tende a aguentar 5 mas isso deve ser reavaliado em campo quando possivel.

## Registro de Campo - 2026-04-23 (entrada manual do operador)

### Ambiente
- Browser broadcaster: Helium.
- PC broadcaster: Intel i5-10400F.
- Topologia de teste: 3 clientes simultaneos (PC + tablet + celular), todos em voice.

### Medicoes observadas (sem baseline formal comparativo antes da implementacao)
- Em voice com 3 clientes: memoria no navegador chegou a ~1 GB.
- CPU no PC broadcaster em voice (sem transmissao): ~5% (maquina potente).
- Ao iniciar transmissao:
  - pico inicial de CPU: ~20%;
  - estabilizacao apos alguns minutos: ~15%.
- Em transmissao:
  - CPU: picos ~18%;
  - GPU: ~30%;
  - memoria: ~700 MB.
- Em transmissao + YouTube:
  - CPU: picos ~20%, media ~17%;
  - GPU: variando entre ~13% e ~20%;
  - memoria: ~700-800 MB.
- Com foco/inspecao no PC durante transmissao:
  - GPU variando entre ~20% e ~30%;
  - CPU sobe ~2 pontos em media (com picos ate ~18%);
  - memoria permanece ~700 MB.

### Comportamento por dispositivo
- Arena: funcionamento geral aceitavel.
- Ficha/login:
  - celular: travamento severo (principal gargalo percebido);
  - tablet: melhor que celular, mas com perdas pontuais.
- Em streaming:
  - celular continua com travamento forte;
  - tablet lidando melhor.

### Trechos relevantes de log (resumo)
- Repeticao de ciclo de reconexao de transmissao para um peer especifico:
  - `Creating peer connection for: lina clark / bellatrix`
  - `Adding video track to peer connection`
  - `Safety timeout: closing stuck connection for lina clark / bellatrix`
- Para outro peer, fluxo normal de conexao (offer/answer/ice + `connected`).
- Voice:
  - `voice-join ... ignored — already connected` recorrente (heartbeat/reativacao de presenca).
- YouTube:
  - eventos `YT_NATIVE_STATE` variando;
  - erros `net::ERR_BLOCKED_BY_CLIENT` em endpoints de tracking/log_event.

## Analise Tecnica (para revisao cruzada)

1. O pacote de transmissao parece ter reduzido o risco de saturacao do broadcaster.
   - Mesmo com transmissao + YouTube, CPU no PC ficou em faixa moderada (~15-20%), sem sintomas de colapso.

2. O gargalo residual esta mais forte no receiver mobile, especialmente em ficha/login.
   - Arena ficou melhor que ficha, indicando custo extra de UI/render/hidratacao fora do pipeline de video puro.

3. Ha evidencia de churn de conexao WebRTC de screen share para um peer.
   - O loop `create -> addTrack -> safety-timeout -> recreate` sugere tentativa repetida de negociacao sem estabilizar.
   - Esse churn aumenta custo de sinalizacao/encode e pode piorar UX em aparelhos fracos.

4. Logs de `voice-join ignored — already connected` parecem ruido esperado de heartbeat.
   - Nao indicam, por si so, falha de voz; sao consistentes com mecanismo de presenca/reanuncio.

5. `ERR_BLOCKED_BY_CLIENT` do YouTube aponta interferencia de bloqueador/extensao/browser.
   - Provavel ruido de telemetria/tracking bloqueada, nao causa raiz direta de CPU alta.
   - Pode gerar oscilacao de estados do player e deve ser considerado no diagnostico de reproducao.

### Direcao sugerida para follow-up
- Priorizar perfil de performance mobile na aba de ficha/login com voice ativo.
- Adicionar "circuit breaker" no screen-share reconnect por peer (evitar loop infinito de safety-timeout).
- Validar decode/render no celular com transmissao ativa e reduzir trabalho de UI concorrente no receiver.
- Repetir checkpoint formal com coleta de `webrtc-internals` (encoder/decoder) para fechar criterios da story.

## Anexo - Log Bruto (PC broadcaster)

```text
[WebRTC - mestre] Creating peer connection for: lina clark / bellatrix
[WebRTC - mestre] Adding video track to peer connection
[WebRTC] Safety timeout: closing stuck connection for lina clark / bellatrix
[WebRTC - mestre] Creating peer connection for: lina clark / bellatrix
[WebRTC - mestre] Adding video track to peer connection
[VoiceChat - Mestre] Signal received: voice-join from: Ayton Manson / McAlister
[VoiceChat - Mestre] voice-join from ayton manson / mcalister ignored — already connected
[WebRTC] Safety timeout: closing stuck connection for lina clark / bellatrix
[WebRTC - mestre] Creating peer connection for: lina clark / bellatrix
[WebRTC - mestre] Adding video track to peer connection
[WebRTC] Safety timeout: closing stuck connection for lina clark / bellatrix
[VoiceChat - Mestre] Signal received: voice-join from: Ayton Manson / McAlister
[VoiceChat - Mestre] voice-join from ayton manson / mcalister ignored — already connected
[VoiceChat - Mestre] Signal received: voice-join from: Ayton Manson / McAlister
[VoiceChat - Mestre] voice-join from ayton manson / mcalister ignored — already connected
[VoiceChat - Mestre] Signal received: voice-join from: Ayton Manson / McAlister
[VoiceChat - Mestre] voice-join from ayton manson / mcalister ignored — already connected
[WebRTC - mestre] Signal received: peer-join from: elara malisorn - el-varnis
[WebRTC - mestre] Peer joined: elara malisorn - el-varnis — creating connection
[WebRTC - mestre] Creating peer connection for: elara malisorn - el-varnis
[WebRTC - mestre] Adding video track to peer connection
[VoiceChat] Presence Update: [{"uid":"Ayton Manson / McAlister","charId":"a8a0503d-6c7b-4bc4-ab26-5358d8258950"},{"uid":"Mestre","charId":"MISSING"}]
[WebRTC - mestre] Signal received: answer from: elara malisorn - el-varnis
[WebRTC - mestre] Handling answer from: elara malisorn - el-varnis
[WebRTC - mestre] Signal received: ice-candidate from: elara malisorn - el-varnis
[WebRTC] Connection state for elara malisorn - el-varnis: connecting
[WebRTC - mestre] Signal received: ice-candidate from: elara malisorn - el-varnis
[WebRTC] Connection state for elara malisorn - el-varnis: connected
[WebRTC - mestre] Signal received: ice-candidate from: elara malisorn - el-varnis
[VoiceChat] Presence Update: [{"uid":"Ayton Manson / McAlister","charId":"a8a0503d-6c7b-4bc4-ab26-5358d8258950"},{"uid":"Mestre","charId":"MISSING"},{"uid":"Elara Malisorn - El-Varnis","charId":"74850e8d-d367-417a-9b15-e082963525c6"}]
[VoiceChat - Mestre] Signal received: voice-join from: Elara Malisorn - El-Varnis
[VoiceChat - Mestre] I am answerer → waiting offer from: elara malisorn - el-varnis
[VoiceChat - Mestre] Signal received: voice-offer from: Elara Malisorn - El-Varnis
[VoiceChat - Mestre] Handling offer from: elara malisorn - el-varnis
[VoiceChat - Mestre] Received audio track from: elara malisorn - el-varnis
[VoiceChat - Mestre] Signal received: voice-ice-candidate from: Elara Malisorn - El-Varnis
[VoiceChat] Connection state for elara malisorn - el-varnis: connecting
[VoiceChat - Mestre] Signal received: voice-ice-candidate from: Elara Malisorn - El-Varnis
[VoiceChat] Connection state for elara malisorn - el-varnis: connected
[VoiceChat] Successfully connected to elara malisorn - el-varnis
The resource <URL> was preloaded using link preload but not used within a few seconds from the window's load event. Please make sure it has an appropriate `as` value and it is preloaded intentionally.
[VoiceChat - Mestre] Signal received: voice-join from: Ayton Manson / McAlister
[VoiceChat - Mestre] voice-join from ayton manson / mcalister ignored — already connected
[MusicPlayer] YT_NATIVE_STATE: 3
[MusicPlayer] YT_NATIVE_STATE: -1
[MusicPlayer] YT_NATIVE_STATE: 3
www.youtube.com/ptracking?html5=1&video_id=eZ7MFTBjJS8&cpn=BuBE3B6Px6RHIx0i&ei=UvfpafKOHOj21sQP9fP60Ag&ptk=youtube_single&oid=YbGWGCIUCoaUePqGy_acMw&ptchn=rMHecWO6fui7O2d9dnpEZg&pltype=content:1  Failed to load resource: net::ERR_BLOCKED_BY_CLIENT
[MusicPlayer] YT_NATIVE_STATE: 1
[MusicPlayer] YT_NATIVE_STATE: 3
[MusicPlayer] YT_NATIVE_STATE: 1
[VoiceChat - Mestre] Signal received: voice-join from: Ayton Manson / McAlister
[VoiceChat - Mestre] voice-join from ayton manson / mcalister ignored — already connected
www.youtube.com/youtubei/v1/log_event?alt=json:1  Failed to load resource: net::ERR_BLOCKED_BY_CLIENT
[VoiceChat - Mestre] Signal received: voice-join from: Elara Malisorn - El-Varnis
[VoiceChat - Mestre] voice-join from elara malisorn - el-varnis ignored — already connected
[VoiceChat - Mestre] Signal received: voice-join from: Ayton Manson / McAlister
[VoiceChat - Mestre] voice-join from ayton manson / mcalister ignored — already connected
[VoiceChat - Mestre] Signal received: voice-join from: Elara Malisorn - El-Varnis
[VoiceChat - Mestre] voice-join from elara malisorn - el-varnis ignored — already connected
POST https://www.youtube.com/youtubei/v1/log_event?alt=json net::ERR_BLOCKED_BY_CLIENT
send @ unknown
send @ unknown
send @ unknown
kj @ m=root,base:227
_.mj @ m=root,base:231
cn @ m=root,base:298
sendAndWrite @ m=root,base:429
sendAndWrite @ m=root,base:462
l @ m=root,base:302
(anonymous) @ m=root,base:303
Promise.then
hn @ m=root,base:303
Po @ m=root,base:331
So @ m=root,base:328
(anonymous) @ m=root,base:326
_.sf @ m=root,base:143
_.Lo @ m=root,base:326
c @ m=root,base:329
(anonymous) @ m=root,base:329
(anonymous) @ m=root,base:216
[VoiceChat - Mestre] Signal received: voice-join from: Ayton Manson / McAlister
[VoiceChat - Mestre] voice-join from ayton manson / mcalister ignored — already connected
```

## Referencias

- `logs_travamento_geral_site.txt` - log original do incidente.
- Story 46 - tratou causa de travamento mobile antiga (reprojecao em cascata); os gargalos listados aqui sao follow-up daquela story.
- `/knowledge/architecture.md` - camadas da arquitetura VTT.
