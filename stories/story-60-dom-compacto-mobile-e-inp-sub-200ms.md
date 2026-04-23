---
title: "Story 60 — DOM Compacto Mobile e INP Sub-200ms"
description: "Após stories 59 (churn JS) e 58 (custo visual CSS), o site saiu de 'congelamento contínuo de ~1s' para 'lag perceptível mas não bloqueante'. O que resta: INP de 545ms (meta Google <200ms), 2 Long Tasks de 500ms+, 14 de 200-500ms, alerta 'Optimize DOM size' no Chrome, 'Forced reflow' no Chrome, e React reconciler fazendo ~80 chamadas de reconciliação profunda no mount. O gargalo agora é tamanho e profundidade da árvore DOM fora da arena — especificamente CharacterCard (8.349 linhas / 17 arquivos) renderizado N vezes para jogadores, e montagem síncrona de toda a árvore de sessão no primeiro acesso."
priority: "alta"
status: "em-revisao"
last_updated: "2026-04-23"
related: ["story-58-performance-abas-ficha-notas-header", "story-59-rerender-cascata-musicplayer-main-thread"]
tags: [performance, react, mobile, dom, inp]
epic: epic-01-refatoracao-modular
---

# Story 60 — DOM Compacto Mobile e INP Sub-200ms

## Contexto

Evolução medida em 3 traces no celular do Mestre (Chrome remote inspect):

| Métrica | Baseline | Pós-59 | Pós-58 (atual) |
|---|---|---|---|
| LCP | 2.831 ms | 2.169 ms | **545 ms** |
| INP | — | 2.169 ms | **545 ms** |
| Pior Long Task | 1.052 ms | 1.633 ms | **604 ms** |
| Long Tasks >1s | múltiplas | 1 | **0** |
| Long Tasks 500ms+ | ~10 | 10 | **2** |
| Long Tasks 200-500ms | ~20 | 33 | **14** |

As stories 59 e 58 eliminaram, respectivamente, o churn de JavaScript e o custo visual CSS. O que resta é **custo estrutural do DOM**:

- Chrome marca **Optimize DOM size** como insight
- Chrome marca **Forced reflow** como insight
- O React reconciler faz **~80 chamadas** alternadas `o9 → o5` no mount inicial (stack do console log pós-58)
- O INP está em **545ms** — acima do limiar "bom" do Google (<200ms)

### O elefante na sala: CharacterCard

O componente `CharacterCard` tem **8.349 linhas em 17 arquivos**:

| Arquivo | Linhas |
|---|---|
| CharacterCard.styles.tsx | 1.927 |
| CharacterCard.css | 1.717 |
| InventorySection.tsx | 1.244 |
| CharacterSummarySection.tsx | 462 |
| CharacterVitality.tsx | 454 |
| CharacterConsequences.tsx | 446 |
| useCharacterCard.ts | 439 |
| CharacterCard.tsx | 348 |
| CharacterPortrait.tsx | 285 |
| SkillsSection.tsx | 250 |
| PowTabsSection.tsx | 224 |
| CharacterPrivateNotesPanel.tsx | 144 |
| CharacterLore.tsx | 131 |
| CharacterSummary.tsx (fora da pasta) | 109 |
| use-power-tabs.ts | 101 |
| CharacterSummarySkills.tsx | 96 |
| skillPalette.ts | 79 |

Para **jogadores** (role=PLAYER), o `CharactersTab` renderiza **todos os PCs como `CharacterCard` completo** (linha 117-130 de CharactersTab.tsx), mas **o jogador só vê sua própria ficha** — as demais ficam montadas no DOM mas ocultas. Com 4-5 jogadores, isso significa 4-5 instâncias de um componente de ~8.000 linhas montadas simultaneamente, das quais **apenas 1 é visível**. As demais são desperdício puro de DOM.

A arena e o combate lêem dados dos personagens diretamente de `state.characters` (Event Store), não dos componentes `CharacterCard` montados. Portanto, os CharacterCards ocultos não servem a nenhum propósito funcional.

Para **GM**, o `CharactersTab` já usa `CharacterSummary` (109 linhas) para todos — com modal on-demand que monta 1 `CharacterCard` por vez. Este é o padrão correto.

---

## Diagnóstico dos Problemas Restantes

### 1. 🔴 DOM Size — CharacterCards ocultos montados sem necessidade

**Impacto**: Alto  
**Causa**: `CharactersTab.tsx` linha 117 renderiza `playerCharacters.map(char => <CharacterCard ...>)` para `userRole !== "GM"`. O jogador só vê a ficha vinculada a ele (`fixedCharacterId`), mas todas as outras fichas completas também são montadas no DOM e ficam ocultas. São centenas de nós DOM (perícias, aspectos, inventário, barras de estresse, consequências) **por ficha oculta**, sem propósito funcional.

**Evidência**: O insight "Optimize DOM size" do Chrome aparece nos traces pós-58.

### 2. 🔴 Mount inicial pesado

**Impacto**: Alto  
**Causa**: Ao entrar na sessão, `page.tsx` monta a aba ativa inteira de forma síncrona. Se `activeTab === "characters"` e o jogador vê todos os cards, o React precisa reconciliar toda a árvore de uma vez.

**Evidência**: Stack de ~80 chamadas `o9 → o5` no log — estas são `beginWork → completeUnitOfWork` do React, reconciliando uma árvore profunda.

### 3. 🟡 Forced reflow

**Impacto**: Médio  
**Causa**: O `useEffect` de autoscroll em `useSessionNotesDiary.ts` (linha 106-117) **já foi corrigido** com `requestAnimationFrame` e dependências corretas. Se o Chrome ainda marca "Forced reflow", pode haver outra fonte — possivelmente leitura de `scrollHeight`/`offsetHeight` durante a montagem de componentes ou cálculos de layout inline.

### 4. 🟡 Long Tasks residuais de 200-600ms

**Impacto**: Médio  
**Causa**: Soma dos problemas 1-3 acima. Cada mudança de aba que monta/desmonta a árvore inteira gera uma Long Task.

---

## Estratégias de Correção

### Passo 1 — Parar de renderizar fichas ocultas (prioridade 1)

**Objetivo**: Reduzir o DOM da aba PERSONAGEM de N × CharacterCard para 1 × CharacterCard.

O jogador já só vê sua própria ficha. As fichas dos companheiros estão montadas no DOM mas ocultas — desperdício puro. Basta filtrar o render para montar somente a ficha vinculada.

Em `CharactersTab.tsx`, mudar a lógica do modo PLAYER:

```tsx
// ANTES (linha 117-130): monta CharacterCard para TODOS os PCs
playerCharacters.map(char => <CharacterCard ...>)

// DEPOIS: monta CharacterCard SÓ para o personagem do jogador
playerCharacters
  .filter(char => char.id === fixedCharacterId)
  .map(char => <CharacterCard ...>)
```

**Impacto na UX**: **Nenhum.** O jogador já só via a própria ficha. As ocultas não serviam a nenhum propósito visível nem funcional (a arena lê de `state.characters`).

**Meta**: DOM da aba PERSONAGEM cai de ~5× CharacterCard para 1× CharacterCard ≈ redução de ~80% dos nós.

### Passo 2 — Lazy mount de abas com `startTransition` (prioridade 2)

**Objetivo**: Evitar que a montagem de uma aba pesada bloqueie o main thread inteiro.

Quando o usuário troca de aba, usar `React.startTransition` para que o React possa quebrar a reconciliação em chunks menores:

```tsx
const switchTabFromNav = (tab: string) => {
  React.startTransition(() => {
    setActiveTab(tab);
  });
  closeNavDrawer();
};
```

Isso não elimina o custo total, mas evita que o main thread fique bloqueado de uma vez só — o React pode ceder para o browser processar eventos de input entre chunks.

**Meta**: Pior Long Task no switch de aba cai de ~600ms para <200ms.

### Passo 3 — `React.memo` nos componentes pesados (prioridade 2)

Envolver `CharacterCard`, `CharacterSummary`, `SessionNotes` e `CombatTab` em `React.memo` para evitar re-renders quando as props não mudam.

Em `CharactersTab.tsx`, estabilizar callbacks com `useCallback` e garantir `key` estável.

**Meta**: Re-renders desnecessários eliminados em idle.

### Passo 4 — Investigar e cortar Forced reflow residual (prioridade 3)

Abrir o trace pós-58 no Chrome DevTools, filtrar por eventos "Layout" (barras roxas) e identificar qual código está forçando reflow síncrono. Os suspeitos:

- Leitura de `scrollHeight` / `offsetHeight` / `getBoundingClientRect()` seguida de escrita em DOM
- `ResizeObserver` callbacks que lêem e escrevem DOM no mesmo frame
- `useEffect` que lê dimensões de elementos e seta estado

**Meta**: Eliminar o insight "Forced reflow" do Chrome.

### Passo 5 — Desativar animações de tema em mobile (prioridade 3)

Se as animações de tema (`medieval-glow`, `cyber-flicker`, `vein-pulse`, `starry-drift`) ainda estiverem rodando em mobile após a story 58, adicionar `@media (max-width: 768px)` para desativá-las.

**Nota**: Verificar no código atual se a story 58 já cobriu isso. Se sim, este passo pode ser descartado.

---

## Escopo

### Incluído

- `src/components/session/CharactersTab.tsx` — lógica de renderização para PLAYER
- `src/app/session/[id]/page.tsx` — `startTransition` no switch de abas, `React.memo` nos componentes de tab
- `src/components/CharacterCard/CharacterCard.tsx` — envolver em `React.memo`
- `src/components/CharacterSummary.tsx` — envolver em `React.memo`
- `src/features/session-notes/SessionNotes.tsx` — envolver em `React.memo` se necessário
- `src/lib/themePresets.ts` — verificar/adicionar gate mobile para animações restantes

### Excluído

- Redesenho visual do `CharacterCard` (a aparência e funcionalidade não mudam)
- `CharacterCard.css`, `CharacterCard.styles.tsx` — sem mudança de CSS nesta story
- Arena / Three.js / Battlemap — já fluida
- WebRTC / VoiceChat — já corrigido na story 59
- EventStore / projections / snapshot
- Backend

---

## Critérios de Aceitação

- [ ] Jogador (PLAYER) continua vendo **apenas sua ficha completa** (sem mudança de UX)
- [ ] Fichas dos demais PCs **não são montadas no DOM** quando o usuário é PLAYER
- [ ] Arena/combate continua funcionando normalmente (lê de `state.characters`, não do DOM)
- [ ] GM **não é afetado** — continua vendo todos como CharacterSummary + modal
- [ ] **INP ≤ 200ms** no celular do Mestre (meta Google "bom")
- [ ] **Zero Long Tasks acima de 500ms** durante uso normal (excluindo boot inicial)
- [ ] **Long Tasks 200-500ms ≤ 5** em 30 segundos de uso idle
- [ ] Chrome não marca mais "Optimize DOM size" como insight
- [ ] Chrome não marca mais "Forced reflow" como insight
- [ ] Arena continua fluida, sem regressão
- [ ] Notas/fichas respondem a toque em **< 100ms** no celular
- [ ] `next build` sem warnings novos; `tsc --noEmit` limpo
- [ ] Validação no celular do Mestre via remote inspect

---

## Prioridade de Implementação

| Passo | Impacto estimado | Esforço | Prioridade |
|---|---|---|---|
| 1. Filtrar fichas ocultas PLAYER | 🔴 Alto — reduz ~80% do DOM | Muito baixo | **P1** |
| 2. `startTransition` no switch | 🟡 Médio — quebra Long Tasks | Baixo | **P2** |
| 3. `React.memo` nos pesados | 🟡 Médio — evita re-render idle | Baixo | **P2** |
| 4. Cortar Forced reflow | 🟡 Médio — elimina jank pontual | Médio | **P3** |
| 5. Animações tema mobile | 🟢 Baixo — pode já estar coberto | Baixo | **P3** |

---

## Riscos

- **Comportamento edge case**: se `fixedCharacterId` não estiver definido (jogador sem personagem vinculado), a aba PERSONAGEM ficará vazia. Mitigação: verificar se há fallback para esse caso e garantir mensagem explicativa.
- **`startTransition` pode causar flash breve**: ao trocar de aba, o React pode mostrar o estado anterior por 1-2 frames antes de renderizar a nova aba. Se for perceptível, usar `useTransition` com `isPending` para mostrar um skeleton.
- **Forced reflow pode ter causa inesperada**: se não for o autoscroll (já corrigido), pode ser o YouTube iframe ou outro componente de terceiros. Nesse caso, o passo 4 pode exigir investigação mais longa.
- **Não implementar sem aprovação do Mestre.**

---

## Arquivos de Referência

- Trace pós-58: `front_sistema_rpg/DEBUG_CELULAR/Trace-20260423T184220.json`
- Screenshot pós-58: `front_sistema_rpg/DEBUG_CELULAR/Screenshot_1.png`
- Logs pós-58: `front_sistema_rpg/DEBUG_CELULAR/logs_travamento_geral_site.txt`
- Análise evolutiva: conversação `6ce864a6-3d5f-414b-87b8-82da27dd08a9`
- Stories anteriores: story-54, story-58, story-59
