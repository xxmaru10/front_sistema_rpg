---
title: "Story 54 - Performance Geral: Transmissao, Voz e Render travando CPU em 100%"
description: "Site atinge 100 por cento de uso de CPU e trava em celulares e notebooks fracos; durante transmissao, o problema se agrava ate travar o PC inteiro do transmissor. Plano em cinco passos sequenciais com checkpoint de medicao apos cada passo."
priority: "critica"
status: "em-revisao"
last_updated: "2026-04-23"
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
- `console.log` em caminhos quentes: `VoiceChatManager.sendSignal`, `screen-share-manager.sendSignal`, e a IIFE `YT_MOUNT` em `MusicPlayer.tsx` (loga em todo render).
- Handler de `visibilitychange` em `useSessionScreenControl` loga em todo foco de aba (debounce so protege o reconnect, nao o log).
- `FateDice3D` via `useFateDiceSimulation` mantem rAF 60fps mesmo em `phase === 'idle'` enquanto `isVisible` estiver ativo e nao ha guard para `document.hidden`.

### Hipotese de build stale (a validar)
O log mostra URL `m.youtube.com/...&list=...&pp=...` intacta, mas o `normalizeYouTubeUrl` em `MusicPlayer.tsx:23` deveria ter canonizado para `https://www.youtube.com/watch?v=ID`. O build local atual (`.next`) tem hashes diferentes de `layout-1fdb04bea1e6f960.js` que aparece no log. Isso prova "log != build local atual", mas nao fecha "producao atrasada" - isso depende de verificacao do hash servido em `cronosvtt.com`.

## Plano de Execucao (ordem fixa, com checkpoint apos cada passo)

### Passo 1 - Pacote de Transmissao
Alvo: `src/lib/screen-share-manager.ts`.

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
- `src/components/MusicPlayer.tsx:911` (`YT_MOUNT`): remover o `console.log` da IIFE de render.
- `src/app/session/[id]/hooks/useSessionScreenControl.ts:247`: remover o log de `visibilitychange` (manter so o comportamento).

### Passo 5 - Guard no FateDice3D
Alvo: `src/hooks/useFateDiceSimulation.ts`.

- Guard no `animate()` em `useFateDiceSimulation.ts:572`: se `document.hidden`, `return` sem chamar `requestAnimationFrame` ate `visibilitychange`.
- Em `phase === 'idle'`: throttle para ~30fps OU skip render quando nada visual mudou (monitorar `die.pos.y` delta < epsilon).
- Listener de `visibilitychange` interno ao hook para religar o loop quando a aba volta.

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
- [ ] `YT_MOUNT` removido do render do `MusicPlayer`.
- [ ] Log de `visibilitychange` removido de `useSessionScreenControl`.

### Passo 5 - Three.js
- [ ] `requestAnimationFrame` do `FateDice3D` pausa quando `document.hidden === true`.
- [ ] Em `phase === 'idle'`, loop de render opera em <= 30fps OU faz skip quando delta de posicao e abaixo do epsilon.
- [ ] Loop retoma automaticamente quando a aba volta a ficar visivel.

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

> Nota sobre escala: os tres clientes usados no teste representam uma mesh com 2 peer connections de voz por cliente, enquanto sessoes reais chegam a 4. Um cenario que ja trava com 3 clientes nao melhora com 5; um cenario que passa com folga com 3 tende a aguentar 5 mas isso deve ser reavaliado em campo quando possivel.

## Referencias

- `logs_travamento_geral_site.txt` - log original do incidente.
- Story 46 - tratou causa de travamento mobile antiga (reprojecao em cascata); os gargalos listados aqui sao follow-up daquela story.
- `/knowledge/architecture.md` - camadas da arquitetura VTT.
