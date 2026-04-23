---
title: "Story 44 - Seletor Multi-Dado na Caixa de Rolagem com Clear e Notação Viva"
description: "Permitir que o jogador, a partir do clique em 'Rolar', monte um pool heterogêneo de dados 3D (Fudge, d4, d6, d8, d10, d12, d20, d100) por meio de um ícone de lápis na caixa de dados, com botão Clear, notação viva (ex.: '2d6 + 4d8'), limite de 40 dados e registro consistente no log e no event store."
priority: "alta"
status: "concluída"
last_updated: "2026-04-23"
tags: [ui, componente, regras, 3d, eventsourcing, fluxo]
epic: epic-01-refatoracao-modular
---

# Story 44 - Seletor Multi-Dado na Caixa de Rolagem com Clear e Notação Viva

## Contexto

Hoje o fluxo de rolagem usa 4 dados Fudge fixos. Ao clicar no botão **Rolar**, o `DiceRoller` chama `diceSimulationStore.show(...)`, que é escutado por `src/app/session/[id]/page.tsx` e monta o overlay 3D (`FateDice3D` + `useFateDiceSimulation`) com **exatamente 4 cubos Fudge** físicos. O resultado segue para `finishRoll` em `useDiceRoller.ts`, que cria um `ROLL_RESOLVED` via `createRollEvent` (em `src/lib/dice.ts`) cujo `RollPayload.dice: number[]` espera **length 4, valores -1/0/+1** (ver `src/types/domain.ts`).

Esta story expande a caixa 3D para ser um **seletor multi-dado**: o jogador passa a poder montar um pool com qualquer combinação de Fudge, d4, d6, d8, d10, d12, d20 e d100 — todos renderizados em 3D — antes (ou em lugar de) rolar os 4dF padrão. A mudança é exclusivamente do lado do cliente (Event Sourcing): o payload do evento passa a carregar um breakdown heterogêneo, mas não quebra replay/legado.

---

## Comportamento Esperado

### Abertura da caixa 3D
- Ao clicar em **Rolar** (botão já existente no `DiceRoller`), a caixa 3D abre com o **estado padrão atual**: 4 dados Fudge prontos para arrastar/soltar ou auto-roll. Nenhuma regressão no fluxo atual.
- No canto superior direito da caixa (sobre o overlay `FateResultOverlay` ou dentro do container da caixa em `FateDice3D`) aparece um **ícone de lápis** (`Pencil` do `lucide-react`), pequeno (≈18–22 px), com `pointer-events: auto`.

### Seletor de tipos de dado (clique no lápis)
- O clique no lápis abre um **painel flutuante glass-style** (posição absoluta, próximo ao ícone, com `z-index` acima do canvas 3D) contendo 8 botões, um para cada tipo:
  `dF`, `d4`, `d6`, `d8`, `d10`, `d12`, `d20`, `d100`.
- Cada botão mostra um **mini-ícone 3D** (ou silhueta estilizada do sólido correspondente) + rótulo textual do tipo.
- Clicar em um tipo **acrescenta 1 dado daquele tipo** ao pool atual, atualiza a caixa 3D (que reconstrói a cena física com o novo conjunto) e atualiza a notação viva.
- Cliques consecutivos acumulam: clicar 3× em `d6` adiciona 3 dados d6. Cliques em tipos diferentes são independentes (contadores por tipo).
- O painel **não fecha automaticamente** após um clique — o jogador pode continuar montando o pool. Fecha com clique fora ou em um `X` interno.

### Notação viva
- Próximo à caixa 3D (posição sugerida: acima do overlay de resultado, ou dentro do painel do lápis) aparece um texto com a **notação atual do pool**:
  - Formato: soma de termos `NdX` ordenados por tipo canônico (`dF`, `d4`, `d6`, `d8`, `d10`, `d12`, `d20`, `d100`).
  - Exemplo: `4dF + 2d6 + 1d20`.
  - Atualização em tempo real a cada adição/remoção.
  - Quando o pool está vazio, exibir `Caixa vazia — selecione um tipo de dado` (cinza, 0.8 opacity).

### Botão Clear
- Ao lado da notação (ou dentro do painel do lápis) há um **botão Clear** (ícone `Trash2` ou texto "LIMPAR"), visível apenas quando há dados no pool (≥ 1).
- Clicar em **Clear** zera todos os contadores, reconstrói a cena 3D sem dados (caixa vazia) e a notação volta ao placeholder.
- Clear **não dispara rolagem**, apenas reseta o pool.

### Limite de 40 dados
- Soma total (todos os tipos somados) não pode exceder **40**.
- Ao atingir 40, novos cliques em qualquer tipo são **ignorados** e é exibida uma mensagem efêmera: `Limite atingido: 40 dados` (toast leve próximo ao painel, 1.5 s).
- O contador da notação pode mostrar um indicador visual sutil (borda amarela/laranja) quando `total === 40`.

### Rolagem do pool
- O botão **ROLAR** dentro do `DiceRoller` (ou o auto-roll dentro da caixa 3D) dispara a rolagem **do pool atualmente montado**, não mais um pool fixo de 4dF.
- Caso o pool esteja **vazio** no momento do roll, o sistema cai para **fallback 4dF** (preserva o comportamento atual para o fluxo rápido, garantindo zero regressão).
- A simulação 3D (`useFateDiceSimulation`) deve renderizar **todos os dados selecionados** com geometria apropriada e faces numeradas/simbolizadas corretamente:
  - `dF`: cubo com faces `+`, `−`, em branco (atual).
  - `d4`: tetraedro, leitura por face inferior.
  - `d6`: cubo pipado (1–6).
  - `d8`: octaedro (1–8).
  - `d10`: trapezoedro pentagonal (0–9, interpretado como 1–10 ou 0–9 conforme padrão Fate/convenção — adotar **1–10** com `0` representando `10`).
  - `d12`: dodecaedro (1–12).
  - `d20`: icosaedro (1–20).
  - `d100`: **par de d10** (dezena + unidade, 1–100) — convenção já usada em RPGs clássicos.

### Cálculo e consistência de resultado
- Cada dado rolado retorna seu **valor individual**.
- Soma do pool = soma de todos os valores individuais (para dF: −1/0/+1; para os demais: valor face).
- O **modificador** (perícia + bônus manual + bônus de item) **continua sendo aplicado exatamente como hoje** (via `modifier` em `createRollEvent`).
- **Total exibido** no overlay final (`FateResultOverlay`) = soma do pool + modificador. Deve ser **numericamente idêntico** ao total persistido no evento e ao total exibido no `CombatLog`.

### Log (`CombatLog`) e Event Store
- O evento `ROLL_RESOLVED` passa a carregar, em adição aos campos atuais:
  - `diceBreakdown: Array<{ type: "dF" | "d4" | "d6" | "d8" | "d10" | "d12" | "d20" | "d100", values: number[] }>`
  - `diceSum`: soma de todos os valores individuais (já existe — ajustar semântica para considerar o breakdown heterogêneo).
- O campo legado `dice: number[]` é mantido por compatibilidade:
  - Quando o pool for 4dF padrão (fallback): `dice` = 4 valores em `[-1, 0, 1]` (inalterado).
  - Quando o pool for heterogêneo: `dice` = concatenação plana dos `values` de todos os termos (para permitir leitura linear em visualizadores antigos), e `diceBreakdown` é a fonte de verdade.
- O `CombatLog` exibe, por evento de rolagem, linhas no formato:
  `4dF [+ 0 − +] + 2d6 [3 5] + 1d20 [14] → soma 21 | mod +3 | total 24`
  com a mesma cor/ícones atuais de sucesso/falha/desafio.

---

## Escopo

### Incluído
- Ícone de lápis sobre a caixa 3D (em `FateDice3D` ou `FateResultOverlay`) com painel de seleção de 8 tipos de dado.
- Contadores por tipo, notação viva em tempo real, limite de 40 dados com feedback visual.
- Botão Clear que zera o pool e reconstrói a caixa vazia.
- Generalização da cena Three.js em `useFateDiceSimulation.ts` para renderizar pools heterogêneos, incluindo:
  - Geometrias dos sólidos (tetra, octa, trap pentagonal, dodeca, icosa) — criar ou importar helpers em `src/lib/dicePhysics.ts` e `src/lib/diceVisuals.ts`.
  - Texturas de face por tipo (números pipados para d6, numerais para os demais, símbolos `+`/`−`/blank para dF — já existente).
  - Leitura determinística da face superior após o settle para cada geometria.
- Suporte a `d100` como par de d10 (dezena + unidade).
- Propagação do pool montado pelo usuário até o `diceSimulationStore.show(...)` e, a partir dele, até `finishRoll` em `useDiceRoller.ts`.
- Extensão do `RollPayload` em `src/types/domain.ts` com `diceBreakdown` (opcional, mantendo compatibilidade).
- Ajuste de `createRollEvent` em `src/lib/dice.ts` para serializar `diceBreakdown` e recalcular `diceSum` a partir dele quando presente.
- Ajuste do `CombatLog.tsx` para exibir breakdown por tipo quando disponível, mantendo a renderização antiga para eventos legados sem `diceBreakdown`.
- Fallback 4dF quando o pool estiver vazio no momento do roll.
- Safety: continuar respeitando o timeout de 15 s em `useDiceRoller.ts` e o fallback de WebGL context lost em `useFateDiceSimulation.ts` (`bailOutAndRollInstantly`) — este último precisa gerar valores coerentes com o pool selecionado (não mais 4 Fudge fixos).

### Excluído
- Expressões aritméticas complexas (ex.: `2d6+1d20−3`) digitadas como texto livre — a notação é apenas **display** derivada dos contadores.
- Remoção individual de um tipo (ex.: decrementar 1 d6 sem zerar o resto). Nesta story só existe **adicionar** e **Clear total**. Incremento/decremento granular fica para uma story futura.
- Mudança no contrato de rede / WebSocket além da extensão opcional do `ROLL_RESOLVED`. Nenhuma mudança em backend.
- Persistência do pool entre sessões (o pool zera ao fechar a caixa 3D).
- Alteração de `gameLogic.ts` (absorção, consequências, dano) — fora do escopo.
- Novo evento dedicado para seleção de dados. A seleção é efêmera, cliente-side.
- Animações avançadas de entrada/saída dos dados quando o pool muda (basta recriar a cena — sem polimento extra nesta story).

---

## Arquivos Afetados (Estimativa Inicial)

### UI / Overlay
- `src/components/FateDice3D.tsx` — montar o ícone de lápis e propagar callbacks de edição do pool para o `FateResultOverlay` / hook de simulação.
- `src/components/DiceRoller/FateResultOverlay.tsx` — painel de seleção (8 tipos), botão Clear, render da notação viva, toast de limite.
- `src/components/DiceRoller.tsx` — se necessário, passar o pool inicial (`undefined` = default 4dF) para `diceSimulationStore.show(...)`.

### Hook / Simulação 3D
- `src/hooks/useFateDiceSimulation.ts` — aceitar `dicePool: Array<{ type, count }>` como input, reconstruir a cena quando o pool mudar, coletar resultados individualizados, expor callback `onPoolChange` para o overlay.
- `src/hooks/useDiceRoller.ts` — receber o pool final no `onSettled` e passar `diceBreakdown` para `createRollEvent`; implementar fallback 4dF quando pool vazio.

### Lib / Domínio
- `src/lib/dicePhysics.ts` — adicionar geometrias e funções `readFaceUpWithIndex` por tipo, estender `PhysicsDie` com `type: DieType`.
- `src/lib/diceVisuals.ts` — fábricas de textura por tipo (numerais 1–N, pipas para d6, símbolos Fudge já existentes).
- `src/lib/diceSimulationStore.ts` — expandir `DiceSimulationParams` com `initialPool?: DicePool` e `onPoolChange?: (pool) => void`.
- `src/lib/dice.ts` — `createRollEvent` aceita `diceBreakdown` opcional; quando presente, `diceSum` é recalculado a partir dele.

### Tipos
- `src/types/domain.ts` — adicionar `DieType`, `DicePoolEntry`, `DiceBreakdownEntry`; estender `RollPayload` com `diceBreakdown?: DiceBreakdownEntry[]`.

### Log
- `src/components/CombatLog.tsx` — render por-tipo quando `diceBreakdown` presente; fallback atual para eventos legados.

---

## Critérios de Aceitação

- [ ] Ao clicar em **Rolar**, a caixa 3D abre com 4 dados Fudge (padrão) e permite o fluxo atual sem regressões.
- [ ] Um ícone de lápis é visível no canto superior direito da caixa 3D enquanto a caixa está aberta (fase `idle` ou `held`).
- [ ] O clique no lápis abre um painel com 8 botões: `dF`, `d4`, `d6`, `d8`, `d10`, `d12`, `d20`, `d100`.
- [ ] Cada clique em um tipo acrescenta 1 dado daquele tipo ao pool e a caixa 3D reconstrói a cena com o novo conjunto.
- [ ] A notação do pool (ex.: `2d6 + 4d8 + 1d20`) é exibida próxima à caixa e atualiza em tempo real a cada adição/remoção.
- [ ] Botão **Clear** remove todos os dados do pool; a caixa fica vazia e a notação volta ao placeholder.
- [ ] Limite de **40 dados** é respeitado; tentativas além do limite são ignoradas e exibem um toast `Limite atingido: 40 dados`.
- [ ] Rolar com pool heterogêneo produz resultados coerentes: cada dado exibe o valor da face superior; soma total respeita a geometria (d6 → 1..6, dF → −1..+1 etc.).
- [ ] Rolar com pool **vazio** aplica fallback 4dF (sem erro, sem travamento).
- [ ] O `ROLL_RESOLVED` persiste `diceBreakdown` quando o pool é heterogêneo; o campo legado `dice` continua preenchido para compatibilidade.
- [ ] O `CombatLog` exibe o breakdown por tipo com os valores individuais e o total consistente.
- [ ] O total exibido no overlay de resultado, no log e no payload do evento são **numericamente idênticos** (diceSum + modifier).
- [ ] O fluxo de combate (ATAQUE / DEFESA / SUPERAR / CRIAR VANTAGEM / reações / `COMBAT_OUTCOME` / `COMBAT_TARGET_SET`) continua funcionando com pools heterogêneos — o `total` usado na resolução é o mesmo `total` do payload.
- [ ] Safety timeout de 15 s continua funcionando; fallback de perda de WebGL (`bailOutAndRollInstantly`) gera valores coerentes com o pool (não mais 4 Fudge fixos).
- [ ] A story é auto-contida: qualquer IA pode aplicar esta story sem consultar outras fontes além dos arquivos citados em "Arquivos Afetados".

---

## Riscos e Notas de Implementação

- A maior complexidade é generalizar a cena Three.js atual (hoje hardcoded para 4 cubos Fudge). A leitura de face superior para geometrias não-cubo (d4, d8, d10, d12, d20) exige mapeamento de normais por face para cada sólido. Pode-se começar com `BoxGeometry` estilizado para d6, importar `TetrahedronGeometry`, `OctahedronGeometry`, `DodecahedronGeometry`, `IcosahedronGeometry` do Three.js; para d10/d100 a geometria é customizada (pentagonal trapezohedron).
- Performance em mobile: 40 meshes em Three.js ainda é leve (geometrias simples, sem sombras). Manter `powerPreference: 'low-power'` e `antialias: false` como hoje.
- Backward compat: `RollPayload.dice` continua sendo a fonte para renderização em clientes antigos. Novos clientes preferem `diceBreakdown`.
- Não iniciar a implementação antes da aprovação do Mestre.

---

**NOTA:** Não codar antes da aprovação do Mestre. Esta story foi redigida para ser auto-suficiente — qualquer agente de IA deve conseguir aplicá-la lendo apenas este arquivo e os arquivos listados em "Arquivos Afetados".
