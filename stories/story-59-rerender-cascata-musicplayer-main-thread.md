---
title: "Story 59 - Long Tasks no Shell do Header (HeaderWrapper + VoiceChat + YouTube iframe)"
description: "Trace mobile de 2026-04-23 mostra Long Tasks de ~1s congelando o DOM fora da arena. A arena segue fluida, entao o gargalo esta no main thread do shell persistente da sessao. Os sinais mais fortes apontam para HeaderWrapper/VoiceChatPanel/UnifiedSoundPanel e para o custo do iframe do YouTube no main thread. O log `YT_MOUNT` existe no bundle capturado no celular, mas nao existe no source atual; portanto a remontagem do MusicPlayer ainda precisa ser reconfirmada no codigo presente antes de virar causa raiz fechada."
priority: "critica"
status: "em-revisao"
last_updated: "2026-04-23"
related: ["story-54-performance-transmissao-voz-e-render-cpu-100", "story-55-musicplayer-receiver-youtube-idempotencia", "story-58-performance-abas-ficha-notas-header"]
tags: [performance, react, mobile, main-thread]
epic: epic-01-refatoracao-modular
---

# Story 59 - Long Tasks no Shell do Header (HeaderWrapper + VoiceChat + YouTube iframe)

## Contexto

Trace de 45 segundos coletado via Chrome DevTools remote inspect no celular do Mestre em 2026-04-23.
Arquivos em `front_sistema_rpg/DEBUG_CELULAR/`.

O sinal definidor desta story e:

> A arena continua fluida, enquanto notas, fichas e painel de voz travam.

Isso aponta para bloqueio do main thread do JavaScript e do pipeline de renderizacao do DOM. O problema nao parece estar no Canvas/WebGL da arena, e sim no shell persistente da sessao.

### Arvore atual relevante do codigo

Leitura estatica do source atual:

- `src/app/layout.tsx` renderiza `HeaderWrapper` e `FloatingNotes`
- `src/components/HeaderWrapper.tsx` renderiza `UnifiedSoundPanel` e `VoiceChatPanel`
- `src/components/header/UnifiedSoundPanel.tsx` renderiza `TransmissionPlayer`, `AtmosphericPlayer` e `MusicPlayer`
- `UnifiedSoundPanel` nao desmonta seus filhos ao fechar; `isOpen` apenas alterna classe CSS

Conclusao importante: a hipotese antiga de que `MusicPlayer` e `VoiceChatPanel` vivem juntos em `page.tsx` nao bate com o codigo atual. O shell compartilhado mais provavel e `HeaderWrapper`, acima da pagina da sessao.

---

## Evidencias do Trace

### Distribuicao de CPU (45s)

| Categoria | Tempo | % |
|---|---:|---:|
| Scripting | 1.901 ms | 42% |
| System | 1.195 ms | 26% |
| Rendering | 854 ms | 19% |
| Painting | 282 ms | 6% |

Scripting + Rendering concentram a maior parte do custo, coerente com bloqueio do main thread e churn de DOM/React.

### Third parties no main thread

| Origem | Main Thread Time |
|---|---:|
| [unattributed] | 3.190 ms |
| youtube.com | 583,8 ms |
| vercel.app (1st party) | 455,3 ms |

O iframe/player do YouTube aparece como custo real de main thread no trace, mesmo sem ser a unica explicacao.

### Long Tasks

Os piores blocos ficam no intervalo aproximado `39.450s - 39.472s`, com picos de ~1s.

Isso e forte o suficiente para congelar toda a UI baseada em DOM no celular.

---

## Evidencias dos Logs

### 1. `YT_MOUNT` repetido no bundle capturado

O arquivo `logs_travamento_geral_site.txt` mostra `YT_MOUNT` repetido 7x em 45s, sempre vindo do bundle `layout-...js`.

Interpretacao segura:

- o shell compartilhado do layout/header esta envolvido
- o YouTube/MusicPlayer participa do problema observado no deploy capturado

Limite importante:

- o string `YT_MOUNT` nao existe no source atual
- portanto, esse marcador pode vir de instrumentacao temporaria, build anterior ou codigo ja alterado
- antes de implementar correcao focada em remontagem, precisamos reproduzir esse sinal no codigo presente

### 2. Churn forte no Voice Chat

Os logs mostram, no mesmo intervalo de uso:

- `voice-join -> broadcast` repetido
- varios `Signal received: voice-join from ...` mesmo com peers ja conectados
- `Presence Update` frequente
- `charId: "MISSING"` para o Mestre em parte das atualizacoes

Isso sugere churn de estado no subsistema de voz, com potencial para provocar re-render frequente no `VoiceChatPanel` e em componentes irmaos no mesmo shell.

### 3. Polling/reativacao de Screen Share

O log mostra `Visibility visible, checking connection...` repetido mesmo sem evidencias de transmissao ativa no momento do congelamento.

Ainda nao parece o suspeito principal, mas e um gerador plausivel de atualizacoes extras no shell.

---

## Hipotese Consolidada

Hipotese principal atual:

1. O problema mora no shell persistente do header/layout, nao na arena.
2. O maior suspeito de churn recorrente hoje e o fluxo de voz/presenca.
3. O iframe/player do YouTube e um contribuinte relevante de main thread e pode estar amplificando travamentos.
4. A remontagem do `MusicPlayer` ainda e hipotese de investigacao, nao causa raiz confirmada no source atual.

Em outras palavras:

```text
layout.tsx
  -> HeaderWrapper
      -> UnifiedSoundPanel
          -> MusicPlayer / AtmosphericPlayer / TransmissionPlayer
      -> VoiceChatPanel
  -> FloatingNotes
```

Se `HeaderWrapper` ou algum filho persistente entra em churn de estado, o impacto recai exatamente nos elementos DOM que travam no celular.

---

## O que esta story deve investigar

### Passo 1 - Confirmar a arvore real e o ponto de churn

Mapear no codigo atual quais estados/subscriptions podem disparar render em:

- `HeaderWrapper`
- `VoiceChatPanel`
- `UnifiedSoundPanel`
- `MusicPlayer`
- `FloatingNotes`

### Passo 2 - Reinstrumentar o codigo atual

Adicionar logs temporarios de mount/unmount e de render em:

- `HeaderWrapper`
- `UnifiedSoundPanel`
- `MusicPlayer`
- `VoiceChatPanel`

Objetivo: confirmar se existe unmount real, remount, ou apenas rerender em alta frequencia.

### Passo 3 - Abrir o trace e ler o call stack das Long Tasks

Carregar `DEBUG_CELULAR/Trace-20260423T170942.json` e inspecionar o stack no intervalo `39.450s - 39.472s`.

Pergunta que precisa sair respondida:

- o topo das Long Tasks aponta para React render/commit, para YouTube iframe, para VoiceChat, ou para uma combinacao deles?

### Passo 4 - Medir churn do Voice Chat

Instrumentar:

- emissao de `voice-join -> broadcast`
- atualizacoes de presence
- atualizacoes em lista de peers conectados

Objetivo: provar se existe loop ou retransmissao desnecessaria em idle.

### Passo 5 - Validar Screen Share visibility checks

Conferir se `check connection` continua rodando quando nao deveria e se isso toca estado observado pelo shell.

---

## Direcao de Correcao (depois da confirmacao)

### Prioridade 1 - Isolar churn do Voice Chat

- evitar broadcast redundante de `voice-join`
- so atualizar estado visual quando a lista de peers realmente mudar
- reduzir churn de `Presence Update`
- separar melhor logica de conexao e UI, se necessario

### Prioridade 2 - Estabilizar o shell do audio/YouTube

- garantir que `MusicPlayer` nao recrie player/iframe sem necessidade
- manter identidade estavel do subtree de audio
- considerar `React.memo` apenas se a causa for rerender por props, nao como paliativo cego
- preservar continuidade de audio; nao adotar lazy mount que quebre playback sem validar UX

### Prioridade 3 - Cortar polling lateral

- rodar verificacoes de screen share somente quando houver share/reconexao pendente
- revisar timers/listeners de visibilidade que possam acordar o shell sem necessidade

---

## Escopo

### Incluido

- `src/app/layout.tsx`
- `src/components/HeaderWrapper.tsx`
- `src/components/header/UnifiedSoundPanel.tsx`
- `src/components/MusicPlayer.tsx`
- `src/components/VoiceChatPanel.tsx`
- codigo de screen share que emite `Visibility visible, checking connection...`
- manager/logica de voz responsavel por `voice-join` e presence churn

### Excluido

- arena `Three.js` / `Battlemap`
- `FateDice3D`
- otimizacoes genericas de CSS da ficha/notas ja tratadas na story 58
- refatoracao ampla do EventStore sem evidencia no trace

---

## Criterios de Aceitacao

- [ ] Call stack das Long Tasks identificado no trace
- [x] Logs temporarios no codigo atual mostram se ha remount real ou apenas rerender frequente
- [ ] `HeaderWrapper`, `VoiceChatPanel` e `MusicPlayer` nao entram em churn recorrente em idle no celular
- [x] `voice-join -> broadcast` so ocorre quando a topologia de peers realmente muda
- [ ] `Presence Update` deixa de provocar cascata perceptivel de travamento
- [ ] Nenhuma Long Task acima de 200ms durante uso normal no celular do Mestre
- [ ] Notas, fichas e painel de voz respondem em menos de 100ms ao toque
- [ ] Arena continua fluida, sem regressao
- [x] `next build` sem warnings novos; `tsc --noEmit` limpo

## Implementacao 2026-04-23

- `VoiceChatManager` passou a deduplicar `onPresenceUpdate` e `onPeerUpdate`, evitando propagacao de snapshots identicos no shell do header.
- Heartbeat de voz em idle foi alterado de `voice-join` para `voice-presence`, mantendo presencia sem renegociacao recorrente.
- `VoiceChatPanel` passou a assinar somente `characters` (`useProjectedCharacters`) e ganhou guardas de igualdade para `setPeers`/`setParticipants`.
- `VoiceChatPanel`, `UnifiedSoundPanel` e `MusicPlayer` receberam `React.memo` com comparacao de props para isolar rerender vindo do `HeaderWrapper`.
- Instrumentacao temporaria da story (`localStorage.debugStory59 = "1"`) foi adicionada em `HeaderWrapper`, `UnifiedSoundPanel`, `MusicPlayer` e `VoiceChatPanel`.

---

## Riscos

- O trace capturado pode refletir um bundle levemente diferente do source atual.
- `React.memo` sozinho pode mascarar o sintoma sem resolver a causa de churn interno.
- Otimizacao agressiva no `MusicPlayer` pode quebrar continuidade de audio ou sincronizacao.
- O problema pode ser composto: Voice Chat gerando churn + YouTube consumindo main thread no mesmo intervalo.

---

## Arquivos de Referencia

- Trace: `front_sistema_rpg/DEBUG_CELULAR/Trace-20260423T170942.json`
- Logs: `front_sistema_rpg/DEBUG_CELULAR/logs_travamento_geral_site.txt`
- Screenshot: `front_sistema_rpg/DEBUG_CELULAR/Screenshot_1.png`
- Stories relacionadas: story-54, story-55, story-58
