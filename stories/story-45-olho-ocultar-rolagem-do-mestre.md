---
title: "Story 45 - Olho de Ocultar Rolagem do Mestre (Toggle de Visibilidade por Rolagem)"
description: "Adicionar um botão de olho (eye/eye-off) na caixa de rolagem 3D, visível apenas para o Mestre, que marca a rolagem atual como oculta dos jogadores. A ocultação deve ser por-rolagem (nunca global), reversível pelo Mestre após o fato, e não pode bugar logs, projeções nem efeitos de combate."
priority: "média"
status: "concluída"
last_updated: "2026-04-19"
tags: [ui, componente, regras, eventsourcing, fluxo, vtt]
epic: epic-01-refatoracao-modular
---

# Story 45 - Olho de Ocultar Rolagem do Mestre (Toggle de Visibilidade por Rolagem)

## Contexto

Hoje toda rolagem do Mestre passa por `useDiceRoller.finishRoll` e é emitida por
`createRollEvent` (em `src/lib/dice.ts`) como `ROLL_RESOLVED` com
`visibility: "PUBLIC"`. O evento é difundido via WebSocket para todos os
clientes na sala, aparece no `CombatLog`, no `FateResultOverlay` e é consumido
pelas projeções de combate (`COMBAT_TARGET_SET`, `COMBAT_OUTCOME`).

O Mestre deseja, **caso a caso**, poder "rolar por trás da cortina": ver o
resultado para si, mas impedir que jogadores vejam aquela rolagem específica
no log/overlay, sem afetar nenhuma outra rolagem presente ou futura. Também
deseja poder **revelar depois** a rolagem oculta (ao "desmarcar o olho"), de
modo que ela apareça para todos retroativamente.

A mudança é exclusivamente do lado do cliente (Event Sourcing): uma nova flag
no payload de `ROLL_RESOLVED` + um novo evento de toggle pós-fato, sem
alterações no backend.

---

## Comportamento Esperado

### Botão de olho na caixa 3D (GM-only)
- Dentro da caixa de rolagem 3D (`FateResultOverlay`), ao lado do ícone de
  lápis já existente (story-44), aparece um botão de **olho** (ícones `Eye` e
  `EyeOff` do `lucide-react`), tamanho ≈ 18–22 px, `pointer-events: auto`,
  `z-index` acima do canvas 3D.
- O botão **só é renderizado quando `userRole === "GM"`**. Para jogadores o
  elemento não existe no DOM (nem visível, nem oculto).
- Estado default: `Eye` (olho aberto) → próxima rolagem será **pública**.
- Ao clicar: alterna para `EyeOff` (olho com risco) → próxima rolagem será
  **oculta dos jogadores**. Clicar novamente volta para `Eye`.
- Tooltip: "Rolagem oculta aos jogadores" (quando ativo) / "Rolagem visível
  para todos" (quando inativo).
- O estado do toggle **persiste entre rolagens consecutivas** dentro da
  sessão: uma vez ativado, permanece ativo até o Mestre clicar novamente
  para desligar. Sobrevive a múltiplas aberturas/fechamentos da caixa 3D.
  Persistência em memória por sessão (não em `localStorage`): um refresh
  (F5) reseta para `Eye`. Trocar de sessão também reseta.

### Emissão do `ROLL_RESOLVED` com ocultação
- No momento do settle em `useDiceRoller.finishRoll`, se o flag de ocultação
  estiver ativo:
  - `createRollEvent` emite o evento com `visibility: "GM_ONLY"` em vez de
    `"PUBLIC"`.
  - O payload ganha um campo novo e explícito `hiddenForPlayers: true` para
    inspeção pelas projeções/UI sem depender só de `visibility`.
- Se o flag estiver inativo, comportamento atual preservado
  (`visibility: "PUBLIC"`, sem `hiddenForPlayers`).
- O flag só tem efeito quando `actorUserId` é o Mestre. Se por qualquer
  motivo o toggle chegar ativo vindo de um jogador (não deve acontecer pela
  UI), o `useDiceRoller` **ignora o flag** e emite como `PUBLIC` — defesa em
  profundidade.

### Renderização no log e no overlay
- Todos os consumidores de `ROLL_RESOLVED` passam a verificar
  `payload.hiddenForPlayers` antes de exibir:
  - **Mestre**: vê a rolagem normalmente, com um pequeno ícone `EyeOff`
    ao lado (sem mudança de opacidade, sem listras, sem tint na linha).
    Apenas o ícone indica "oculta dos jogadores".
  - **Jogador**: não vê a rolagem — nem no `CombatLog`, nem no
    `FateResultOverlay`, nem em qualquer painel que liste rolagens.
- A supressão é **por `event.id`**, não por tipo, ator nem janela temporal:
  é estritamente o evento de rolagem marcado.
- Nenhum outro tipo de evento é afetado. Rolagens anteriores/posteriores,
  mensagens de chat, notas, eventos de combate, etc. continuam seguindo suas
  próprias visibilidades.

### Revelação pós-fato (desmarcar)
- Na linha do log da rolagem oculta, o Mestre vê o próprio ícone `EyeOff`
  como **botão clicável** — ele funciona simultaneamente como indicador
  visual ("oculta") e como controle para alternar a visibilidade daquela
  rolagem específica. Quando revelada (via `ROLL_VISIBILITY_UPDATED`), o
  ícone na linha troca para `Eye` e segue clicável para reocultar.
- Clicar dispara um novo evento `ROLL_VISIBILITY_UPDATED`:
  - Payload: `{ rollEventId: string, hiddenForPlayers: boolean }`
  - `visibility: "PUBLIC"` (o próprio toggle é público — é o "reveal")
  - `actorUserId`: Mestre (normalizado)
- Reducer em `projections.ts`: mantém um mapa
  `rollVisibilityOverrides: Record<rollEventId, { hiddenForPlayers: boolean }>`.
  Ao renderizar, a lógica final de visibilidade é:
  ```
  hiddenFinal = overrides[rollId]?.hiddenForPlayers ?? payload.hiddenForPlayers ?? false
  ```
- Se `hiddenFinal === false`, a rolagem passa a aparecer para todos os
  clientes no próximo render; se `true`, continua oculta.
- O toggle é idempotente e pode ser alternado quantas vezes o Mestre quiser.
  Cada toggle emite um novo `ROLL_VISIBILITY_UPDATED` (mais recente vence por
  `seq`).

### Efeitos colaterais de combate
- **A ocultação é puramente visual no log/overlay de rolagem.** Todos os
  efeitos de combate permanecem inalterados:
  - `COMBAT_TARGET_SET` continua sendo emitido normalmente para rolagens
    com `actionType === "ATTACK"` ou `"CREATE_ADVANTAGE"` e alvos
    selecionados — o jogador alvo recebe o prompt de reação como sempre.
  - `COMBAT_OUTCOME`, cálculo de dano, absorção, consequências e
    `DamageResolutionModal` funcionam normalmente.
  - O total da rolagem oculta é usado em `lastAttackTotal` da reação
    exatamente como hoje; o jogador vê apenas o resultado da própria
    defesa e o desfecho do combate (`COMBAT_OUTCOME`), não a rolagem de
    origem no log.
- O jogador **sabe** que foi atacado (recebe a reação), mas **não vê** o
  dado/total/breakdown do Mestre no log. É análogo a "rolagem atrás da
  cortina" clássica de RPG de mesa.
- Isso simplifica o design: o flag `hiddenForPlayers` atua exclusivamente
  como filtro de renderização do `ROLL_RESOLVED`. Nenhum ramo condicional
  em `finishRoll` além da passagem do flag para `createRollEvent`.

### Consistência de logs e projeções
- `rollVisibilityOverrides` é construído incrementalmente pela projeção, com
  `upsert` por `rollEventId` — resiliente a replay/retry/bulk.
- O `CombatLog` e o `FateResultOverlay` leem a projeção e filtram por
  `userRole`: Mestre enxerga tudo (com selo quando oculta), jogador filtra
  eventos com `hiddenFinal === true`.
- O filtro é feito **na camada de renderização**, não no `eventStore.append`
  nem no `projections.ts` reducer principal. Isso garante que o Mestre
  sempre consiga reverter o toggle, mesmo após refresh (o evento de rolagem
  permanece íntegro no log, apenas não é renderizado para jogadores).
- Nota de segurança: a ocultação é **visual** — o cliente do jogador recebe
  o evento via WebSocket (como todos os outros com `visibility: "GM_ONLY"`
  hoje). Isso é considerado aceitável para mesas de confiança (mesmo modelo
  já usado em notas privadas). Uma ocultação de transporte real no backend
  está explicitamente fora do escopo desta story.

---

## Escopo

### Incluído
- Botão olho (GM-only) em `FateResultOverlay`, com ícones `Eye`/`EyeOff`,
  tooltip, reset do estado a cada abertura da caixa 3D.
- Propagação do flag `hiddenForPlayers` via `diceSimulationStore` →
  `onSettled` → `useDiceRoller.finishRoll` → `createRollEvent`.
- Extensão de `RollPayload` em `src/types/domain.ts` com
  `hiddenForPlayers?: boolean` (opcional, legado sem o campo = público).
- Emissão com `visibility: "GM_ONLY"` quando oculto; `"PUBLIC"` caso
  contrário.
- Novo event type `ROLL_VISIBILITY_UPDATED` e seu reducer em
  `src/lib/projections.ts` (mapa `rollVisibilityOverrides`).
- Botão de revelar (olho) na linha do log das rolagens ocultas — apenas para
  Mestre.
- Filtro de renderização em `CombatLog` (e outros painéis que listem
  rolagens) usando `rollVisibilityOverrides` + `payload.hiddenForPlayers` +
  `userRole`.
- Seletor de cores/selo discreto para o Mestre em rolagens ocultas.

### Excluído
- Ocultar rolagens de **jogadores** (a story é estritamente sobre rolagens
  do Mestre).
- Ocultar qualquer outro tipo de evento (chat, notas, dano, estresse, etc.).
- Filtragem de transporte no backend (mantém-se o broadcast atual; a
  ocultação é visual).
- Cifragem ou obfuscação do payload recebido pelo jogador.
- Opção de "ocultar por padrão a partir de agora" ou flag global — é
  estritamente por-rolagem.
- Mudança no contrato de rede/WebSocket além do novo tipo de evento
  (`ROLL_VISIBILITY_UPDATED`). Nenhuma mudança em backend.
- Histórico de quem revelou/ocultou (auditoria fica para uma story futura
  se necessário).
- Rolagens de dados físicos off-line ou import externo.

---

## Arquivos Afetados (Estimativa Inicial)

### UI / Overlay
- `src/components/DiceRoller/FateResultOverlay.tsx` — botão olho GM-only,
  estado local `hiddenForPlayers`, propagação via nova prop
  `onHiddenForPlayersChange` (ou inclusão no `onAutoRoll`/settle payload).
- `src/components/FateDice3D.tsx` — aceitar `userRole` (já recebe) e passar
  adiante para `FateResultOverlay`; propagar o estado de ocultação para o
  `onSettled`.
- `src/components/CombatLog.tsx` — ler `rollVisibilityOverrides` da
  projeção + `payload.hiddenForPlayers`; filtrar rolagens para jogador;
  renderizar selo `EyeOff` + botão de toggle para o Mestre; emitir
  `ROLL_VISIBILITY_UPDATED` no clique.

### Hook / Simulação
- `src/hooks/useDiceRoller.ts` — aceitar `hiddenForPlayers` no callback
  `onSettled` (assinatura estendida), guarda de GM, passagem para
  `createRollEvent`. **Nenhuma alteração em `COMBAT_TARGET_SET` nem na
  lógica de reação** — segue exatamente como hoje.

### Lib / Domínio / Store
- `src/lib/dice.ts` — `createRollEvent` aceita `hiddenForPlayers?: boolean`,
  seta `visibility` condicional e inclui o campo no payload.
- `src/lib/diceSimulationStore.ts` — estender `DiceSimulationParams` com
  `onHiddenForPlayersChange?` (opcional) e ajustar assinatura do
  `onSettled` para incluir o flag; manter compatibilidade com chamadas
  atuais.
- `src/lib/projections.ts` — novo reducer para `ROLL_VISIBILITY_UPDATED`,
  expondo `rollVisibilityOverrides` na projeção pública.
- `src/lib/eventStore.ts` — nenhum ajuste funcional esperado; apenas
  garantir que o novo tipo é aceito por qualquer validação existente de
  `event.type`.

### Tipos
- `src/types/domain.ts`:
  - `RollPayload`: adicionar `hiddenForPlayers?: boolean`.
  - Adicionar `RollVisibilityUpdatedEvent` / `RollVisibilityUpdatedPayload`
    e incluir no union de `ActionEvent`.
  - `ProjectionState`: adicionar
    `rollVisibilityOverrides: Record<string, { hiddenForPlayers: boolean }>`.

### Contrato compartilhado (apenas documentação)
- `knowledge/shared/api-contract.md` — registrar o novo tipo de evento e o
  campo `hiddenForPlayers`. Nenhuma rota nova.

---

## Critérios de Aceitação

- [ ] O botão de olho aparece na caixa 3D **apenas** quando o usuário é GM;
      jogadores não veem o elemento no DOM.
- [ ] Clicar no olho alterna `Eye` ↔ `EyeOff` com tooltip claro; o estado
      reseta toda vez que a caixa 3D é reaberta.
- [ ] Rolar com `EyeOff` ativo emite `ROLL_RESOLVED` com
      `visibility: "GM_ONLY"` e `payload.hiddenForPlayers === true`.
- [ ] Rolar com `Eye` (padrão) mantém comportamento atual:
      `visibility: "PUBLIC"`, sem `hiddenForPlayers`.
- [ ] O Mestre vê a rolagem oculta no `CombatLog` e no overlay de resultado
      com selo `EyeOff` e um botão de alternância de visibilidade.
- [ ] Jogadores **não** veem a rolagem oculta em lugar algum
      (CombatLog, overlay, painéis de combate, toasts).
- [ ] Clicar no botão de revelar na linha do log (apenas GM) emite
      `ROLL_VISIBILITY_UPDATED { rollEventId, hiddenForPlayers: false }`;
      após a propagação, a rolagem passa a aparecer para todos em tempo
      real.
- [ ] Clicar novamente volta a ocultar (alternância idempotente), e o mais
      recente `ROLL_VISIBILITY_UPDATED` por `rollEventId` (por `seq`)
      vence.
- [ ] Rolagens ocultas com `ATTACK`/`CREATE_ADVANTAGE` + alvos continuam
      disparando `COMBAT_TARGET_SET` e o fluxo de reação/dano/defesa
      funciona exatamente como hoje — o jogador vê o prompt de defesa, a
      resolução de dano e o `COMBAT_OUTCOME`, mas **não** vê a linha da
      rolagem do Mestre no log.
- [ ] Refresh (F5) em qualquer cliente preserva corretamente o estado de
      visibilidade de cada rolagem (via replay da projeção).
- [ ] Nenhum outro evento/rolagem tem comportamento alterado — somente o
      `rollEventId` marcado/revertido explicitamente.
- [ ] `CombatLog` continua ordenado por `seq`/`createdAt` sem flicker; o
      selo de oculto e o botão de revelar não reordenam linhas.
- [ ] Cache local da timeline (`localStorage`) continua íntegro:
      `ROLL_VISIBILITY_UPDATED` é persistido e relido como qualquer outro
      evento.
- [ ] Nenhuma regressão nos fluxos existentes: 4dF padrão, pools
      heterogêneos (story-44), reação, absorção, consequências, modal de
      distribuição de dano, etc.
- [ ] Tipos em `domain.ts` compilam; `next build` sem warnings novos.
- [ ] `knowledge/architecture.md` e `knowledge/shared/api-contract.md`
      atualizados com a decisão (entrada na tabela + tipo do novo evento).

---

## Riscos e Notas de Implementação

- **Vazamento via WebSocket**: jogadores recebem o evento mesmo quando
  oculto, pois a filtragem é na UI. Aceitável para mesas de confiança e
  coerente com como notas privadas já funcionam. Documentar no
  `architecture.md` para evitar expectativa de ocultação criptográfica.
- **Replay e ordem de eventos**: `ROLL_VISIBILITY_UPDATED` pode chegar
  antes do próprio `ROLL_RESOLVED` em cenários exóticos (retry/bulk). O
  reducer precisa tolerar ordem indefinida — o mapa
  `rollVisibilityOverrides` é indexado por `rollEventId` e consultado no
  render; um override que referencia um ID ainda não recebido fica
  ocioso até o evento de rolagem chegar, sem efeitos colaterais.
- **Efeitos de combate inalterados**: a ocultação é puramente visual no
  log/overlay. `COMBAT_TARGET_SET`, `COMBAT_OUTCOME`, reações, dano e
  modal de distribuição seguem o fluxo atual — o jogador recebe o prompt
  de defesa mesmo quando a rolagem de ataque está oculta.
- **UI do selo**: usar `EyeOff` no Lucide, `color` neutra (cinza/creme do
  tema), sem badge berrante para não poluir o log. O botão de revelar é
  parte da mesma iconografia, GM-only.
- **Safety**: manter o timeout de 15 s em `useDiceRoller` e o fallback de
  WebGL de `useFateDiceSimulation` sem alteração. Se o fallback disparar
  com olho ativo, o flag deve ser preservado (o fallback ainda emite
  `ROLL_RESOLVED`, agora com `hiddenForPlayers: true`).
- **Auto-tests manuais obrigatórios** (checagem antes de marcar concluída):
  1. Rolar público como GM → todos veem (comportamento atual).
  2. Rolar oculto como GM → apenas GM vê; jogadores não.
  3. GM clica no botão de revelar no log → jogadores veem a rolagem com
     o mesmo `total`/dados.
  4. GM oculta novamente → jogadores perdem acesso no próximo render.
  5. Jogador faz F5 durante rolagem oculta → continua sem ver.
  6. GM faz F5 durante rolagem oculta → continua vendo com selo + botão.
  7. Dois cards com rolagens (uma pública, outra oculta) exibem apenas
     a pública para o jogador; o log não some/pula posições.
  8. Story-44 permanece funcional: pools heterogêneos ocultos e públicos.
  9. Ataque oculto do Mestre contra jogador: jogador recebe prompt de
     defesa normalmente, rola a defesa, vê `COMBAT_OUTCOME` e resolução
     de dano — mas a linha do `ROLL_RESOLVED` de ataque do Mestre não
     aparece no log dele.

---

## Perguntas para o Mestre (responder antes da implementação)

1. ~~Selo para o Mestre~~ — **resolvido (2026-04-19)**: apenas o ícone
   `EyeOff` ao lado da linha. Sem mudança de opacidade, listra ou tint.
2. ~~Reset do toggle entre rolagens consecutivas~~ — **resolvido
   (2026-04-19)**: o toggle **persiste em memória durante a sessão**
   até o Mestre clicar novamente para desligar. Refresh (F5) ou troca de
   sessão reseta para `Eye`.
3. ~~Combinação olho + ATTACK~~ — **resolvido (2026-04-19)**: rolagens
   ocultas geram reação/dano/defesa normalmente; apenas a linha do
   `ROLL_RESOLVED` do Mestre some do log do jogador.
4. ~~`actionType` afetado~~ — **resolvido (2026-04-19)**: o olho está
   disponível para qualquer `actionType` sem restrições na UI.

Todas as perguntas foram resolvidas. Story pronta para aprovação final.

---

**NOTA:** Não iniciar a implementação antes da aprovação do Mestre. Esta
story foi redigida para ser auto-suficiente — qualquer agente de IA deve
conseguir aplicá-la lendo apenas este arquivo e os arquivos listados em
"Arquivos Afetados".
