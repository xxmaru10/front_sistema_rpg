---
story: story-27
title: Seleção de Dispositivo de Áudio — Qualidade de Voz com Headset Bluetooth
status: aguardando aprovação
priority: média
tags: webrtc, audio, ui, config
---

# Story-27: Seleção de Dispositivo de Áudio — Qualidade de Voz com Headset Bluetooth

## Contexto do Problema

Uma jogadora usa o headset **Havit Fuxi-H3** (Quad-Mode: 2,4GHz, Bluetooth, USB-C, 3,5mm). Ela reporta que:

- **A voz dela fica com qualidade ruim** para os outros jogadores.
- **O que ela ouve no canal de voz também fica com qualidade ruim.**
- No Discord, o problema não ocorre.

### Diagnóstico Técnico (Root Cause)

O problema **não é o Bluetooth em si**, mas o **Bluetooth HFP (Hands-Free Profile)**:

Quando o navegador captura microfone **e** reproduz áudio pelo mesmo dispositivo Bluetooth,
o sistema operacional negocia o perfil HFP, que degrada **ambos os canais** (entrada e saída)
para ~8kHz de largura de banda — qualidade de ligação telefônica.

**Por que o Discord não sofre disso?**
O Discord expõe seletores explícitos de dispositivo de entrada/saída. A jogadora pode usar,
por exemplo, o fone BT em A2DP (alta qualidade) para saída e o microfone de outro dispositivo
ou do modo 2,4GHz para entrada, evitando que o SO ative o HFP.

**Nossa implementação atual:**
- `getUserMedia` é chamado sem `deviceId` — usa o dispositivo padrão do sistema, que é o HFP
  quando um headset BT está ativo.
- Não há seletor de dispositivo de entrada ou saída no `VoiceChatPanel.tsx`.
- `setSinkId` não é aplicado nos elementos `HTMLAudioElement` dos peers — saída sempre vai
  para o destino padrão do SO.

---

## Objetivos

- [ ] Listar dispositivos de áudio disponíveis via `MediaDevices.enumerateDevices()`.
- [ ] Adicionar seletor de **dispositivo de entrada** (microfone) no painel de voz.
- [ ] Adicionar seletor de **dispositivo de saída** (fones) no painel de voz.
- [ ] Propagar o `deviceId` de entrada para `getUserMedia` dentro do `VoiceChatManager`.
- [ ] Aplicar `setSinkId` nos `HTMLAudioElement` dos peers quando um dispositivo de saída for escolhido.
- [ ] Persistir a preferência de dispositivo no `localStorage` para ser lembrada entre sessões.

---

## Arquivos Afetados

| Arquivo | Mudança |
|---|---|
| `src/lib/VoiceChatManager.ts` | Aceitar `audioInputDeviceId` em `joinVoice()`; aplicar `setSinkId` ao adicionar peers |
| `src/components/VoiceChatPanel.tsx` | Adicionar dropdowns de entrada/saída; chamar `enumerateDevices()`; chamar `setSinkId` global |

> **Fora de escopo:** alterações no backend, na sinalização WebRTC, no fluxo Supabase ou no sistema de sessões.

---

## Critérios de Aceitação

1. **Seletor de entrada visível**: O painel de voz exibe um `<select>` ou dropdown com os dispositivos de entrada de áudio disponíveis (`audioinput`).
2. **Seletor de saída visível**: O painel de voz exibe um `<select>` ou dropdown com os dispositivos de saída de áudio disponíveis (`audiooutput`).
3. **Aplicação imediata de entrada**: Ao selecionar um novo microfone estando no canal, o stream local é recriado com o novo `deviceId` sem desconectar do canal.
4. **Aplicação imediata de saída**: Ao selecionar um novo dispositivo de saída, o áudio de todos os peers passa a ser reproduzido nele via `setSinkId`.
5. **Persistência**: A escolha de entrada e saída é salva em `localStorage` e restaurada ao entrar no canal na próxima sessão.
6. **Fallback gracioso**: Se `setSinkId` não for suportado pelo navegador (ex: Firefox), os seletores de saída são ocultados ou exibem um aviso, sem quebrar o canal.
7. **Sem regressão**: As funcionalidades existentes (mute, volume boost, PTT, refresh nuclear, detecção de fala) continuam funcionando normalmente.
8. **Teste manual com o headset reportado**: A jogadora consegue selecionar o microfone via 2,4GHz (ou wired) e o áudio de outros jogadores sai pelos fones BT em alta qualidade (A2DP), eliminando o degradamento por HFP.

---

## Notas de Implementação (para agente de código)

- **`enumerateDevices` exige permissão de microfone** antes de retornar labels. Chamar após `getUserMedia` já existente em `joinVoice`.
- **`setSinkId`** é uma API experimental; verificar `typeof audioEl.setSinkId === 'function'` antes de chamar.
- **Troca de entrada em tempo real**: Usar `VoiceChatManager.setMicDevice(deviceId)` (novo método) que internamente:
  1. Para as tracks do stream local atual.
  2. Chama `getUserMedia` com o novo `deviceId`.
  3. Substitui o track em todos os `RTCPeerConnection` via `sender.replaceTrack()`.
- **Não usar re-join completo** para trocar microfone — causaria reconexão WebRTC e flickering.
- Manter os seletores dentro da seção de configurações já existente no painel, sem adicionar nova área de UI.
