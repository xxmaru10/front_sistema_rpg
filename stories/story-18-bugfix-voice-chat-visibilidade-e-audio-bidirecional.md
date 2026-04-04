---
title: "Story 18 - Bugfix: Voice Chat — Visibilidade Mútua e Áudio Bidirecional entre Mestre e Jogador"
description: "Corrigir falha onde jogador ouve o mestre mas mestre não ouve o jogador, e ambos não se vêem na lista de participantes do voice chat."
reviewed_by: "Análise externa (2026-04-04) — 2 hipóteses adicionais incorporadas"
status: "concluído"
priority: "crítica"
last_updated: 2026-04-04
implemented_at: 2026-04-04
tags: [webrtc, voice, presença, bugfix]
---

# Story 18 - Bugfix: Voice Chat — Visibilidade Mútua e Áudio Bidirecional

## Contexto
O sistema de voz (WebRTC mesh) apresenta uma falha assimétrica crítica:
1. **Áudio unidirecional**: O jogador consegue ouvir o mestre, mas o mestre **não** consegue ouvir o jogador.
2. **Presença invisível**: Nenhum dos dois aparece na lista de participantes do outro — o mestre não vê o jogador no painel e o jogador não vê o mestre.

Isso indica uma combinação de problemas na camada de **sinalização WebRTC** (offer/answer não completando o handshake bidirecional) e na camada de **Supabase Presence** (estado `inVoice` não propagando corretamente entre os participantes).

## Análise Preliminar (Hipóteses)

### H1 — Race Condition no Deterministic Offerer
O `VoiceChatManager` usa lógica de "menor userId faz a offer" (L739). Se o `userId` do mestre contém caracteres especiais ou caixa mista (ex: `"Mestre"` vs UUID), a comparação `this.userId < from` pode produzir resultados inconsistentes entre os dois lados, fazendo com que **nenhum** dos dois envie a offer ou **ambos** enviem, resultando em glare.

### H2 — Filtro de Sinais Bloqueando Sinais Legítimos
O listener de `postgres_changes` (L166-167) filtra sinais por `from_user === this.userId` e `to_user !== this.userId`. Se o `to_user` for `null` (sinal broadcast como `voice-join`), o filtro `to_user && to_user !== this.userId` passa corretamente. Porém, se houver discrepância de caixa/trim no userId, sinais direcionados podem ser descartados silenciosamente.

### H3 — Presence Channel Isolado por Role
O `presenceChannel` é subscrito em `voice-presence-${sessionId}`. Se o mestre e o jogador estiverem usando canais de presença com `sessionId` diferentes ou se o `track()` falhar silenciosamente (L205-211 — note o shadowing de `status`), a lista de participantes fica vazia para ambos.

### H4 — Guard de Conexão Existente Bloqueando Re-negociação
Na L724-730, o guard `existingPc && connectionState !== 'failed' && !== 'closed'` pode bloquear uma re-negociação legítima se a conexão anterior ficou em estado `connecting` indefinidamente (sem timeout).

### H5 — Loop Infinito de Re-join (CAUSA PROVÁVEL DO BUG PRINCIPAL) ⚠️
Quando o peer que **não é o offerer** recebe um `voice-join`, ele executa na L745:
```ts
await this.sendSignal({ type: 'voice-join', from: this.userId, to: from, peerId: this.userId });
```
Esse sinal `voice-join` direcionado (`to: from`) chega ao peer original, que entra novamente no bloco de decisão do deterministic offerer. Se o peer original **também** não for o offerer (por alguma inconsistência de comparação), ele reenviar outro `voice-join` de volta — criando um loop de pings onde **nenhum dos dois envia a offer**. O comentário no código diz "pinging back to correctly initiate negotiation", mas a lógica atual não garante que o outro lado vai enviar a offer; ela apenas reenvia um `voice-join`, perpetuando o ciclo. **Este é o candidato principal ao bug de áudio unidirecional/assimétrico.**

### H6 — Race Condition: `track()` de Presença Antes da Subscrição estar Pronta
Em `joinVoice()` (L341), `updatePresenceVoiceState(true)` é chamado imediatamente. Porém, o `presenceChannel` pode ainda estar em estado de subscrição pendente nesse momento — o `track()` feito antes do `SUBSCRIBED` falha silenciosamente no Supabase (retorna status de erro que é apenas logado mas não reprocessado). Resultado: o estado `inVoice: true` nunca chega aos outros participantes, e nenhum dos dois aparece como "no voice" na lista do outro.

## Escopo

### Fase 1 — Diagnóstico e Logging Estruturado
- Adicionar logging estruturado no fluxo de sinalização para rastrear:
  - Valores exatos de `userId` em ambos os lados (mestre e jogador)
  - Resultado da comparação deterministic offerer (`this.userId < from`) com os **valores brutos antes e depois do `.trim().toLowerCase()`**
  - Status de cada `track()` no Presence — verificar se retorna erro silencioso
  - Sinais recebidos vs sinais descartados (com motivo)
  - Contagem de `voice-join` recebidos por ciclo (para detectar loop H5)
- Verificar e corrigir shadowing de variável `status` no callback de subscribe (L203-213)

### Fase 2 — Correção do Loop de Re-join (H5 — PRIORIDADE MÁXIMA)
- **Refatorar lógica do non-offerer (L739-746)**: O peer que não é o offerer **não deve reenviar `voice-join`**. Deve apenas aguardar a `offer` chegar. O "ping de volta" deve ser substituído por uma espera passiva com timeout. Se a offer não chegar em N segundos, aí sim envia um `voice-join` direcionado como fallback — apenas 1 vez.
  ```ts
  // ANTES (loop infinito):
  await this.sendSignal({ type: 'voice-join', from: this.userId, to: from });
  
  // DEPOIS (espera passiva + fallback único):
  // Não reenvia nada. Aguarda offer. Se não vier em 5s, agenda um único fallback-join.
  ```

### Fase 3 — Correções de Robustez
- **Fix shadowing de `status`** (H3): Renomear variável interna em L205 (`const trackResult = ...`).
- **Normalização de userId** (H1/H2): Aplicar `.trim().toLowerCase()` na comparação do deterministic offerer.
- **Timeout de `connecting`** (H4): Safety timeout de 15s — se a conexão não atingir `connected`, removê-la e permitir re-negociação.
- **Presença antes de SUBSCRIBED** (H6): Mover `updatePresenceVoiceState(true)` para ser chamado somente dentro do callback `status === 'SUBSCRIBED'` do presenceChannel, ou via retry com verificação de estado do canal.
- **Fallback de Presence com retry**: Se `track()` retornar erro, reagendar com `setTimeout` de 2s (max 3 tentativas).
- **Log de ICE candidates descartados**: Log quando candidatos ICE chegam sem peer connection correspondente.

## Arquivos Afetados
| Arquivo | Alteração |
|---|---|
| `src/lib/VoiceChatManager.ts` | **Principal** — Refatorar loop de re-join, fix shadowing, normalização de userId, timeout de connecting, retry de presença |
| `src/components/VoiceChatPanel.tsx` | (Secundário) — Nenhuma alteração estrutural prevista; apenas se necessário para exibir status de diagnóstico |

## Critérios de Aceitação
1. **Áudio bidirecional**: Mestre e jogador devem ouvir um ao outro após ambos entrarem no voice.
2. **Visibilidade mútua**: Ambos devem aparecer na lista de participantes do painel de voz do outro, com status `inVoice: true`.
3. **Sem loop de re-join**: O console **não deve exibir** mais de 2 entradas de `voice-join` por par de peers para o mesmo evento de entrada — loop de pings eliminado.
4. **Deterministic Offerer confiável**: A lógica de quem faz a offer deve funcionar independentemente do formato do userId (UUID, nome, caixa mista).
5. **Presence confirmada antes do track**: O estado `inVoice: true` deve ser persistido no Supabase Presence apenas após `status === 'SUBSCRIBED'` ser confirmado.
6. **Sem regressão**: O Nuclear Refresh, auto-join e detecção de fala devem continuar funcionando.
7. **Logs de diagnóstico**: Console deve exibir o fluxo completo de sinalização (`join → offer → answer → connected`) incluindo valores de userId usados na comparação.

## Plano de Ação
1. **Fix H3 (shadowing)**: Renomear `const status` → `const trackResult` em L205 do presenceChannel subscribe.
2. **Fix H5 (loop de re-join)**: Refatorar bloco L739-746 — o non-offerer **não reenvia** `voice-join`. Implementar espera passiva com fallback único após 5s via `setTimeout`.
3. **Fix H6 (presença prematura)**: Mover `updatePresenceVoiceState(true)` para dentro do callback `SUBSCRIBED` do presenceChannel, com retry automático em caso de falha.
4. **Fix H1/H2 (normalização de userId)**: Normalizar em `.trim().toLowerCase()` na comparação do deterministic offerer.
5. **Fix H4 (timeout de `connecting`)**: Adicionar `setTimeout` de 15s no `createPeerConnection` que chama `removePeer` se o estado não evoluir para `connected`.
6. **Adicionar logs estruturados**: Cobrir o fluxo join → offer → answer → ICE → connected com valores de userId explícitos.
7. **Testar par mestre-jogador**: Validar todos os critérios de aceitação.
8. **Documentar**: Atualizar `/knowledge/architecture.md` com as decisões desta story.

## Não-Escopo
- Suporte a múltiplos peers (3+) — fora desta story, testar apenas par mestre-jogador.
- Migração para SFU — a topologia mesh é mantida.
- Alterações no backend/tabela `webrtc_signals`.
