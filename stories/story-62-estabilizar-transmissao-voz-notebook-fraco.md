---
title: "Story 62 - Estabilizar transmissao com voz em notebook fraco"
description: "Caso de campo separado das Stories 58/59: o site flui bem em idle, mas quando a transmissao comeca em notebook fraco a voz do chat passa a falhar, robotizar ou cortar, e em alguns casos a propria transmissao deixa de funcionar. O alvo aqui e a disputa de recurso entre encoder da transmissao, malha de voz WebRTC e reconexoes associadas."
priority: "critica"
status: "aberta"
last_updated: "2026-04-24"
related: ["story-54-performance-transmissao-voz-e-render-cpu-100", "story-58-performance-abas-ficha-notas-header", "story-59-rerender-cascata-musicplayer-main-thread"]
tags: [performance, webrtc, screenshare, voice-chat, notebook, cpu]
epic: epic-01-refatoracao-modular
---

# Story 62 - Estabilizar transmissao com voz em notebook fraco

## Problema Reportado

Caso real da jogadora:

> "O site esta fluindo bem agora, mas quando comeca a transmissao a voz no chat falha ao ponto de a transmissao nao funcionar mais."

Leitura correta:

- o gargalo principal nao esta mais no shell visual fora da arena
- o problema aparece no momento em que a transmissao sobe
- o pior sintoma percebido pela usuaria e degradacao forte da voz
- em maquina fraca, o encoder da captura e a malha de voz passam a disputar CPU/rede/audio budget ao mesmo tempo

---

## Delimitacao Obrigatoria

Esta story existe para isolar este caso de campo e impedir a proxima AI de misturar causas diferentes.

### Esta story NAO e:

- a Story 58 de paint/layout fora da arena
- a Story 59 de churn do shell persistente
- um bug do MusicPlayer/YouTube
- uma revisao de header, notas ou CharacterCard

### Esta story E:

- transmissao + voz conectadas ao mesmo tempo
- maquina fraca/notebook fraco
- estabilidade do broadcaster sob pressao real
- priorizacao de voz sobre nitidez maxima da transmissao

Regra de ouro:

> Se a arena esta fluida e o problema so nasce quando a transmissao comeca, o alvo principal desta story e o pipeline WebRTC de screen share + voice mesh, nao o DOM visual.

---

## Evidencias Base

Arquivos de referencia:

- `front_sistema_rpg/DEBUG_CELULAR/Trace-20260424T113809.json`
- relato de campo da jogadora com notebook fraco

Leitura consolidada desta rodada:

- `CrRendererMain` do app continua pesado
- existe atividade relevante em `WebRTC_W_and_N`
- GPU/compositor sobem junto quando o share entra
- o fluxo combina captura de tela, encode de video, audio da transmissao e voz mesh

Interpretacao pratica:

- o sistema ja nao parece preso no mesmo problema visual das stories 58/59
- o caso atual e compatível com contencao de recurso no broadcaster
- quando a CPU aperta, a voz sofre primeiro na percepcao humana, mesmo que a origem seja a transmissao

---

## Diagnostico Canonico Desta Story

### Hipotese principal

O notebook fraco entra em pressao assim que precisa fazer ao mesmo tempo:

1. capturar a tela
2. codificar video da transmissao
3. transportar audio da transmissao
4. manter voz mesh com varios peers
5. tocar/monitorar audio remoto localmente

### Suspeitos reais

Arquivos:

- `src/lib/screen-share-manager.ts`
- `src/lib/VoiceChatManager.ts`
- `src/app/session/[id]/hooks/useSessionScreenControl.ts`

Pontos mais provaveis:

1. `screen-share-manager.ts`
   - share ainda pode nascer pesado demais para notebook fraco
   - bitrate/prioridade do video precisam ceder espaco para a voz
   - downgrade para `720p` precisa reagir cedo ao primeiro sinal de `qualityLimitationReason = 'cpu'`

2. `VoiceChatManager.ts`
   - voz continua em topologia mesh
   - speaking detection e playback local seguem ativos enquanto o share acontece
   - se a maquina tambem estiver em Bluetooth/HFP ou device ruim, a degradacao percebida pode explodir

3. `useSessionScreenControl.ts`
   - reconnect/checks de transmissao nao podem amplificar pressao quando a stream esta instavel

---

## Estado Atual do Codigo

Nesta branch ja existe um hardening inicial que precisa ser validado em campo:

- transmissao passou a rebalancear bitrate entre peers
- video da transmissao passou a usar prioridade `medium`
- audio da transmissao continua com prioridade `high`
- monitor de qualidade ficou mais rapido
- downgrade por CPU passou a disparar mais cedo para `720p`

Importante:

> Esta story nao parte do zero. Primeiro validar se esse pacote ja resolve o notebook da jogadora. So abrir nova rodada de implementacao se o teste de campo ainda falhar.

---

## Ordem Obrigatoria de Trabalho

### Passo 1 - Validacao de campo com a branch atual

Cenario:

1. entrar na voz
2. confirmar audio estavel em idle
3. iniciar transmissao
4. observar os primeiros 10-30s
5. verificar se a voz falha, robotiza ou corta
6. verificar se a transmissao permanece viva, mesmo com queda de qualidade

Objetivo:

- responder se o hardening atual ja resolveu o caso real

### Passo 2 - Coleta dirigida se ainda falhar

Se ainda falhar:

- ativar `localStorage.debugScreenShare = '1'`
- ativar `localStorage.debugVoiceChat = '1'`
- coletar novo trace curto e logs
- comparar momento exato de inicio da falha

Perguntas que precisam sair respondidas:

- houve `qualityLimitationReason = 'cpu'` antes da voz degradar?
- houve reconnect extra de screen share?
- a stream caiu ou so a voz ficou ruim?
- o notebook estava em mic Bluetooth/HFP?

### Passo 3 - Segunda rodada de correcao apenas se o Passo 1 falhar

Se o patch atual nao bastar, atacar nesta ordem:

1. iniciar share direto em perfil mais barato quando a maquina ja tiver historico de downgrade
2. reduzir ainda mais bitrate inicial do video com muitos peers
3. suspender ou simplificar deteccao de speaking enquanto o proprio usuario estiver transmitindo
4. revisar device/mic Bluetooth no caso especifico da jogadora

---

## Escopo

### Incluido

- `src/lib/screen-share-manager.ts`
- `src/lib/VoiceChatManager.ts`
- `src/app/session/[id]/hooks/useSessionScreenControl.ts`
- telemetria e validacao de `qualityLimitationReason`, `framesPerSecond`, `framesDropped`
- regras de priorizacao entre transmissao e voz

### Excluido

- Story 58 visual
- Story 59 shell/main-thread
- `MusicPlayer.tsx`
- `SessionHeader.tsx`
- `CharacterCard.css`
- notas, tabs e arena

---

## Criterios de Aceitacao

### Funcionais

- [ ] em notebook fraco, a voz nao degrada imediatamente ao iniciar a transmissao
- [ ] a transmissao nao morre nos primeiros segundos por pressao de CPU
- [ ] se necessario, o sistema pode cair para `720p` para preservar a voz
- [ ] a experiencia percebida melhora mesmo que a imagem fique menos nitida

### Tecnicos

- [ ] bitrate/prioridade da transmissao estao rebalanceados conforme numero de peers
- [ ] CPU-limited dispara protecao cedo o bastante para evitar colapso
- [ ] nao ha reconnect em cascata gerado pelo proprio remedio
- [ ] `next build` sem warnings novos
- [ ] `tsc --noEmit` limpo

### Criterio de negocio

> Para este caso, voz inteligivel vale mais do que transmissao em 1080p.

Se for preciso escolher, esta story deve sacrificar resolucao antes de sacrificar estabilidade da voz.

---

## Validacao Obrigatoria

Testar nesta ordem:

1. notebook da jogadora, com voz conectada e sem transmissao
2. notebook da jogadora, iniciando transmissao
3. repetir com mais de um peer conectado
4. se a falha persistir, coletar trace/logs com debug ligado

---

## Resumo Executivo

As stories 58 e 59 trataram gargalos visuais e de shell.

Esta story abre um trilho separado:

> "quando a transmissao entra em notebook fraco, a voz falha e a sessao degrada"

O alvo correto aqui e a disputa de recurso entre screen share e voice chat. O resultado esperado nao e beleza maxima, e sim estabilidade real em maquina fraca.
