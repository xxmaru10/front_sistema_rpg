---
title: "Story 57 - Nitidez de Texto na Transmissão de Tela (contentHint como experimento)"
description: "Testar conservadoramente se a legibilidade de texto durante screen share melhora sem reverter as decisões de CPU da story 54. Caminho em duas etapas: (1) validar o botão 'Tentar 1080p' já existente; (2) se ainda ruim, reintroduzir track.contentHint = 'text' isolado, sem mexer em degradationPreference, maxBitrate ou scaleResolutionDownBy."
priority: "média"
status: "em-revisão"
last_updated: "2026-04-23"
related: ["story-54-performance-transmissao-voz-e-render-cpu-100"]
tags: [webrtc, screenshare, ui, ux, experimento]
epic: epic-01-refatoracao-modular
---

# Story 57 - Nitidez de Texto na Transmissão de Tela (contentHint como experimento)

## Contexto

O Mestre relata que, durante screen share, **a qualidade das letras é ruim de ler** no lado do jogador. Log do cliente confirma:

```
[ScreenShare] Auto-downgrade activated (fps) -> 720p@24
```

O auto-downgrade caiu para 720p@24fps por decisão intencional da **story 54** (Passo 2), que prioriza CPU em máquinas fracas.

### Estado atual do código (verificado em 2026-04-23)

- [screen-share-manager.ts:668](/src/lib/screen-share-manager.ts:668) e [screen-share-manager.ts:1017](/src/lib/screen-share-manager.ts:1017): `setDegradationPreference('balanced')` — **decisão consciente da story 54** para não travar CPU.
- `track.contentHint` **não é setado** — foi **removido** pela story 54 (Passo 1, nota: "Revisar `contentHint = 'detail'` — manter apenas se a nitidez de mapa/texto compensar o custo extra de encode; caso contrário remover").
- `scaleResolutionDownBy` **não é configurado** — comportamento default do navegador (reduzir resolução sob pressão).
- Auto-downgrade sticky 1080p → 720p baseado em `qualityLimitationReason === 'cpu'`, FPS < 18 ou drop-rate > 0.15 ([screen-share-manager.ts:952-973](/src/lib/screen-share-manager.ts:952)).
- Badge/UI "Qualidade reduzida para 720p" + botão **"Tentar 1080p"** já implementado (parte do Passo 2 da story 54).

### Tentativa anterior rejeitada

Uma investigação inicial sugeriu reintroduzir simultaneamente `contentHint = 'detail'`, `scaleResolutionDownBy = 1.0` e trocar `degradationPreference` para `'maintain-resolution'`. **Isso foi rejeitado** porque reverte diretamente a estratégia de CPU da story 54 e pode piorar o desempenho no notebook fraco da jogadora — justamente o hardware que a story 54 protege. Esta story adota um caminho **conservador e faseado**, com **um único grau de liberdade** por etapa.

---

## Comportamento Esperado

### Etapa 1 — Validação do botão "Tentar 1080p" (sem código novo)

O Mestre executa um teste manual:

1. Inicia screen share normalmente; se o auto-downgrade disparar, a UI exibe a badge "Qualidade reduzida para 720p".
2. Clica em **"Tentar 1080p"**.
3. Compartilha uma **ficha de personagem** com bastante texto (perícias, aspectos, lore) ou um **documento de notas**.
4. O jogador reporta legibilidade em três pontos:
   - Título (fonte grande): legível?
   - Corpo (fonte média, ~14 px): legível?
   - Detalhe (fonte pequena, ~11 px): legível?

**Registro esperado**: um parágrafo no ticket, com print do lado do jogador, descrevendo quais tamanhos de fonte são legíveis em 1080p.

### Etapa 2 — Decisão

- **Se legível em 1080p**: o problema é o auto-downgrade sticky. Fim da story como experimento bem-sucedido. Atualizar a UI para deixar o botão "Tentar 1080p" **mais visível** (ex.: tooltip explicando "Melhor para leitura de texto") e documentar a recomendação no `architecture.md` ("para mesas com foco em leitura de ficha, manter em 1080p").
- **Se ilegível mesmo em 1080p**: avançar para Etapa 3.
- **Se o botão 1080p disparar downgrade imediato de volta a 720p** (máquina do Mestre não aguenta): documentar e avançar para Etapa 3 (o botão não resolve sozinho nesse hardware).

### Etapa 3 — Experimento isolado: `contentHint`

Reintroduzir **apenas** `videoTrack.contentHint = 'text'` imediatamente após a captura em `getDisplayMedia`, em `screen-share-manager.ts` (no ponto onde a track é obtida e antes de `pc.addTrack`). **Nada mais muda**:

- `degradationPreference` permanece `'balanced'`.
- `maxBitrate`, `maxFramerate` permanecem iguais.
- `scaleResolutionDownBy` permanece sem configuração explícita.
- Auto-downgrade sticky permanece igual.

**Por que `'text'` e não `'detail'`**: `contentHint = 'text'` é a dica específica para conteúdo de texto estático (documentos, código) — otimiza encoder para preservar nitidez de arestas em baixa variação temporal. `'detail'` é mais genérico (apresentações, UI) e foi a opção anterior removida; se ela não bastou, ficar nela de novo não ajuda. `'text'` é menos testado em browsers (Chrome implementa desde M73), mas o custo é zero: se o navegador não suportar, ignora silenciosamente.

### Etapa 4 — Medição da Etapa 3

1. Mestre ativa a build com `contentHint = 'text'`.
2. Compartilha a mesma ficha da Etapa 1.
3. Jogador reporta:
   - Legibilidade melhorou (sim/não/marginalmente)?
   - Houve regressão de CPU? (medir com Task Manager ou `chrome://webrtc-internals`)
4. **Se melhorou e não houve regressão de CPU**: manter em produção.
5. **Se não melhorou**: remover o `contentHint` e registrar o resultado negativo no ticket e no `architecture.md` ("experimento realizado em 2026-04-XX: `contentHint = 'text'` não produziu melhora perceptível em 720p@24fps; decisão: manter sem hint, conforme story 54").
6. **Se piorou a CPU de forma mensurável**: remover imediatamente.

---

## Escopo

### Incluído
- Validação manual do botão "Tentar 1080p" (sem código).
- Se necessário, adicionar **uma linha** em `screen-share-manager.ts` setando `videoTrack.contentHint = 'text'` após a captura.
- Tooltip/label do botão "Tentar 1080p" deixando claro que é recomendado para leitura de texto (mudança de string/UI de ≤ 3 linhas).
- Registro do experimento em `architecture.md`.

### Explicitamente excluído
- **Não mexer em `degradationPreference`**. Mantém `'balanced'` da story 54.
- **Não introduzir `scaleResolutionDownBy`**.
- **Não alterar `maxBitrate`, `maxFramerate`, `priority`, `networkPriority`**.
- **Não alterar gatilhos do auto-downgrade sticky** (`qualityLimitationReason`, FPS threshold, drop-rate).
- **Não** adicionar codec preference (VP9/AV1) via SDP munging — risco alto, ganho incerto, fora do escopo desta story conservadora.
- **Não** alterar `getDisplayMedia` constraints (resolução pedida, `displaySurface`, `cursor`).
- **Não** introduzir simulcast, `encodings[].active`, nem mudar a topologia mesh.
- **Não** tocar no `VoiceChatManager` nem em qualquer coisa não-vídeo.

---

## Arquivos Afetados (Estimativa Inicial)

### WebRTC
- `src/lib/screen-share-manager.ts` — **UMA** adição de linha setando `videoTrack.contentHint = 'text'` após captura em `getDisplayMedia`, antes do `addTrack` (Etapa 3 apenas). Guardar atrás de um feature flag local/comentado se necessário para rollback rápido.

### UI
- Arquivo do componente que renderiza o botão "Tentar 1080p" (localizar no uso real — provavelmente em um overlay de screen share sob `src/components/` ou inline na página da sessão). Ajustar apenas tooltip/label, se o Mestre decidir que vale expor mais a opção.

### Documentação
- `knowledge/architecture.md` — registrar resultado do experimento (bem-sucedido ou não).

---

## Critérios de Aceitação

- [ ] **Etapa 1 executada**: Mestre testou o botão "Tentar 1080p" e o jogador relatou legibilidade por tamanho de fonte. Resultado registrado no ticket.
- [ ] **Decisão registrada** entre: (a) 1080p resolve → melhorar UI do botão; (b) precisa avançar para `contentHint`.
- [ ] Se Etapa 3 for executada: **apenas uma linha** adicionada em `screen-share-manager.ts` com `contentHint = 'text'`. Nenhuma outra mudança em parâmetros WebRTC.
- [ ] **Medição de CPU antes/depois** da Etapa 3 registrada (em máquina do Mestre **e** notebook da jogadora).
- [ ] **Nenhuma regressão** na performance da story 54: CPU do transmissor não sobe acima da baseline atual em hardware fraco.
- [ ] Auto-downgrade sticky continua funcional (não é alterado).
- [ ] Modo 1080p continua acessível via botão existente.
- [ ] `next build` sem warnings novos.
- [ ] `knowledge/architecture.md` atualizado com o resultado final (melhora confirmada / nula / negativa).

---

## Riscos e Notas de Implementação

- **`contentHint = 'text'` pode ser ignorado** por alguns navegadores ou ter efeito marginal em 720p@24fps. Chrome/Edge (Blink) suportam desde M73; Firefox suporta parcialmente; Safari depende da versão. Mitigação: aceitar resultado negativo como dado válido e remover a linha — não insistir.
- **Risco zero de regressão de CPU** com apenas `contentHint`: é dica, não reconfiguração. Se mesmo assim houver sinal de piora, remover.
- **Não é o mesmo que `'detail'`**: a story 54 removeu `'detail'`; `'text'` é semanticamente diferente. Vale a tentativa isolada antes de declarar o caminho hint-based como encerrado.
- **Notebook da jogadora é o gate**: mesmo que 1080p+contentHint fique lindo no desktop do Mestre, a decisão final só fecha depois de medir CPU no notebook fraco que a story 54 protege.
- **Não partir direto para Etapa 3** sem executar Etapa 1. Se 1080p resolve, toda esta story vira documentação + tooltip. Essa é a ordem por economia de esforço e risco.
- **Se tudo falhar**: abrir story 58 futura para investigar codec (VP9/AV1 via SDP munging) ou topologia SFU. Fora do escopo desta.

---

**NOTA:** Não iniciar implementação sem completar a Etapa 1 (teste manual do botão "Tentar 1080p"). Esta story foi redigida para ser auto-suficiente — qualquer agente de IA deve conseguir aplicá-la lendo apenas este arquivo, a story 54 e os arquivos listados em "Arquivos Afetados".
