---
title: "Story 64 — Extrair Fate Core como primeiro plugin"
description: "Mover toda a lógica e UI específica de Fate Core (tipos, reducer, gameLogic, componentes de ficha/combate/dado) de seus locais atuais (`src/types/domain.ts`, `src/lib/projections.ts`, `src/lib/gameLogic.ts`, `src/components/CharacterCard/**`, `CombatTab.tsx`, `DiceRoller.tsx`) para dentro de `src/systems/fate/`. Após esta story, os arquivos genéricos da plataforma não conhecem mais stress/consequências/aspectos/fate points. Paridade 1:1 com o comportamento atual."
priority: "alta"
status: "planejada"
last_updated: "2026-04-24"
tags: [eventsourcing, regras, ui, componente, frontend, em-revisão]
epic: epic-04-suporte-a-multiplos-sistemas-rpg
---

# Story 64 — Extrair Fate Core como primeiro plugin

## Contexto

A story-63 entregou a infraestrutura de plugins: `Session.system` no banco/API, interface `SystemPlugin`, `SystemRegistry` com lazy loading, dispatcher no `reduce()` e seletor de sistema na criação de mesa. Mas o plugin Fate naquela story é uma **fachada** — ele apenas re-exporta funções e componentes que continuam fisicamente em `src/types/domain.ts`, `src/lib/projections.ts`, `src/lib/gameLogic.ts` e `src/components/**`.

Esta story faz a **mudança real**: mover todo esse conteúdo para dentro de `src/systems/fate/` e deixar os arquivos genéricos limpos de qualquer conceito Fate. Ao final, alguém lendo `domain.ts` não deve encontrar `Stress`, `Consequence`, `Aspect`, `FatePoints`, `Refresh`, `Stunt` ou `Spell`. Lendo `projections.ts`, não deve achar nenhum case de evento Fate (`STRESS_MARKED`, `FP_SPENT`, `ASPECT_CREATED`...). Lendo `gameLogic.ts`, não deve achar `calculateAutomaticDamageSelection`.

A regra inegociável é **paridade 1:1**: comportamento da mesa Fate idêntico ao atual, byte-a-byte na resposta do reducer e pixel-a-pixel na UI. Esta é uma extração arquitetural, não uma refatoração funcional.

---

## Comportamento Esperado

### Tipos: o que é plataforma vs o que é Fate

Em `src/types/domain.ts` ficam **apenas** os tipos da plataforma:

**Permanece em `domain.ts`:**
- `SessionState` (mas com `characters: Record<string, Character>` onde `Character` vira o tipo genérico — ver abaixo).
- `PlayerSeat`, `Zone`, `ZoneLink`, `Battlemap*`, `Note*`, `StickyNote`, `WorldEntity`, `Mission`, `TimelineEvent`, `Challenge` (os relacionados a turn/timer continuam plataforma — turno é compartilhado).
- `ActionEvent` vira **união aberta**: tipos genéricos da plataforma + `{ type: string; payload: unknown }` para eventos do plugin.
- Eventos genuinamente genéricos (não-Fate) continuam aqui: `NOTE_*`, `BATTLEMAP_UPDATED`, `MUSIC_*`, `SFX_TRIGGERED`, `ATMOSPHERIC_*`, `SCENE_*`, `ZONE_*`, `CHARACTER_MOVED`, `TURN_*`, `TIMER_*`, `WORLD_ENTITY_*`, `MISSION_*`, `TIMELINE_*`, `STICKY_*`, `THEME_*`, `SOUND_*`.

**Move para `src/systems/fate/types.ts`:**
- Tudo do personagem Fate: campos `stress`, `stressValues`, `consequences`, `removedDefaultSlots`, `extraConsequenceSlots`, `sheetAspects`, `fatePoints`, `refresh`, `skills`, `skillResources`, `stunts`, `spells`, `magicLevel`, `inventory` (se for específico de Fate — confirmar; se for genérico, fica na plataforma).
- Tipos auxiliares: `Stunt`, `Spell`, `Aspect`, `ConsequenceData`, `Item`, `DEFAULT_SKILLS`.
- Eventos Fate: todos os 70+ tipos relacionados a stress/consequences/aspects/fp/skills/refresh/character creation com campos Fate.

**`Character` na plataforma:**
```ts
// domain.ts
export interface Character {
  id: string;
  name: string;
  portraitUrl?: string;
  ownerId?: string;
  zoneId?: string;
  isNpc?: boolean;
  systemData: Record<string, unknown>;  // tudo que é regra do sistema vai aqui
}
```
Em uma mesa Fate, `systemData` carrega `{ stress, consequences, aspects, fatePoints, refresh, skills, stunts, spells, ... }` — o plugin Fate sabe ler/escrever; a plataforma apenas trafega como blob opaco.

Plugin Fate exporta um tipo refinado:
```ts
// src/systems/fate/types.ts
export interface FateCharacter extends Character {
  systemData: { stress; consequences; aspects; fatePoints; refresh; skills; ... };
}
```

### Reducer

`src/lib/projections.ts` fica com:
- `reduce()` (dispatcher já criado na story-63).
- Cases dos eventos **da plataforma** (notas, battlemap, música, cenas, zonas, missões, timeline, sticky, tema, som, turn order, timer, character move, world entities).
- `initialState`.

Move para `src/systems/fate/reducer.ts`:
- Cases dos eventos Fate listados acima.
- Função `reduceFate(state, event)` exportada como `default` ou nomeada, consumida pelo plugin como `reducer`.

O dispatcher passa o evento ao plugin **primeiro**; se o plugin não conhece o tipo, o dispatcher tenta o reducer de plataforma. Convenção: cada reducer retorna `state` inalterado quando não reconhece o evento. Não há erro nem warning para tipos desconhecidos (compatibilidade com mesas antigas + futuros plugins).

### gameLogic

`src/lib/gameLogic.ts` é **deletado** ou esvaziado (se ninguém genérico depender). O que estava lá vai para `src/systems/fate/gameLogic.ts`:
- `calculateAutomaticDamageSelection`
- `getConsequenceSlotCapacity`
- `isCharacterEliminated`
- Constantes de capacidade de consequência.

Plugin Fate expõe `gameLogic.isCharacterEliminated` na interface; quem hoje importa `gameLogic.ts` direto passa a obter via `plugin.gameLogic.*`.

Auditoria obrigatória: rodar `grep` por `from "@/lib/gameLogic"` e migrar cada call site para usar o plugin (via hook `useSystemPlugin()` — ver abaixo).

### Componentes UI

Movem para `src/systems/fate/ui/`:
- `CharacterCard/` (todos subcomponentes: `CharacterSummarySection`, `CharacterVitality`, `SkillsSection`, `CharacterConsequences`, `PowerTabsSection`, `InventorySection` se Fate-específica, `CharacterPortrait`, `CharacterLore`, `CharacterPrivateNotesPanel`).
- `CombatTab.tsx`.
- `CombatCard/` (com `CombatHeader`, `CombatAspects`).
- `CombatStressTracks.tsx`, `CombatConsequences.tsx`.
- `ConsequenceModal.tsx`, `DamageResolutionModal.tsx`.
- `DiceRoller.tsx` (Fate dice 4dF) e `FateDice3D.tsx`.
- `AspectManager.tsx`.
- `CharacterCreator.tsx` (preset Fate).

Permanecem na plataforma:
- `Battlemap*`, `MusicPlayer`, `AtmosphericPlayer`, `VIControlPanel`, `TextChatPanel`, `VoiceChatPanel`, `FloatingNotes`, `SessionHeader`, `ZoneEditor`, `ImageCropper`, `ImageLibraryModal`, `TurnOrderModal`, `TurnOrderTracker`, `TurnTimer` (turno é compartilhado), `SessionNotes`.

### Hook `useSystemPlugin()`

Novo hook em `src/lib/useSystemPlugin.ts`:
```ts
export function useSystemPlugin(): SystemPlugin {
  const state = useProjectedState();
  return systemRegistry.getCachedRequired(state.system);
}
```
- `getCachedRequired` lança erro se o plugin não estiver pré-carregado — significa bug no fluxo de bootstrap, não condição esperada.
- Componentes que hoje importam direto `gameLogic` ou `CharacterCard` Fate-específico passam a usar este hook quando o uso for genuinamente plataforma. Componentes que vivem dentro do próprio plugin Fate continuam importando direto.

### Página de sessão

`src/app/session/[id]/page.tsx`:
- Onde hoje há `import { CharacterCard } from "@/components/CharacterCard"`, passa a ser `const { ui } = useSystemPlugin(); const CharacterCard = ui.CharacterCard;`.
- Mesmo tratamento para `CombatTab` e `DiceRoller`.
- Hooks Fate-específicos (`useCombatAutomation`, `useVictoryDefeat`) movem para `src/systems/fate/hooks/` se de fato dependem de stress/consequences. Confirmar caso a caso.

### Plugin Fate completo

`src/systems/fate/index.ts` deixa de ser fachada e passa a ser plugin real:
```ts
import { reduceFate } from "./reducer";
import { CharacterCard, CombatTab, DiceRoller } from "./ui";
import { isCharacterEliminated } from "./gameLogic";
import { createFateCharacter } from "./characterTemplate";
import { FATE_EVENT_TYPES } from "./events";

const plugin: SystemPlugin = {
  id: "fate",
  name: "Fate Core",
  features: { fatePoints: true },
  characterTemplate: createFateCharacter,
  reducer: reduceFate,
  eventTypes: FATE_EVENT_TYPES,
  ui: { CharacterCard, CombatTab, DiceRoller },
  gameLogic: { isCharacterEliminated },
};
export default plugin;
```

### Lazy chunk

Após a extração, `src/systems/fate/` vira chunk separado pelo `import()` dinâmico do registry. Mesa Fate carrega esse chunk; o bundle inicial deixa de ter código Fate.

### Migração de sessões antigas (`systemData`)

O reducer Fate, ao processar o **primeiro** evento de uma sessão antiga, detecta personagens cujo formato é o "antigo" (campos no nível raiz de `Character` em vez de `systemData`) e migra **na projeção** (não escreve evento retroativo):
- Função `migrateLegacyFateCharacter(c)` em `src/systems/fate/migrations.ts`.
- Idempotente: se já está migrado, retorna como veio.
- Aplicada em `reduceFate` no início, varrendo `state.characters`.
- Snapshots antigos podem ter o formato legacy — a migração no reducer cobre isso.

---

## Escopo

### Incluído
- Mover tipos Fate de `domain.ts` para `src/systems/fate/types.ts`.
- Refinar `Character` na plataforma para `{ id, name, portraitUrl?, ownerId?, zoneId?, isNpc?, systemData }`.
- Mover cases Fate de `projections.ts` para `src/systems/fate/reducer.ts`.
- Esvaziar/deletar `src/lib/gameLogic.ts`; mover conteúdo para `src/systems/fate/gameLogic.ts`.
- Mover árvore de UI Fate (CharacterCard, CombatTab, CombatCard, DiceRoller, FateDice3D, AspectManager, modals de consequência/dano, CharacterCreator) para `src/systems/fate/ui/`.
- Hook `useSystemPlugin()` para acessar o plugin ativo.
- Atualizar todas as referências/imports nos arquivos que sobreviveram na plataforma.
- Migração de personagens legacy via reducer (`migrateLegacyFateCharacter`).
- Plugin Fate completo (não-fachada) em `src/systems/fate/index.ts`.
- Confirmar que o chunk Fate é separado no build (verificar relatório do bundler).
- Atualizar `knowledge/architecture.md` com a topologia final dos plugins.

### Excluído
- Plugin Vampiro (story-65).
- Qualquer mudança de comportamento, regra, balanceamento ou UX em Fate. Esta story é movimentação de código.
- Renomear arquivos/funções por estilo. Apenas mover.
- Adicionar testes novos além dos necessários para validar paridade.
- Refator do `Inventory` (decidir se é plataforma ou Fate-específico — manter onde está e mover só se for óbvio que pertence ao Fate; senão, fica em Fate por default e revisitamos quando outro plugin precisar).

---

## Arquivos afetados

### Removidos / esvaziados
- `src/lib/gameLogic.ts` — deletado ou reduzido a re-export legacy temporário.

### Modificados (perdem conteúdo Fate)
- `src/types/domain.ts` — sai tudo Fate, fica plataforma + `Character` genérico.
- `src/lib/projections.ts` — saem cases Fate, fica reducer da plataforma + dispatcher.
- `src/app/session/[id]/page.tsx` — imports passam pelo `useSystemPlugin()`.
- `src/components/CharacterCard/**`, `CombatTab.tsx`, `CombatCard/**`, `CombatStressTracks.tsx`, `CombatConsequences.tsx`, `ConsequenceModal.tsx`, `DamageResolutionModal.tsx`, `DiceRoller.tsx`, `FateDice3D.tsx`, `AspectManager.tsx`, `CharacterCreator.tsx` — fisicamente movidos.

### Novos (todos sob `src/systems/fate/`)
- `index.ts` (plugin completo)
- `types.ts`
- `reducer.ts`
- `gameLogic.ts`
- `events.ts` (catálogo `FATE_EVENT_TYPES`)
- `characterTemplate.ts`
- `migrations.ts`
- `ui/CharacterCard/...` (árvore movida)
- `ui/CombatTab.tsx`, `ui/CombatCard/...`
- `ui/DiceRoller.tsx`, `ui/FateDice3D.tsx`
- `ui/AspectManager.tsx`, `ui/ConsequenceModal.tsx`, `ui/DamageResolutionModal.tsx`
- `ui/CharacterCreator.tsx`
- `hooks/useCombatAutomation.ts`, `hooks/useVictoryDefeat.ts` (se Fate-específicos)

### Novos (plataforma)
- `src/lib/useSystemPlugin.ts`

### Documentação
- `knowledge/architecture.md` — seção "Plugin de Sistema" expandida com a topologia final e fronteira plataforma×Fate.

---

## Critérios de Aceitação

- [ ] `src/types/domain.ts` não contém `Stress`, `Consequence`, `Aspect`, `FatePoint`, `Refresh`, `Stunt`, `Spell` ou `DEFAULT_SKILLS`.
- [ ] `src/lib/projections.ts` não contém case nenhum de evento Fate (`STRESS_*`, `FP_*`, `ASPECT_*`, `CHARACTER_CONSEQUENCE_*`, `FREE_INVOKE_*`, `CHARACTER_REFRESH_UPDATED`, `CHARACTER_SKILL_UPDATED`).
- [ ] `src/lib/gameLogic.ts` está deletado (ou reduzido a um re-export deprecated com aviso).
- [ ] `Character` na plataforma tem só `{ id, name, portraitUrl?, ownerId?, zoneId?, isNpc?, systemData }`; o resto vive em `systemData` quando o sistema é Fate.
- [ ] Plugin Fate em `src/systems/fate/index.ts` satisfaz `SystemPlugin` por completo (não é fachada).
- [ ] Reducer Fate trata todos os event types que hoje são tratados em `projections.ts`.
- [ ] `migrateLegacyFateCharacter` cobre 100% dos campos antigos sem perder dados; idempotente.
- [ ] Hook `useSystemPlugin()` é usado em todos os pontos genéricos da plataforma que precisam tocar regras (`session/[id]/page.tsx`, lugares onde antes se importava `gameLogic`).
- [ ] Mesa Fate criada antes desta story carrega, joga e exibe ficha/combate/dado **idênticos** ao comportamento atual: stress, consequences, aspects, fp, refresh, skills, stunts, spells, dano automático, eliminação, todos funcionam igual.
- [ ] Replay de evento por evento de uma sessão real produz o mesmo `SessionState` final que produzia antes desta story (validação manual com pelo menos uma mesa em estado avançado).
- [ ] Snapshot antigo carrega: a migração no reducer cobre o formato legacy de `Character`.
- [ ] Build separa `src/systems/fate/` em chunk próprio (verificável no relatório do bundler).
- [ ] Bundle inicial **diminui** (código Fate sai do chunk principal). Quantificar no PR.
- [ ] `knowledge/architecture.md` documenta a topologia final.
- [ ] Nenhum `prompt()`/`confirm()`/`alert()` novo introduzido.
- [ ] Nenhuma mudança de comportamento, balanceamento ou UX Fate (paridade 1:1). PR descreve explicitamente: "extração arquitetural, sem mudança funcional".
