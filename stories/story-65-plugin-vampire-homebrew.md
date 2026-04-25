---
title: "Story 65 — Plugin Vampire Homebrew (Fate + VtM)"
description: "Criar o segundo plugin do sistema, 'Fate - Homebrew: Vampire'. Estende o Fate Core com mecânicas de Vampiro: trilha de estresse sanguíneo, coluna de consequências de Fome, Geração (algarismo romano editável pelo mestre), Disciplinas no lugar de Magia, lista de perícias customizada. Todas as mudanças refletem na ficha e nos cards da arena."
priority: "alta"
status: "planejada"
last_updated: "2026-04-25"
tags: [eventsourcing, ui, componente, frontend, plugin, vampiro]
epic: epic-04-suporte-a-multiplos-sistemas-rpg
---

# Story 65 — Plugin Vampire Homebrew

## Contexto

A story-64 provou que a interface `SystemPlugin` aguenta a extração de um sistema completo. Esta story cria o **segundo plugin**: `src/systems/vampire/`, um Fate Homebrew voltado para Vampiro: A Máscara. Ele herda toda a estrutura de Fate Core (aspectos, invocações, rolagem 4dF) e acrescenta mecânicas próprias da ambientação: sangue, fome, geração e disciplinas.

Nenhuma linha de código fora de `src/systems/vampire/` deve ser alterada. A plataforma (battlemap, notas, voz, música, timeline) permanece intocada.

---

## Comportamento Esperado

### Perícias

O plugin Vampiro usa uma lista própria de 20 perícias, substituindo as 19 do Fate Core:

| Perícia | Descrição |
|---|---|
| Atletismo | Correr, saltar, escalar, esquivar |
| Carisma | Convencer, liderar, inspirar, seduzir |
| Contatos | Encontrar pessoas, informações, rede de favores |
| Dirigir | Conduzir veículos, perseguições |
| Empatia | Ler intenções, detectar mentiras, primeira impressão |
| Expressão | Arte, música, performance, ofícios criativos |
| Lutar | Combate corpo-a-corpo |
| Investigar | Encontrar pistas, pesquisar, deduzir |
| Conhecimento | Saber acadêmico, história, ciência, línguas |
| Manipulação | Enganar, intimidar, chantagear, coagir |
| Percepção | Sentidos alertas, notar detalhes |
| Ocultismo | Saber sobrenatural, rituais, criaturas |
| Fisiologia | Força, vigor, resistência |
| Recursos | Dinheiro, posses, influência material |
| Atirar | Armas de longo alcance |
| Furtividade | Esconder-se, mover-se em silêncio |
| Ruídos | Conhecer a rua, submundo, crime urbano |
| Sobrevivência | Ermo, rastreamento, lidar com animais |
| Tecnologia | Informática, mecânica, ofícios técnicos |
| Vontade | Resistir mentalmente, focar, superar medo |

### Trilha de Estresse — Sangue

Além das trilhas física e mental existentes, o personagem Vampiro possui uma terceira trilha chamada **Sangue**.

- Renderizada na ficha e no card da arena ao lado (ou abaixo) das trilhas física e mental.
- Label: **"Sangue"** (não "Blood" nem "Sanguíneo").
- Funciona mecanicamente igual às outras trilhas: caixas marcáveis, expansível/reduzível pelo mestre, valores configuráveis por caixa.
- Os eventos reutilizam a mesma convenção: `track: "BLOOD"` nos payloads de estresse existentes — não são criados novos event types para marcar/limpar caixas de sangue.
- A trilha de sangue **não existe em personagens Fate** — é exclusiva do plugin Vampiro.

### Consequências de Fome — Segunda Coluna

O personagem Vampiro possui uma **segunda coluna de consequências** chamada **Fome**, paralela à coluna de Consequências normais.

- Visualmente renderizada ao lado (ou logo abaixo) das consequências normais, com label **"Fome"**.
- Slots padrão idênticos aos da coluna normal: `fome_mild`, `fome_moderate`, `fome_severe` (mais `fome_extreme` opcional).
- Funciona mecanicamente igual às consequências: texto livre, debuff opcional de perícia, slots removíveis/adicionáveis pelo mestre.
- Usa event types próprios para não misturar com os eventos de consequência Fate:
  - `VAMPIRE_HUNGER_CONSEQUENCE_UPDATED` `{ characterId, slot, value, debuff? }`
  - `VAMPIRE_HUNGER_CONSEQUENCE_DELETED` `{ characterId, slot }`
  - `VAMPIRE_HUNGER_CONSEQUENCE_SLOT_ADDED` `{ characterId, slot }`
- A lógica de eliminação (`isCharacterEliminated`) considera **ambas** as colunas: o personagem só é eliminado se todas as consequências normais E todas as de fome estiverem preenchidas.

### Geração

- Campo numérico no personagem: `generation: number` (valor padrão: `13`; range válido: `1–13`).
- **Exibido como algarismo romano** na ficha e no card da arena, ao lado do nome do vampiro.
  - Exemplo: geração 7 → `VII`, geração 13 → `XIII`.
- Editável **apenas pelo mestre** (GM). Jogadores visualizam mas não alteram.
- Event type: `VAMPIRE_GENERATION_UPDATED` `{ characterId: string; generation: number }`.
- Helper `toRoman(n: number): string` em `src/systems/vampire/utils.ts`.

### Disciplinas (substitui Magia)

- O personagem Vampiro **não tem** campo `spells`, `magicLevel` nem as barras roxas de magia.
- No lugar existe o campo `disciplines: Discipline[]`:
  ```ts
  export type Discipline = {
    id: string;
    name: string;       // Ex: "Dominação", "Ofuscação", "Potência"
    description: string;
    cost: string;       // Ex: "1 ponto de sangue"
  };
  ```
- Na ficha, a aba que antes mostrava "Magias" agora mostra **"Disciplinas"**, com o mesmo layout de listagem/edição — sem barras de nível (sem `magicLevel`).
- Event types:
  - `VAMPIRE_DISCIPLINE_UPDATED` `{ characterId: string; discipline: Discipline }`
  - `VAMPIRE_DISCIPLINE_DELETED` `{ characterId: string; disciplineId: string }`

### Cards da Arena

Todos os campos novos refletem no card da arena (`CombatCard` do plugin):

- **Geração**: exibida em algarismo romano próxima ao nome.
- **Trilha de Sangue**: renderizada como terceira trilha de estresse, com visual idêntico às demais.
- **Consequências de Fome**: exibidas no card como segunda coluna de consequências, com label "Fome".
- **Sem barras de magia**: o componente de arena não renderiza `magicLevel` nem barras roxas.

### `characterTemplate`

```ts
{
  id: "",
  name: "Novo Vampiro",
  ownerUserId: "",
  systemData: {
    fatePoints: 3,
    refresh: 3,
    generation: 13,
    stress: {
      physical: [false, false],
      mental: [false, false],
      blood: [false, false, false],   // padrão: 3 caixas de sangue
    },
    stressValues: {
      physical: [1, 2],
      mental: [1, 2],
      blood: [1, 2, 3],
    },
    consequences: {},
    hungerConsequences: {},
    skills: VAMPIRE_SKILLS.reduce((acc, sk) => ({ ...acc, [sk]: 0 }), {}),
    disciplines: [],
    stunts: [],
    inventory: [],
    sheetAspects: ["", "", "", ""],
    removedDefaultSlots: [],
    extraConsequenceSlots: [],
    removedDefaultHungerSlots: [],
    extraHungerSlots: [],
  }
}
```

---

## Escopo

### Incluído
- `src/systems/vampire/index.ts` — plugin completo satisfazendo `SystemPlugin`.
- `src/systems/vampire/types.ts` — `VampireSystemData`, `Discipline`, `VampireCharacter`.
- `src/systems/vampire/events.ts` — `VAMPIRE_EVENT_TYPES` (novos tipos + reuso de eventos genéricos de plataforma).
- `src/systems/vampire/characterTemplate.ts` — `createVampireCharacter()`.
- `src/systems/vampire/reducer.ts` — `reduceVampire()` tratando todos os event types do plugin.
- `src/systems/vampire/gameLogic.ts` — `isCharacterEliminated` (considera fome + consequências normais), `getHungerSlotCapacity`.
- `src/systems/vampire/migrations.ts` — `migrateLegacyVampireCharacter()` idempotente.
- `src/systems/vampire/utils.ts` — `toRoman(n)`, constante `VAMPIRE_SKILLS`.
- `src/systems/vampire/ui/` — componentes de ficha e arena para Vampiro:
  - `CharacterCard/` — aba de perícias com lista Vampiro, trilha de sangue, coluna de fome, campo de geração, aba de disciplinas.
  - `CombatCard/` — card de arena com geração em romano, trilha de sangue, coluna de fome, sem barras de magia.
  - `CombatTab.tsx` — aba de combate (pode reaproveitar estrutura do Fate com substituições pontuais).
  - `DiceRoller.tsx` — igual ao Fate (4dF), sem mudanças de mecânica de dados.
- Adicionar `{ id: "vampire", name: "Fate – Homebrew: Vampire" }` em `AVAILABLE_SYSTEMS` no `registry.ts`.
- Atualizar `knowledge/architecture.md` com o exemplo do plugin Vampiro.

### Excluído
- Qualquer mudança nos arquivos do plugin Fate ou da plataforma.
- Sistema de sangue como recurso gerenciável via mecânica de "gastar sangue por ação" (decisão de regra a ser tomada pelo dono da mesa — o campo existe mas a mecânica específica fica para homebrew da mesa).
- Clan system (clãs e suas bônus automáticos).
- Mecânica de Humanidade (campo existe em `systemData` como número mas sem lógica de perda/ganho automatizada).
- Editor visual de Disciplinas (criação via formulário igual ao de Façanhas).

---

## Arquivos afetados

### Novos (todos em `src/systems/vampire/`)
- `index.ts`
- `types.ts`
- `events.ts`
- `characterTemplate.ts`
- `reducer.ts`
- `gameLogic.ts`
- `migrations.ts`
- `utils.ts`
- `ui/CharacterCard/` (árvore completa)
- `ui/CombatCard/` (com suporte a geração + sangue + fome)
- `ui/CombatTab.tsx`
- `ui/DiceRoller.tsx` (pode ser re-export do Fate se idêntico)

### Modificados (fora de `vampire/`)
- `src/systems/registry.ts` — adicionar `vampire` em `AVAILABLE_SYSTEMS`.

---

## Critérios de Aceitação

- [ ] Plugin `vampire` está em `AVAILABLE_SYSTEMS` e aparece como opção no seletor de criação de mesa.
- [ ] Mesa criada com `system: "vampire"` carrega, o plugin é resolvido pelo registry sem fallback para Fate.
- [ ] Personagem Vampiro exibe **três trilhas de estresse**: Físico, Mental e Sangue.
- [ ] Trilha de Sangue é marcável/desmarcável e expansível/reduzível pelo mestre.
- [ ] Personagem Vampiro exibe **duas colunas de consequências**: Consequências (normal) e Fome.
- [ ] Slots de Fome são adicionáveis/removíveis pelo mestre, aceitam texto livre e debuff de perícia.
- [ ] `isCharacterEliminated` retorna `true` somente quando todos os slots de consequência normais E todos os de fome estiverem preenchidos.
- [ ] Campo Geração é exibido ao lado do nome como algarismo romano (ex: `VII`).
- [ ] Geração é editável pelo GM e somente pelo GM.
- [ ] `VAMPIRE_GENERATION_UPDATED` atualiza o campo no estado e é persistido via event sourcing.
- [ ] Aba "Disciplinas" aparece na ficha no lugar de "Magias"; não há barras de nível roxas.
- [ ] `VAMPIRE_DISCIPLINE_UPDATED` e `VAMPIRE_DISCIPLINE_DELETED` funcionam.
- [ ] Card da arena exibe geração em romano, trilha de sangue, coluna de fome e **não** exibe barras de magia.
- [ ] Lista de perícias da ficha usa as 20 perícias Vampiro (não as 19 do Fate Core).
- [ ] Mesa Fate existente **não é afetada**: abre normalmente, sem trilha de sangue, sem fome, com as perícias Fate.
- [ ] `migrateLegacyVampireCharacter` cobre o caso de snapshot antigo sem `systemData` (idempotente).
- [ ] Nenhum arquivo fora de `src/systems/vampire/` e `src/systems/registry.ts` foi modificado.
- [ ] Nenhum `prompt()`/`confirm()`/`alert()` introduzido.

---

## Notas de Implementação

### Reuso de event types de plataforma/Fate para estresse de sangue

Os eventos `STRESS_MARKED`, `STRESS_CLEARED`, `STRESS_TRACK_EXPANDED`, `STRESS_TRACK_REDUCED` e `STRESS_BOX_VALUE_UPDATED` já aceitam `track: "PHYSICAL" | "MENTAL"`. O reducer do Vampiro simplesmente extende o tratamento para `track: "BLOOD"` sem criar novos event types. O reducer Fate ignora `"BLOOD"` (retorna estado inalterado), garantindo isolamento total.

### `toRoman` — geração em algarismo romano

```ts
export function toRoman(n: number): string {
  const map: [number, string][] = [
    [1000,"M"],[900,"CM"],[500,"D"],[400,"CD"],
    [100,"C"],[90,"XC"],[50,"L"],[40,"XL"],
    [10,"X"],[9,"IX"],[5,"V"],[4,"IV"],[1,"I"],
  ];
  let result = "";
  for (const [value, numeral] of map) {
    while (n >= value) { result += numeral; n -= value; }
  }
  return result;
}
// toRoman(7) → "VII", toRoman(13) → "XIII"
```

### Disciplinas vs Magias

O campo `spells` do Fate não existe no template Vampiro. O reducer Vampiro não processa `CHARACTER_SPELL_UPDATED` nem `CHARACTER_MAGIC_LEVEL_UPDATED`. Os componentes de UI de Vampiro não renderizam barras roxas. A aba usa o mesmo layout de listagem das Façanhas, substituindo "Nível" por "Custo".

### Isolamento garantido pela interface

O plugin Vampiro satisfaz `SystemPlugin` com seu próprio `reducer`, `characterTemplate`, `eventTypes`, `ui` e `gameLogic`. O registry carrega o chunk `vampire` somente em mesas Vampiro — mesas Fate não baixam esse código.
