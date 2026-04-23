---
title: "Story 61 — Diagnostico de setState do MusicPlayer e iframe YouTube desacoplado do shell"
description: "Apos stories 59 (sem mais YT_MOUNT churn) e 60 (filtro de CharacterCard ocultos + startTransition + memo) confirmadas no source atual, o trace `Trace-20260423T194121.json` ainda mostra o iframe do YouTube como o maior contribuinte de main thread (583ms em 45s) e um `requestIdleCallback` de 683ms vindo do widget API. O MusicPlayer fica sempre montado dentro de UnifiedSoundPanel/HeaderWrapper e o painel apenas alterna CSS (`isOpen`), mantendo o iframe vivo mesmo fechado. Esta story tem duas fases: (1) instrumentar o MusicPlayer para provar/refutar fan-out de setState a partir de callbacks YT; (2) com base nos dados, decidir entre auditar fan-out de estado ou portar o container do iframe para fora da subarvore do HeaderWrapper. NAO pode quebrar continuidade de audio: PLAYER tambem precisa do MusicPlayer montado para receber `MUSIC_PLAYBACK_CHANGED` via Event Store."
priority: "alta"
status: "planejada"
last_updated: "2026-04-23"
related: ["story-55-musicplayer-receiver-youtube-idempotencia", "story-59-rerender-cascata-musicplayer-main-thread", "story-60-dom-compacto-mobile-e-inp-sub-200ms"]
tags: [performance, react, mobile, main-thread, componente]
epic: epic-01-refatoracao-modular
---

# Story 61 — Diagnostico de setState do MusicPlayer e iframe YouTube desacoplado do shell

## Contexto

Estado verificado no source em 2026-04-23:

- Story 59 entregue: MusicPlayer nao remonta mais (`YT_MOUNT` sumiu do log; `YT_NATIVE_READY` / `YT_NATIVE_STATE` / `YT_UNLOCK_APPLIED` em producao)
- Story 60 entregue: `visiblePlayerCharacters` filtra ocultos em `CharactersTab.tsx:55`; `startTransition` em `page.tsx:187`; `memo` em `CharacterCard.tsx:369`
- NAO existe `addEventListener("message", ...)` manual em `src/` (grep retornou zero matches) — fan-out, se houver, vem dos callbacks oficiais do `YT.Player` (`onReady`, `onStateChange`, `onError`)

O que o trace mais recente (`Trace-20260423T194121.json` + `logs_travamento_geral_site.txt`) ainda mostra:

- `[Violation] 'requestIdleCallback' handler took 683ms` originado em `www-widgetapi.js`
- `[Violation] 'setTimeout' handler took 251ms` (linha 177 do log)
- Bloco continuo de `o9 → o5` no mount inicial (begin/complete work do React reconciler)
- `Failed to execute 'postMessage'` do widget YouTube por mismatch de origin (`window.location.origin` aponta para preview Vercel `pzf4gpeyz-...`)

O iframe vive em:

```
HeaderWrapper.tsx:56
  -> UnifiedSoundPanel.tsx:16
      -> MusicPlayer (memo)
          -> div#yt-audio-XXXX  (recebe new YT.Player em MusicPlayer.tsx:448)
```

`UnifiedSoundPanel` so alterna a classe CSS `.show` (ver `UnifiedSoundPanel.tsx:38`), entao o iframe permanece montado e ativo no main thread mesmo com painel fechado.

---

## Hipoteses a validar (esta story so confirma; correcao definitiva depende dos dados)

1. **H1 (provavel)**: Custo residual e dominado pelo proprio runtime do iframe YouTube (widget API rodando setInterval/postMessage/requestIdleCallback), independente de re-render React. Nesse caso o trabalho e desacoplar/reduzir o iframe.
2. **H2 (a descartar)**: Callbacks `onStateChange` do YT estao chamando `setState` no MusicPlayer com frequencia, e algum desses setState borbulha pra fora do `memo` do MusicPlayer (ex.: prop instavel vinda de UnifiedSoundPanel/HeaderWrapper).
3. **H3 (a descartar)**: `globalEventStore.subscribe` no MusicPlayer (`MusicPlayer.tsx:544`) esta disparando setState mesmo em events nao relacionados a musica.

---

## FASE 1 — Instrumentacao (obrigatoria, baixo risco)

Objetivo: produzir um log que diga, em 30s no celular, quantos setState e quantos callbacks YT ocorreram. Sem isso, qualquer correcao e chute.

### Passo 1.1 — Criar helper de log dedicado

Criar arquivo novo `front_sistema_rpg/src/lib/story61Debug.ts`. Copiar o padrao de `story59Debug.ts`:

```ts
"use client";

const STORY61_DEBUG_KEY = "debugStory61";
let cachedStory61DebugEnabled: boolean | null = null;

export function isStory61DebugEnabled(): boolean {
    if (cachedStory61DebugEnabled !== null) return cachedStory61DebugEnabled;
    if (typeof window === "undefined") return false;
    try {
        cachedStory61DebugEnabled = window.localStorage?.getItem(STORY61_DEBUG_KEY) === "1";
        return cachedStory61DebugEnabled;
    } catch {
        cachedStory61DebugEnabled = false;
        return false;
    }
}

export function logStory61(component: string, event: string, data?: Record<string, unknown>): void {
    if (!isStory61DebugEnabled()) return;
    if (data) {
        console.debug(`[Story61][${component}] ${event}`, data);
        return;
    }
    console.debug(`[Story61][${component}] ${event}`);
}
```

Ativacao no celular: `localStorage.setItem("debugStory61", "1")` no DevTools remoto, depois reload.

### Passo 1.2 — Contadores de setState no MusicPlayer

Em `front_sistema_rpg/src/components/MusicPlayer.tsx`:

1. Adicionar import no topo (junto com o de `logStory59`):
   ```ts
   import { logStory61 } from "@/lib/story61Debug";
   ```

2. Logo apos `renderCountRef.current += 1;` (linha 98 atual), adicionar:
   ```ts
   logStory61("MusicPlayer", "render", { count: renderCountRef.current });
   ```

3. Dentro do callback `onStateChange` (linha 489 atual), antes do `if (ev?.data === ...)`, adicionar:
   ```ts
   logStory61("MusicPlayer", "yt-onStateChange", { state: ev?.data });
   ```

4. Dentro do callback `onReady` (linha 465 atual), apos o `console.log("[MusicPlayer] YT_NATIVE_READY")`, adicionar:
   ```ts
   logStory61("MusicPlayer", "yt-onReady");
   ```

5. Dentro do callback `onError` (linha 502 atual), apos o `console.warn(...)`, adicionar:
   ```ts
   logStory61("MusicPlayer", "yt-onError", { error: e?.data });
   ```

6. **NAO criar wrappers em volta de cada `setX` existente** — isso polui o componente. Usar React DevTools Profiler para o que faltar. O log de render ja conta quantas vezes o componente renderizou; quantos setState dispararam fica visivel pelo delta entre renders.

### Passo 1.3 — Logar eventos do EventStore que tocam o MusicPlayer

No `globalEventStore.subscribe` (linha 544 atual), no inicio do callback (antes do primeiro `if`):

```ts
logStory61("MusicPlayer", "event-received", { type: event.type, seq: event.seq });
```

### Passo 1.4 — Validar build local

```bash
cd front_sistema_rpg
npx tsc --noEmit
npm run build
```

Sem warnings novos. Sem erros de tipo.

### Passo 1.5 — Coleta no celular (instrucao para o operador humano)

1. Deploy/preview com as mudancas
2. Abrir Chrome DevTools remoto no celular do Mestre
3. No console: `localStorage.setItem("debugStory61", "1"); location.reload();`
4. Entrar na sessao, deixar idle por 30s sem interagir, com o painel de som FECHADO
5. Trocar uma musica pelo painel
6. Fechar o painel novamente, esperar mais 30s
7. Salvar log em `front_sistema_rpg/DEBUG_CELULAR/logs_story61.txt`
8. Salvar trace em `front_sistema_rpg/DEBUG_CELULAR/Trace-story61.json`

### Passo 1.6 — Reportar achados (criterio para encerrar Fase 1)

A pessoa que aplicar deve abrir o log e responder, no proprio arquivo da story (secao "Resultados Fase 1"):

- Quantos `[Story61][MusicPlayer] render` em 30s idle com painel fechado?
- Quantos `[Story61][MusicPlayer] yt-onStateChange` em 30s idle?
- Quais `event.type` foram recebidos do EventStore em 30s idle?
- O numero de renders e proximo de zero (esperado)? Se nao, qual a frequencia?

---

## FASE 2 — Correcao (escolhida apos Fase 1, NAO aplicar antes)

### Cenario A: Fase 1 mostra renders frequentes em idle (H2 ou H3 confirmadas)

Aplicar **somente o que os dados apontarem**:

- Se `event-received` com tipos NAO musicais aparece com frequencia em idle: adicionar `early return` no subscribe para tipos irrelevantes (filtrar antes de qualquer logica).
- Se `yt-onStateChange` dispara com frequencia em idle e `setYtAutoplayUnlocked(true)` esta sendo chamado mesmo quando ja e `true`: ja existe React `Object.is` bailout, entao se ainda renderiza e porque algum **outro** setState esta sendo chamado. Identificar qual via log adicional dirigido.

### Cenario B: Fase 1 mostra zero/poucos renders em idle (H1 confirmada — custo e do iframe nativo)

Aplicar **uma** das opcoes abaixo, em ordem de risco crescente. NAO empilhar.

#### Opcao B1 (preferida — menor risco): Portal do container YT para `document.body`

**Motivacao**: o iframe continua vivo (audio nao quebra), mas sai da subarvore React do HeaderWrapper/UnifiedSoundPanel. Reduz custo de layout/composite quando o painel anima abrir/fechar; nao reduz o custo do widget API em si.

**Mudanca exata** em `MusicPlayer.tsx`:

- Localizar onde o `<div id={ytContainerIdRef.current} />` e renderizado no JSX (procurar pela string `ytContainerIdRef.current` no return)
- Envolver esse div em `createPortal` para `document.body`, atras de uma flag `isMounted` (que ja existe no estado local linha 120):

```tsx
{isMounted && typeof document !== "undefined" && createPortal(
    <div
        id={ytContainerIdRef.current}
        style={{ position: "absolute", left: -9999, top: -9999, width: 1, height: 1, pointerEvents: "none" }}
        aria-hidden="true"
    />,
    document.body,
)}
```

`createPortal` ja esta importado (linha 4). Manter o restante do JSX inalterado. Importante: nao adicionar `display: none` (algumas versoes da YT IFrame API param de despachar eventos de audio quando o iframe e ocultado por display).

#### Opcao B2 (somente se B1 nao bastar — risco medio): Suspensao do YT.Player apos idle longo

**Motivacao**: destruir o player apos N segundos sem `MUSIC_PLAYBACK_CHANGED` e sem `isPlaying`. Recriar no proximo evento. Custo: latencia de 1-2s na primeira retomada.

**NAO IMPLEMENTAR sem aprovacao explicita do Mestre** — quebra UX se o GM espera que tocar imediatamente ao clicar.

#### Opcao B3 (rejeitada): Desmontar o MusicPlayer quando painel fechado

Rejeitada porque PLAYER tambem precisa receber `MUSIC_PLAYBACK_CHANGED` para sincronizar audio. Desmontar quebra a sincronia.

---

## Escopo

### Incluido

- `src/lib/story61Debug.ts` (novo)
- `src/components/MusicPlayer.tsx` (instrumentacao em Fase 1; opcionalmente Portal em Fase 2 Opcao B1)

### Excluido

- `UnifiedSoundPanel.tsx`, `HeaderWrapper.tsx` — nao mexer
- `AtmosphericPlayer.tsx`, `TransmissionPlayer.tsx` — nao mexer (nao usam YT iframe)
- Refatoracao do MusicPlayer alem do escopo (componente tem ~1200 linhas; nao quebrar em sub-componentes nesta story)
- Qualquer mudanca em logica de Event Sourcing
- Backend
- CSS / animacoes do painel

---

## Criterios de aceitacao

### Fase 1 (obrigatoria)

- [ ] `src/lib/story61Debug.ts` criado e exporta `logStory61` e `isStory61DebugEnabled`
- [ ] Logs de render, `yt-onStateChange`, `yt-onReady`, `yt-onError` e `event-received` adicionados nos pontos exatos descritos
- [ ] `npx tsc --noEmit` limpo
- [ ] `npm run build` sem warnings novos
- [ ] Sem mudanca de comportamento quando `localStorage.debugStory61` nao esta setado (cache em modulo evita custo)
- [ ] Coleta no celular feita e logs salvos em `DEBUG_CELULAR/logs_story61.txt`
- [ ] Secao "Resultados Fase 1" preenchida nesta story com os numeros observados

### Fase 2 (depende dos resultados da Fase 1)

- [ ] Decidido Cenario A ou B com base nos dados da Fase 1
- [ ] Se B1 aplicada: audio continua tocando ao trocar musica, ao abrir/fechar painel e ao trocar de aba
- [ ] Se B1 aplicada: iframe nao aparece visualmente em lugar nenhum (esta off-screen)
- [ ] Se B1 aplicada: validacao no celular mostra reducao mensuravel em Long Tasks vindas de `4bd1b696-*.js` durante animacao do painel
- [ ] Story 60 nao regride (filtro de fichas, startTransition e memo continuam ativos)
- [ ] Arena continua fluida (sem regressao)

---

## Riscos

- **Audio quebrado por Portal mal aplicado**: se o div do container nao estiver no DOM quando `new YT.Player` e chamado, o player nao inicia. Mitigacao: `isMounted` ja garante mount client-side; o effect de criacao do player so roda apos `isMounted=true`.
- **Conflito de id**: dois `MusicPlayer` simultaneos no DOM via Portal causariam ids duplicados. Mitigacao: `ytContainerIdRef.current` ja usa UUID por instancia.
- **Cache de `isStory61DebugEnabled`**: o cache em modulo so le o localStorage uma vez por sessao. Para alternar debug sem reload, limpar o cache manualmente (`window.location.reload()` resolve).
- **Iframe off-screen pode ser detectado por bloqueadores de anuncio**: aceitavel — o erro `ERR_BLOCKED_BY_CLIENT` ja aparece hoje no log e nao impede playback.

---

## Resultados Fase 1

> Preencher apos coleta no celular.

- Renders em 30s idle (painel fechado): _N_
- yt-onStateChange em 30s idle: _N_
- Tipos de evento recebidos em 30s idle: _lista_
- Cenario escolhido: _A ou B_
- Justificativa: _texto curto_

---

## Arquivos de referencia

- Trace atual: `front_sistema_rpg/DEBUG_CELULAR/Trace-20260423T194121.json`
- Log atual: `front_sistema_rpg/DEBUG_CELULAR/logs_travamento_geral_site.txt`
- Padrao de instrumentacao: `front_sistema_rpg/src/lib/story59Debug.ts`
- Stories anteriores: story-55, story-59, story-60
