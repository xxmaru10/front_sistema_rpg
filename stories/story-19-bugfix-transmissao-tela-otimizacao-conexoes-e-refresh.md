---
title: "Story 19 - Bugfix: Transmissão de Tela — Otimização de Conexões, Bitrate Adaptativo e Refresh UI"
description: "Corrigir falhas de tela preta e instabilidade em sessões com muitos participantes via bitrate adaptativo, normalização de IDs, TURN server, timeouts de conexão e refresh manual da stream."
reviewed_by: "claude-sonnet-4-6"
status: "concluído"
priority: "crítica"
last_updated: 2026-04-04
implemented_by: "claude-sonnet-4-6"
tags: [webrtc, screenshare, performance, bugfix]
---

# Story 19 - Bugfix: Transmissão de Tela

## Contexto
O sistema de transmissão de tela (WebRTC Mesh) apresenta instabilidade crítica sob carga (10+ pessoas) e em conexões internacionais (Portugal):
1. **Tela Preta/Travamento**: A transmissão para de funcionar ou nem inicia para alguns usuários, exigindo restart manual pelo mestre.
2. **Refresh Ineficaz**: Atualizar a página não resolve a conexão travada no nível do WebRTC.
3. **Bandwidth Excessivo**: O bitrate fixo de 12Mbps é alto demais para topologia mesh com 10 participantes (exige >100Mbps de upload do mestre).
4. **Visibilidade Incorreta**: A transmissão deve ser visível apenas na aba **Arena**, mas deve permanecer ativa em background se o usuário navegar para outras abas.
5. **Falha Internacional (Portugal)**: Peer não consegue estabelecer conexão P2P direta — tela preta ou apenas banner de fundo é exibido.

## Análise Técnica (Hipóteses)

### H1 — Bitrate Inviável para Mesh (CAUSA PROVÁVEL) ⚠️
Atualmente, o `ScreenShareManager` força `maxBitrate: 12_000_000` (12Mbps). Em uma sessão com 10 pessoas, o mestre envia 9 streams simultâneas. Isso exige 108Mbps de upload constante e estável. Para conexões domésticas ou com latência internacional, isso causa saturação do buffer e descarte de pacotes, resultando em "tela preta".

### H2 — Falta de Normalização de UserId
Diferente do Voice Chat (Story 18), o `ScreenShareManager` não normaliza `userId` (`.trim().toLowerCase()`). Se houver discrepância de caixa entre o ID no banco `webrtc_signals` e o ID local, o sinal é ignorado.

### H3 — Conexões "Zumbis" Travadas em Connecting
Se uma conexão não completa o ICE handshake (comum em NAT restritivo ou latência alta), ela fica em estado `connecting` indefinidamente, bloqueando novas tentativas de negociação para aquele peer.

### H4 — Ausência de TURN Server (CAUSA RAIZ DO CASO PORTUGAL) ⚠️
WebRTC P2P puro falha quando os peers estão atrás de NAT simétrico ou em ISPs que bloqueiam UDP — cenário comum em conexões internacionais. Sem um TURN server como fallback de relay, o ICE nunca encontra um caminho válido e a conexão fica presa em `connecting` ou falha silenciosamente, deixando apenas o banner de fundo (estado Supabase "stream ativa") sem track de vídeo real.

**Verificação obrigatória**: checar se `ScreenShareManager` usa a mesma configuração `iceServers` (STUN + TURN) do `VoiceManager` que foi resolvido na Story 18. Se não usar, essa é a correção mais crítica.

### H5 — Broadcaster Não Reprocessa `peer-join` de Peers Já Mapeados
Quando um jogador dá refresh ou o botão de reconnect re-envia `peer-join`, o broadcaster (mestre) pode ignorar o sinal se aquele `userId` já existir no mapa de conexões. Resultado: o jogador envia o join, não recebe offer de volta, e a tela permanece preta indefinidamente — só resolvido quando o mestre fecha e reabre a transmissão manualmente.

## Escopo

### Fase 1 — Otimização do Core (`ScreenShareManager.ts`)
- **Paridade de ICE Servers**: Copiar configuração `iceServers` do `VoiceManager` (STUN + TURN) para garantir fallback de relay em conexões internacionais.
- **Reprocessamento de `peer-join`**: Ao receber `peer-join`, sempre fechar a `RTCPeerConnection` anterior daquele peer (se existir) e recriar do zero, garantindo que re-joins de jogadores que deram refresh sejam sempre atendidos.
- **Bitrate Adaptativo**: Implementar lógica similar ao Voice Chat, reduzindo o bitrate conforme o número de peers cresce (ex: 1.5Mbps–4Mbps max).
- **Normalização de IDs**: Aplicar `.trim().toLowerCase()` em todas as verificações de `userId`.
- **Safety Timeout**: Adicionar timeout de 15s para remover conexões presas em `new` ou `connecting`.

### Fase 2 — UI e Fluxo de Visibilidade (`page.tsx`)
- **Restrição de Aba (CSS, não unmount)**: O `<video>` deve ser **ocultado via CSS** (`display: none`) quando `activeTab !== 'combat'`. **Nunca desmontar o componente enquanto a stream estiver ativa** — unmount destrói o `MediaStream` atachado ao elemento e exige re-handshake completo ao voltar.
- **Persistência em Background**: Garantir que o `ScreenShareManager` não chame `disconnect()` ao trocar de aba, apenas oculte o elemento visual.
- **Botão "Refresh Stream"**: Adicionar botão discreto no topo do container de vídeo que:
  1. Fecha a `RTCPeerConnection` local existente
  2. Limpa o `srcObject` do elemento `<video>`
  3. Re-envia `peer-join` ao broadcaster
  - O botão deve aparecer **somente na aba Arena** e **somente quando uma transmissão estiver ativa**.
- **Feedback de "Sem Sinal"**: Se após 10s do `peer-join` o `video.readyState` não atingir `HAVE_FUTURE_DATA (≥ 3)`, exibir badge overlay "Sem sinal — clique em 🔄 para reconectar" sobre o player, em vez de manter tela preta silenciosa.

### Fase 3 — Diagnóstico
- Adicionar log estruturado por peer no console do broadcaster, cobrindo o ciclo completo: `peer-join recebido` → `offer enviada` → `answer recebida` → `ICE connected/failed`.
- No painel do mestre, exibir indicador por peer com estado atual da conexão (`conectando…` / `✓ conectado` / `✗ falhou`) para facilitar diagnóstico em sessões ao vivo.

## Arquivos Afetados
| Arquivo | Alteração |
|---|---|
| `src/lib/ScreenShareManager.ts` | **Principal** — ICE servers, reprocessamento de peer-join, bitrate adaptativo, normalização, timeouts, método `reconnect()`. |
| `src/app/session/[id]/hooks/useSessionScreenControl.ts` | Expor função `reconnect` para a UI. |
| `src/app/session/[id]/page.tsx` | Ocultar vídeo via CSS por aba, botão de refresh, badge de "sem sinal". |

## Critérios de Aceitação
1. **Estabilidade com 10 players**: O bitrate deve cair automaticamente, permitindo que a stream flua sem travar o upload do mestre.
2. **Visibilidade restrita**: O vídeo da transmissão deve aparecer apenas na aba **Arena** (Combat).
3. **Continuidade sem re-handshake**: Ao voltar para a aba Arena após navegar em outras abas, a stream deve re-aparecer instantaneamente (CSS show) sem nenhuma re-negociação WebRTC.
4. **Refresh Manual eficaz**: O botão "🔄" deve ser capaz de re-sincronizar a imagem caso ela trave — limpando a `PeerConnection` local e re-enviando `peer-join` — sem exigir F5 na página.
5. **Re-join atendido sem intervenção do mestre**: Se um jogador der F5 ou usar o botão de refresh, o mestre deve responder automaticamente com nova offer, sem precisar fechar e reabrir a transmissão.
6. **Correção Internacional**: Conexões com latência ≥ 200ms (ex: Brasil–Portugal) devem estabelecer a stream com sucesso via TURN relay, ou exibir o badge "Sem sinal" com botão de retry dentro de 20s — nunca tela preta silenciosa.
7. **Feedback Visual**: Nenhum estado de falha deve ser silencioso. Tela preta com stream "supostamente ativa" deve sempre exibir o badge de reconexão.

## Plano de Ação
1. **Manager**: Verificar configuração `iceServers` e parear com `VoiceManager` (STUN + TURN).
2. **Manager**: Ao receber `peer-join`, fechar conexão anterior do peer (se existir) e recriar.
3. **Manager**: Implementar `getAdaptiveBitrate(peerCount)` e aplicar no `sender.setParameters`.
4. **Manager**: Adicionar `normalizar(id)` e aplicar em todas as comparações de `userId`.
5. **Manager**: Safety timeout de 15s para conexões presas em `new` ou `connecting`.
6. **Manager**: Adicionar `reconnect()` que fecha conexão local e re-envia `peer-join`.
7. **Hook**: Expor `reconnect` do manager via `useSessionScreenControl`.
8. **UI**: Substituir conditional render por `display: none` CSS baseado em `activeTab`.
9. **UI**: Adicionar botão "🔄" no topo do player (visível apenas na Arena com stream ativa).
10. **UI**: Adicionar watchdog de `readyState` com badge "Sem sinal" após 10s sem track.
11. **UI (Mestre)**: Indicador de estado por peer no painel do broadcaster.

## Não-Escopo
- Gravação da transmissão.
- Múltiplas transmissões simultâneas (apenas 1 broadcaster por vez).
- Implementação própria de TURN server (usar serviço existente já configurado no `VoiceManager`).
