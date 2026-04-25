---
title: "Épico 04 — Suporte a Múltiplos Sistemas de RPG (Plugin de Sistema)"
description: "Transformar o Cronos VTT (hoje monolítico em Fate Core) em uma plataforma multi-sistema. Cada mesa escolhe seu sistema de regras (Fate, Vampiro, futuramente D&D etc.) na criação. Sistemas são plugins isolados que definem template de personagem, event types, reducer e componentes de UI. A plataforma (battlemap, notas, voz, música, eventos, sync) permanece compartilhada."
tags: [vtt, eventsourcing, regras, schema, ui, frontend, backend, fluxo]
repo: frontend
related:
  - /knowledge/architecture.md
  - /knowledge/conventions.md
  - /knowledge/shared/api-contract.md
  - src/types/domain.ts
  - src/lib/projections.ts
  - src/lib/gameLogic.ts
  - src/app/page.tsx
  - src/app/session/[id]/page.tsx
  - ../back_sistema_rpg/prisma/schema.prisma
  - ../back_sistema_rpg/src/sessions/sessions.service.ts
status: planejado
last_updated: 2026-04-24
---

# Épico 04 — Suporte a Múltiplos Sistemas de RPG (Plugin de Sistema)

## Objetivo
Hoje o Cronos VTT é totalmente acoplado a Fate Core: o tipo `Character`, os 70+ event types em `ActionEvent`, o reducer `reduce()` em `projections.ts`, a `gameLogic.ts` e a árvore de componentes (`CharacterCard`, `CombatTab`, `DiceRoller`, `AspectManager` etc.) assumem stress, consequências, aspectos, fate points, refresh e perícias Fate.

Este épico introduz uma camada de **plugin de sistema** que isola tudo o que é "regra de RPG" do que é "ferramenta de mesa". Após o épico, criar uma mesa passa a exigir a escolha do sistema (`fate` ou `vampire` no curto prazo; `dnd-5e`, `coc` etc. no longo prazo). Cada sistema é um módulo auto-contido em `src/systems/<id>/` que implementa uma interface comum, e a UI/lógica genérica delega ao plugin ativo via um `SystemRegistry`.

A plataforma compartilhada (event sourcing, WebSocket, snapshot, battlemap, notas, missões, timeline, música, voz, VI, chat, imagens) **não muda em comportamento** — apenas passa a ler `session.system` quando precisa decidir o que renderizar/processar.

## Contexto necessário para trabalhar neste épico
Antes de iniciar qualquer story deste épico, carregar:
- `/knowledge/architecture.md` (Event Sourcing, projeções, snapshot)
- `/knowledge/conventions.md` (padrões de nomenclatura)
- `/knowledge/shared/api-contract.md` (contrato `/api/sessions` e `/api/events`)
- `src/types/domain.ts` (tipos `Character`, `SessionState`, `ActionEvent`)
- `src/lib/projections.ts` (reducer principal e `initialState`)
- `src/lib/gameLogic.ts` (regras de dano e eliminação Fate)
- `src/app/page.tsx` (fluxo de criação/entrada de mesa)

No backend (apenas para a story de infraestrutura):
- `../back_sistema_rpg/prisma/schema.prisma` (modelo `Session`)
- `../back_sistema_rpg/src/sessions/sessions.service.ts` e `sessions.controller.ts`

## Princípios da arquitetura

### 1. Separação rígida "plataforma × sistema"
| Camada | Responsabilidade | Exemplos |
|---|---|---|
| **Plataforma** (compartilhada) | Tudo que funciona sem conhecer regras de RPG | Event sourcing, WebSocket, battlemap, notas, missões, timeline, música/SFX, voz, VI, chat, imagens, sticky notes, identidade do jogador |
| **Sistema** (plugin) | Tudo que é regra de mesa | Template de personagem, event types específicos, reducer das ações, lógica de dano/morte, componentes de ficha, dado base, condições/recursos |

Regra de bolso ao classificar uma feature nova: *"funciona sem saber as regras do RPG?"*. Sim → plataforma. Não → plugin.

### 2. Interface `SystemPlugin` estrita
Um plugin **obrigatoriamente** exporta:
```ts
interface SystemPlugin {
  id: SystemId;                    // "fate" | "vampire" | "dnd-5e" ...
  name: string;                    // "Fate Core", "Vampiro: A Máscara"
  characterTemplate: () => Character;            // novo personagem
  reducer: (state, event) => SessionState;       // só processa eventos do sistema
  eventTypes: readonly string[];                 // catálogo de tipos válidos
  features: SystemFeatures;                      // flags opt-in (fatePoints, hpTrack, spellSlots, sanity, ...)
  ui: {
    CharacterCard: ComponentType<{ character }>;
    CombatTab:     ComponentType<{ session }>;
    DiceRoller:    ComponentType<{ ... }>;
  };
  gameLogic: {
    isCharacterEliminated: (c: Character) => boolean;
    calculateDamage?: (...) => DamageSelection;
  };
}
```
Adicionar campo obrigatório nessa interface = TypeScript quebra o build dos plugins existentes e força integração consciente em todos os sistemas.

### 3. Lazy loading
Plugins ficam em chunks separados (`import("../systems/fate")`). Mesa Fate não baixa código de Vampiro, e vice-versa. O bundle inicial fica **igual ou menor** que hoje.

### 4. Compatibilidade total com mesas existentes
Sessões já criadas (sem `system`) são tratadas como `system === "fate"` por padrão. Eventos antigos continuam válidos pois o reducer de Fate aceita exatamente os mesmos `ActionEvent` que existem hoje.

### 5. Snapshot ainda funciona
`SessionSnapshot.state` continua sendo o `SessionState` projetado. O reducer do plugin é quem produz esse estado, mas a tabela e o fluxo de upsert não mudam.

## Frentes do épico
1. **Infraestrutura de plugin (backend + frontend)**: campo `system` em `Session`, interface `SystemPlugin`, registro/loader, refator do `reduce()` para delegar ao plugin, seletor de sistema na criação de mesa.
2. **Extração do Fate como primeiro plugin**: mover toda a lógica/UI Fate de `src/types/domain.ts`, `src/lib/projections.ts`, `src/lib/gameLogic.ts` e `src/components/CharacterCard/**`, `CombatTab.tsx`, `DiceRoller.tsx` para `src/systems/fate/`. Validar paridade total com o comportamento atual.
3. **Plugin Vampiro** (escopo a definir pelo dono do épico antes de abrir a story).
4. **[Futuro distante]** Plugins adicionais (D&D 5e, Call of Cthulhu, Fate Homebrew etc.) — cada um vira sua própria story dentro deste mesmo épico, sem repensar arquitetura.

## Arquivos afetados (previsão geral)

### Backend
- `back_sistema_rpg/prisma/schema.prisma` — adicionar `system String @default("fate")` e `systemConfig Json?` em `Session`.
- `back_sistema_rpg/prisma/migrations/<timestamp>_session_system/` — migration nova.
- `back_sistema_rpg/src/sessions/dto/session.dto.ts` — campo `system`.
- `back_sistema_rpg/src/sessions/sessions.service.ts` e `sessions.controller.ts` — aceitar e devolver `system`.
- `knowledge/shared/api-contract.md` (ambos repos) — registrar o campo novo.

### Frontend (estrutura nova)
- `src/systems/index.ts` — `SystemId`, `SystemPlugin`, `SystemFeatures`.
- `src/systems/registry.ts` — `loadSystem(id)`, cache, fallback default.
- `src/systems/fate/index.ts` — plugin Fate (entrega na story-64).
- `src/systems/fate/reducer.ts`, `gameLogic.ts`, `characterTemplate.ts`, `events.ts`, `ui/` — código extraído.

### Frontend (refator no que já existe)
- `src/types/domain.ts` — `Character.systemData?: Record<string, unknown>` opcional, `SessionState.system: SystemId`. Tipos Fate-específicos (`Stunt`, `Spell`, `Aspect`, stress, consequences) movem para `src/systems/fate/types.ts` e re-exportam.
- `src/lib/projections.ts` — reducer principal vira **dispatcher** que delega ao plugin do sistema da sessão.
- `src/lib/gameLogic.ts` — funções viram thin wrappers que chamam `plugin.gameLogic.*`.
- `src/app/page.tsx` — formulário de criação ganha `<SystemSelector />`.
- `src/app/session/[id]/page.tsx` — carrega plugin via `loadSystem(state.system)` e injeta `plugin.ui.CharacterCard`/`CombatTab`/`DiceRoller` onde hoje há imports diretos.
- `src/lib/apiClient.ts` — `createSession({ name, system, gmCode, playerCode })`.

## Histórias planejadas (numeradas na ordem de entrega)
| ID | Título | Arquivo | Status |
|---|---|---|---|
| story-63 | Infraestrutura de Plugin de Sistema (campo `system`, interface, registry, seletor) | `/stories/story-63-infraestrutura-plugin-sistema.md` | planejada |
| story-64 | Extrair Fate Core como primeiro plugin | `/stories/story-64-extrair-fate-como-primeiro-plugin.md` | planejada |
| story-65 | Plugin Vampiro (escopo a definir pelo dono do épico) | a abrir | a abrir |

## Dependências entre stories
- **story-63** entrega a infraestrutura crua (campo de DB, interface, registry, seletor de UI). Após ela, todas as mesas continuam Fate, mas o caminho do código já passa pelo registry com um plugin Fate **mínimo/temporário** que apenas re-exporta o reducer atual.
- **story-64** depende de **story-63** e move de fato todo o código Fate para `src/systems/fate/`. Ao final, `domain.ts`, `projections.ts` e `gameLogic.ts` ficam genéricos.
- **story-65** (Vampiro) depende de **story-64** estar concluída — só faz sentido criar um segundo plugin depois que Fate provou que a interface aguenta a extração.
- Ordem obrigatória: **63 → 64 → 65 → futuros**.

## Critérios de aceitação do épico
- [ ] `Session.system` existe no banco, no DTO e no contrato de API; mesas antigas migram para `"fate"` automaticamente.
- [ ] Tela de criação de mesa exige a escolha do sistema antes de submeter.
- [ ] Existe a interface `SystemPlugin` em `src/systems/index.ts` com `id`, `name`, `characterTemplate`, `reducer`, `eventTypes`, `features`, `ui` e `gameLogic`.
- [ ] `src/systems/registry.ts` carrega o plugin via `import()` dinâmico, com cache em memória.
- [ ] `reduce()` em `projections.ts` delega ao reducer do plugin do `state.system`.
- [ ] Fate vive inteiramente em `src/systems/fate/`; `domain.ts`, `projections.ts` e `gameLogic.ts` não contêm mais referência a stress/consequências/aspectos/fate points.
- [ ] Mesas Fate existentes (eventos antigos + snapshot antigo) carregam e funcionam com paridade 1:1 — ficha, combate, dado, dano automático, eliminação, todos os 70+ event types.
- [ ] Bundle inicial não cresce: o código Fate vira chunk separado.
- [ ] Documentação em `/knowledge/architecture.md` ganha seção "Plugin de Sistema" descrevendo a interface, o registry e a regra de classificação plataforma×sistema.
- [ ] `/knowledge/shared/api-contract.md` documenta o campo `system`.

## Fora do escopo
- Plugin de D&D 5e, Call of Cthulhu, Fate Homebrew ou qualquer outro além de Fate (na story-64) e Vampiro (na story-65).
- Migração de personagens entre sistemas (mudar uma mesa Fate → Vampiro mantendo PCs).
- Editor visual de homebrew (criar plugin pela UI sem código).
- Marketplace de plugins, instalação por usuário final, sandboxing de plugin de terceiros.
- Internacionalização do `name` do plugin (usar pt-BR direto).

## Riscos e mitigações
- **Vazamento de Fate na plataforma**: hoje há referências a stress/aspects em hooks, lógicas e UI que parecem "genéricas". Mitigação: durante a story-64, marcar com `// FATE-SPECIFIC` qualquer trecho duvidoso e revisar antes de mover; rodar a mesa real ao final de cada bloco extraído.
- **Quebra de snapshots antigos**: se o reducer Fate mudar de assinatura/comportamento ao virar plugin, snapshots já persistidos divergem. Mitigação: a story-64 mantém o reducer **bit-a-bit** idêntico ao atual, só muda o local; testes de replay com sessões reais antes do merge.
- **Custo cognitivo de uma camada de indireção a mais**: dispatcher → plugin → reducer pode confundir contribuições futuras. Mitigação: documentação clara em `architecture.md` + comentário curto no `projections.ts` apontando para o registry.
- **Lazy loading falhando offline**: se o `import()` dinâmico falhar (rede ruim, deploy quebrado), a mesa não carrega. Mitigação: o registry tem fallback para `fate` como sistema "garantido" (já em cache), e a UI mostra erro claro quando o plugin pedido não resolve.
- **Tentação de adicionar features só num plugin**: o épico é arquitetural, não funcional. Adicionar mecânicas novas no Fate durante a extração inflaria escopo. Mitigação: review cobra paridade 1:1 com o comportamento de hoje na story-64.
