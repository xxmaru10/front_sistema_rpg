---
title: "Story 63 — Infraestrutura de Plugin de Sistema (campo system, interface, registry, seletor)"
description: "Criar a base arquitetural para múltiplos sistemas de RPG sem ainda extrair Fate. Adiciona campo `system` em Session (backend + DB + API), define a interface `SystemPlugin`, cria o `SystemRegistry` com lazy loading, refatora `reduce()` para delegar ao plugin do sistema da sessão, e adiciona seletor de sistema na criação de mesa. Plugin Fate inicial é um wrapper fino do reducer atual — paridade 1:1 garantida."
priority: "alta"
status: "planejada"
last_updated: "2026-04-24"
tags: [eventsourcing, schema, regras, api, fluxo, frontend, backend]
epic: epic-04-suporte-a-multiplos-sistemas-rpg
---

# Story 63 — Infraestrutura de Plugin de Sistema

## Contexto

Hoje toda mesa criada em `/api/sessions` (POST) é implicitamente Fate Core: não existe campo `system` em `Session` (`back_sistema_rpg/prisma/schema.prisma`) e o frontend assume Fate em todo lugar (`src/types/domain.ts`, `src/lib/projections.ts`, `src/lib/gameLogic.ts`, `src/components/CharacterCard/**`). O épico-04 decidiu introduzir uma arquitetura de **plugin de sistema** para permitir Vampiro e, no futuro, D&D, CoC, homebrews etc.

Esta story é a **fundação** do épico. Ela **não move código Fate** — isso é trabalho da story-64. Aqui apenas (a) abrimos espaço no schema/contrato/API para identificar o sistema da mesa, (b) definimos a interface que todos os plugins respeitarão, (c) criamos o registry com lazy loading e (d) tornamos a escolha do sistema obrigatória no fluxo de criação. Ao final desta story, **toda mesa nova carrega `system: "fate"`** e o caminho do código já passa por `registry.load("fate")`, mas o reducer Fate ainda é o `reduce()` atual reaproveitado dentro de um plugin mínimo.

Critérios duros: nenhuma mudança de comportamento perceptível para o usuário (mesa Fate continua idêntica) e nenhum tipo Fate movido para fora de `domain.ts`/`projections.ts`/`gameLogic.ts`.

---

## Comportamento Esperado

### Backend — campo `system` em Session

`back_sistema_rpg/prisma/schema.prisma`:
```prisma
model Session {
  // ... campos existentes ...
  system        String   @default("fate")
  systemConfig  Json?
}
```
- Migration nova `<timestamp>_session_system_field` em `back_sistema_rpg/prisma/migrations/`.
- Mesas existentes recebem `"fate"` automaticamente via `@default`.

`back_sistema_rpg/src/sessions/dto/session.dto.ts`:
- DTO de criação aceita `system?: string` (opcional, default `"fate"`).
- DTO de retorno expõe `system`.

`back_sistema_rpg/src/sessions/sessions.service.ts`:
- `createSession()` persiste `system` (default `"fate"` se não informado).
- `listSessions()` e `getSessionJoinInfo()` retornam `system` no payload.

`back_sistema_rpg/src/sessions/sessions.controller.ts`:
- `POST /api/sessions` aceita `system` no body.
- `GET /api/sessions` e `GET /api/sessions/:id/join-info` retornam `system`.

Validação: `system` deve ser uma string não vazia. Validação semântica (sistema realmente existe) fica no **frontend** — backend é agnóstico de quais plugins existem.

### Contrato de API

Atualizar `knowledge/shared/api-contract.md` (ambos repos, conteúdo espelhado) registrando o campo novo em:
- Request `POST /api/sessions` → `{ name: string; system?: string; gmCode?: string; playerCode?: string }`.
- Response `GET /api/sessions` → cada item ganha `system`.
- Response `GET /api/sessions/:id/join-info` → ganha `system`.

### Frontend — tipos e registry

Novo arquivo `src/systems/index.ts`:
```ts
export type SystemId = string;  // "fate" | "vampire" | "dnd-5e" ... (validado pelo registry)

export interface SystemFeatures {
  fatePoints?: boolean;
  spellSlots?: boolean;
  hpTrack?: boolean;
  sanity?: boolean;
  // Cresce com o tempo. Default: tudo ausente = false.
}

export interface SystemPlugin {
  id: SystemId;
  name: string;                                    // "Fate Core", "Vampiro: A Máscara"
  features: SystemFeatures;
  characterTemplate: () => Character;
  reducer: (state: SessionState, event: ActionEvent) => SessionState;
  eventTypes: readonly string[];
  ui: {
    CharacterCard: ComponentType<{ character: Character }>;
    CombatTab:     ComponentType<{ session: SessionState }>;
    DiceRoller:    ComponentType<DiceRollerProps>;
  };
  gameLogic: {
    isCharacterEliminated: (c: Character) => boolean;
  };
}
```

Novo arquivo `src/systems/registry.ts`:
```ts
const cache = new Map<SystemId, SystemPlugin>();

export const AVAILABLE_SYSTEMS: { id: SystemId; name: string }[] = [
  { id: "fate", name: "Fate Core" },
  // story-65 acrescenta vampire aqui
];

export async function loadSystem(id: SystemId): Promise<SystemPlugin> {
  if (cache.has(id)) return cache.get(id)!;
  try {
    const mod = await import(`./${id}/index.ts`);
    const plugin: SystemPlugin = mod.default;
    cache.set(id, plugin);
    return plugin;
  } catch (e) {
    console.warn(`[systems] plugin "${id}" falhou, usando fallback "fate"`, e);
    if (id !== "fate") return loadSystem("fate");
    throw e;
  }
}
```

Novo arquivo `src/systems/fate/index.ts` (plugin Fate **mínimo/transitório**):
- `id: "fate"`, `name: "Fate Core"`, `features: { fatePoints: true }`.
- `characterTemplate`: retorna o objeto que hoje é construído em `CharacterCreator.tsx` para um PC vazio (mantém a mesma forma).
- `reducer`: re-exporta o `reduce()` atual de `src/lib/projections.ts` **sem mover código** (apenas referência por import).
- `eventTypes`: array com os tipos atuais do `ActionEvent` (pode ser `[]` nesta story; validação completa fica para story-64).
- `ui`: re-exporta os componentes existentes (`CharacterCard`, `CombatTab`, `DiceRoller`) sem mover.
- `gameLogic.isCharacterEliminated`: re-exporta a função homônima de `gameLogic.ts`.

> **Importante**: nesta story, o plugin Fate é uma **fachada de arquivos atuais**, não um lar definitivo deles. A story-64 vai mover o conteúdo para dentro de `src/systems/fate/`. Esta separação proposital deixa o diff de cada story pequeno e revisa-vel.

### Refator do reducer principal

`src/lib/projections.ts` ganha um dispatcher na função `reduce()`:
```ts
export function reduce(state: SessionState, event: ActionEvent): SessionState {
  const plugin = systemRegistry.getCached(state.system ?? "fate");
  if (plugin) return plugin.reducer(state, event);
  return reduceFateLegacy(state, event);  // mesmo corpo de hoje, renomeado
}
```
- A função atual continua existindo internamente como `reduceFateLegacy` para o fallback síncrono (o reducer não pode ser async).
- `getCached()` é uma versão sincrônica de `loadSystem()` que retorna `null` se o plugin ainda não foi pré-carregado — quem cuida do pré-load é a página de sessão (`session/[id]/page.tsx`) **antes** do primeiro replay.

`SessionState` em `domain.ts`:
- Adicionar `system: SystemId`. Em `initialState`, default `"fate"`.

### Página de sessão pré-carrega o plugin

`src/app/session/[id]/page.tsx`:
- Após `fetchSessionJoinInfo(id)` retornar `{ system }`, chamar `await loadSystem(system)` antes de renderizar a árvore de componentes que dependem de UI do plugin (que nesta story ainda são os componentes Fate atuais — sem mudança visual).
- Mostrar tela "Carregando sistema…" enquanto o `import()` dinâmico resolve.

### Tela de criação de mesa

`src/app/page.tsx` (formulário de "criar mesa"):
- Adicionar `<select>` ou cartões selecionáveis com as entradas de `AVAILABLE_SYSTEMS`. Default: `"fate"`.
- Estilo segue o padrão glass das demais entradas (sem novo design system).
- O valor escolhido entra no payload de `createSession()` em `src/lib/apiClient.ts`.

### apiClient

`src/lib/apiClient.ts`:
- `createSession()` aceita `{ name, system, gmCode?, playerCode? }`.
- `fetchSessions()` e `fetchSessionJoinInfo()` retornam `system` no objeto.

### Migração lazy do `system` em sessões antigas

Sessões criadas antes da migration recebem `system = "fate"` direto no banco. No frontend, `SessionState.system` é hidratado de duas fontes possíveis:
1. Snapshot já gravado pode não ter `system` → reducer trata `state.system ?? "fate"`.
2. Eventos antigos não emitem `system` — não precisa, o campo vem do registro de `Session`, não de evento.

Não é necessário evento retroativo nem reescrita de snapshot.

---

## Escopo

### Incluído
- Migration + campo `system` (e `systemConfig`) em `Session`.
- DTO, service e controller do backend aceitando/retornando `system`.
- Atualização de `knowledge/shared/api-contract.md` em ambos os repos.
- `src/systems/index.ts` com a interface `SystemPlugin` e `SystemFeatures`.
- `src/systems/registry.ts` com `loadSystem(id)` lazy + cache + fallback.
- `src/systems/fate/index.ts` mínimo (fachada que aponta para o código Fate atual).
- `SessionState.system` em `domain.ts` + default em `initialState`.
- Dispatcher em `reduce()` que delega ao plugin (com `reduceFateLegacy` como fallback).
- Pré-carregamento do plugin em `session/[id]/page.tsx` antes do replay.
- Seletor de sistema na criação de mesa (`page.tsx`) — apenas Fate disponível por enquanto.
- `apiClient.createSession` aceitando `system`.

### Excluído (fica para outras stories)
- Mover qualquer tipo, função ou componente Fate para dentro de `src/systems/fate/` (story-64).
- Tornar o catálogo `eventTypes` de Fate completo e validado (story-64).
- Plugin Vampiro (story-65).
- Editor de configuração de sistema na UI (`systemConfig` fica criado mas não exposto).
- Mudança de sistema de uma mesa já existente (fora do escopo do épico).

---

## Arquivos afetados

### Backend
- `back_sistema_rpg/prisma/schema.prisma`
- `back_sistema_rpg/prisma/migrations/<timestamp>_session_system_field/migration.sql` (novo)
- `back_sistema_rpg/src/sessions/dto/session.dto.ts`
- `back_sistema_rpg/src/sessions/sessions.service.ts`
- `back_sistema_rpg/src/sessions/sessions.controller.ts`

### Frontend
- `src/systems/index.ts` (novo)
- `src/systems/registry.ts` (novo)
- `src/systems/fate/index.ts` (novo, fachada)
- `src/types/domain.ts` (`SessionState.system`, `initialState.system`)
- `src/lib/projections.ts` (dispatcher + `reduceFateLegacy` rename)
- `src/lib/apiClient.ts` (`createSession` aceita `system`)
- `src/app/page.tsx` (seletor de sistema na criação)
- `src/app/session/[id]/page.tsx` (pré-load do plugin antes do replay)

### Documentação
- `knowledge/shared/api-contract.md` (ambos os repos)
- `knowledge/architecture.md` (frontend) — seção curta "Plugin de Sistema" antecipando a arquitetura

---

## Critérios de Aceitação

- [ ] Migration aplica `system` em `Session` com default `"fate"`; mesas existentes ficam com `"fate"` sem perda de dados.
- [ ] `POST /api/sessions` aceita `{ system }` no body e devolve no payload de retorno.
- [ ] `GET /api/sessions` e `GET /api/sessions/:id/join-info` expõem `system`.
- [ ] `src/systems/index.ts` define `SystemPlugin` com todos os campos descritos.
- [ ] `src/systems/registry.ts` resolve plugins via `import()` dinâmico e cacheia em memória.
- [ ] `src/systems/fate/index.ts` existe e satisfaz `SystemPlugin`, mesmo que internamente referencie os arquivos Fate atuais sem movê-los.
- [ ] `SessionState` carrega `system: SystemId`; `initialState.system === "fate"`.
- [ ] `reduce()` em `projections.ts` delega ao plugin do `state.system`; sem plugin no cache, cai em `reduceFateLegacy` (idêntico ao reducer atual).
- [ ] Página de sessão chama `loadSystem(state.system)` antes do primeiro replay e exibe estado de carregamento durante a resolução.
- [ ] Tela inicial (`page.tsx`) mostra seletor de sistema com Fate como única opção; submissão envia `system: "fate"`.
- [ ] Mesas Fate criadas antes desta story carregam, jogam e exibem ficha/combate/dado **idênticos** ao comportamento atual (paridade 1:1).
- [ ] Bundle inicial não cresce em mais de 5 KB gzipped (a infra é leve; o peso real vem em story-64 quando Fate vira chunk).
- [ ] `knowledge/shared/api-contract.md` atualizado em ambos repos.
- [ ] `knowledge/architecture.md` ganha seção "Plugin de Sistema" com a interface, o registry e a regra plataforma×sistema.
- [ ] Nenhum tipo Fate (`Stunt`, `Aspect`, stress, consequences, fate points) saiu de `domain.ts` ou `projections.ts` nesta story.
- [ ] Nenhum `prompt()`/`confirm()`/`alert()` novo introduzido.
