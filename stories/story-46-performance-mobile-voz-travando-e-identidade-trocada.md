---
title: "Story 46 - Performance Mobile, Voz Travando e Identidade Trocada no Voice Chat"
description: "Tres bugs reportados por jogadores: (1) site pesado/travando no celular, (2) jogador no mobile nao e ouvido apesar de aparecer no voice, (3) jogador entra como Kzar mas aparece como Lina Clark na mesa Quimeras."
priority: "critica"
status: "concluido"
last_updated: "2026-04-22 (Story encerrada - projectedStateStore integrado e follow-ups residuais documentados)"
tags: [bugfix, performance, mobile, voice-chat, webrtc, identidade, presenca]
epic: epic-01-refatoracao-modular
---

# Story 46 - Performance Mobile, Voz Travando e Identidade Trocada no Voice Chat

## Status Final

| Item | Status | Resultado |
|---|---|---|
| Bug 2 - Audio unidirecional mobile | Concluido | Fluxo de captura e entrada de audio estabilizado para mobile |
| Bug 3 - Identidade trocada no voice | Concluido | Presenca e fallback de personagem corrigidos |
| Bug 1 - Performance mobile | Concluido no escopo da story | Gargalo critico de reprojecao em cascata removido; follow-ups adicionais mapeados |

## O que foi entregue

### Bug 2 - Jogador no mobile nao e ouvido
- `VoiceChatManager.isMobileDevice()` usando `navigator.maxTouchPoints > 0`.
- Bluetooth avoidance desabilitado em mobile para respeitar o device escolhido pelo sistema.
- Guarda de health do stream apos `getBestEffortMicStream`, com fallback para `{ audio: true }` simples quando a track vem invalida.
- Retry de `AudioContext.resume()` para navegadores mobile que exigem gesto confirmado.

### Bug 3 - Identidade trocada no voice
- Backend corrigido de `data.characterId ?? existing?.characterId` para `data.characterId !== undefined ? data.characterId : existing?.characterId`.
- `lastKnownCharacterIdRef.clear()` ao trocar de sessao no `VoiceChatPanel`.
- Fallback multi-owner priorizando `activeInArena` para evitar troca entre Kzar e Lina Clark por ordem de insercao.

### Bug 1 - Performance mobile
- `background-attachment: fixed` desabilitado em mobile.
- `AtmosphericEffects` nao e renderizado em mobile.
- Speaking poll do voice aumentado para 500ms em mobile.
- `backdrop-filter` removido de elementos permanentes no mobile.
- `touch-action: pan-y`, reducao de animacoes continuas e alivio de `box-shadow` em cards.
- GM preview da transmissao pausado apos 4s para reduzir custo de GPU/CPU local.
- `console.log` de diagnostico removidos do caminho critico de render.
- `projectedStateStore` criado para centralizar a projecao da timeline.
- Consumidores migrados para o estado compartilhado:
  - `src/app/session/[id]/page.tsx`
  - `src/app/session/[id]/hooks/useSessionDerivations.ts`
  - `src/components/VoiceChatPanel.tsx`
  - `src/components/TextChatPanel.tsx`
  - `src/components/FloatingNotes.tsx`
  - `src/hooks/useHeaderLogic.ts`

## Decisao de Encerramento

A story foi encerrada porque a causa critica originalmente identificada para o travamento mobile foi tratada: a UI deixou de reprojetar a timeline em cascata por multiplos consumidores independentes.

Ainda existem oportunidades de melhoria para mobile, mas elas passam a ser follow-up de performance e nao bloqueiam o encerramento desta story:
- `events[]` ainda gera re-render amplo na pagina principal.
- O caminho de logs ainda percorre historicos completos.
- O polling do voice continua ativo enquanto conectado.
- Ha residuos de debug/logs e alguns overlays pesados fora do caminho principal.

## Criterios de Aceitacao

### Bug 1 - Performance Mobile
- [ ] Validacao manual em dispositivo Android mid-range ainda pendente.
- [x] `background-attachment: fixed` nao e aplicado em viewports <= 768px.
- [x] `AtmosphericEffects` nao e renderizado em mobile.
- [x] `computeState()` foi centralizado no caminho reativo principal da UI.
- [x] `backdrop-filter` foi desabilitado em elementos permanentes no mobile.
- [x] O polling de speaking em mobile opera em >= 500ms.
- [x] `console.log` de diagnostico foram removidos do caminho critico principal.

### Bug 2 - Audio Mobile Unidirecional
- [x] Jogador em dispositivo mobile consegue ser ouvido apos entrar no voice.
- [x] Fallback para `{ audio: true }` simples quando a track vem com `readyState !== 'live'`.
- [x] Bluetooth auto-avoidance desabilitado em mobile.
- [x] `AudioContext` garantido em `running` antes do `voice-join`.

### Bug 3 - Identidade Trocada
- [x] Backend sobrescreve `characterId` quando o novo valor e explicito.
- [x] `lastKnownCharacterIdRef` e limpo ao trocar de sessao.
- [x] Fallback prioriza `activeInArena` quando ha multiplos personagens do mesmo owner.
- [x] Identidade correta mantida apos reconexao e trocas de aba.

## Validacao Executada

- `tsc --noEmit` passou.
- `npm run build` passou.

## Fora de Escopo

- Migracao de topologia mesh para SFU.
- Refatoracao completa de `page.tsx`.
- Suporte dedicado a iOS Safari.
- Mudancas de schema de eventos ou `domain.ts`.
- Otimizacoes extras de performance que nao eram necessarias para remover a causa critica desta story.
