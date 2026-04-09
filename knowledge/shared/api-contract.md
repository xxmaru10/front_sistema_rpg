---
title: Contrato de API compartilhado
description: Fonte de verdade para rotas, tipos e payloads compartilhados entre frontend e backend.
tags: [api, contrato, tipos, rotas, shared]
repo: shared
related:
  - /knowledge/api/endpoints.md
last_updated: 2026-04-09 (story-36/notas-submenus-privados-jogadores)
status: ativo
---

# Contrato de API

## Base URL
- Produção: `https://api.[dominio].com/v1`
- Local: `http://localhost:3001/api`

## Autenticação
Atualmente utiliza autenticação baseada em códigos de sessão (`gmCode`, `playerCode`).

## Rotas Principais

### Sessões
| Método | Rota | Descrição |
|---|---|---|
| GET | `/sessions` | Lista todas as sessões ativas |
| POST | `/sessions` | Cria uma nova sessão |
| GET | `/sessions/:id/join-info` | Retorna códigos de acesso e personagens disponíveis |
| PUT | `/sessions/:id/snapshot` | Atualiza o snapshot de estado da projeção |

### Eventos (Event Sourcing)
| Método | Rota | Descrição |
|---|---|---|
| GET | `/events/:sessionId` | Carrega eventos da sessão (modo padrão: delta pós-snapshot; `?history=full`: histórico completo sem snapshot no payload) |
| POST | `/events/:sessionId` | Adiciona um novo evento à timeline |
| DELETE | `/events/:sessionId` | Limpa o log de eventos da sessão |

### Bestiário
| Método | Rota | Descrição |
|---|---|---|
| GET | `/bestiary` | Retorna o bestiário global de NPCs |

## Tipos Principais (Pseudo-TS)

```typescript
export type EventEnvelope<TType extends string, TPayload> = {
  id: string;
  sessionId: string;
  seq: number;
  type: TType;
  actorUserId: string;
  visibility: "PUBLIC" | "GM_ONLY" | { kind: "PLAYER_ONLY"; userId: string };
  createdAt: string;
  payload: TPayload;
};

export type StressTrackValues = {
  physical: number[]; // cada caixa absorve este valor (clamp 1..1000)
  mental: number[];
};

export type Character = {
  id: string;
  ownerUserId: string;
  stress: {
    physical: boolean[];
    mental: boolean[];
  };
  stressValues?: StressTrackValues; // legado sem campo: fallback por índice
  impulseArrows?: number; // contador de setas de impulso no card
};

export type SessionData = {
  id: string;
  name: string;
  gmUserId: string;
};

export type SessionJoinInfo = {
  gmCode: string;
  playerCode: string;
  characters: Array<{
    id: string;
    name: string;
    ownerUserId: string;
    imageUrl?: string;
    isNPC?: boolean;
    religionId?: string;
  }>;
};

export type Note = {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
  isPrivate?: boolean;
  sessionNumber?: number;
  folderId?: string;
};

export type NoteFolder = {
  id: string;
  ownerId: string;
  name: string;
  color: string;
  order: number;
  createdAt: string;
};

export type WorldEntity = {
  id: string;
  name: string;
  type: "PERSONAGEM" | "FACAO" | "FAMILIA" | "BESTIARIO" | "LOCALIZACAO" | "RELIGIAO" | "MAPA" | "RACA" | "OUTROS";
  description?: string;
  religionId?: string;
  imageUrl?: string;
  fieldVisibility?: Record<string, boolean>;
};
```

## Eventos de Domínio Relevantes (Story 32)

```typescript
type StressTrackExpanded = EventEnvelope<"STRESS_TRACK_EXPANDED", {
  characterId: string;
  track: "PHYSICAL" | "MENTAL";
  value?: number; // opcional; reducer aplica clamp 1..1000
}>;

type StressBoxValueUpdated = EventEnvelope<"STRESS_BOX_VALUE_UPDATED", {
  characterId: string;
  track: "PHYSICAL" | "MENTAL";
  boxIndex: number;
  value: number; // clamp 1..1000
}>;

type CharacterUpdatedImpulse = EventEnvelope<"CHARACTER_UPDATED", {
  characterId: string;
  changes: {
    impulseArrows?: number; // GM-only no fluxo de UI
  };
}>;

type NoteUpdated = EventEnvelope<"NOTE_UPDATED", {
  noteId: string;
  content?: string;
  patch?: Partial<Note>;
}>;

type NoteFolderCreated = EventEnvelope<"NOTE_FOLDER_CREATED", NoteFolder>;

type NoteFolderUpdated = EventEnvelope<"NOTE_FOLDER_UPDATED", {
  folderId: string;
  patch: Partial<NoteFolder>;
}>;

type CharacterNoteUpdated = EventEnvelope<"CHARACTER_NOTE_UPDATED", {
  characterId: string;
  noteId: string;
  patch: {
    content?: string;
  };
}>;
```

## Códigos de Erro
| Código | Significado |
|---|---|
| 404 | Sessão ou evento não encontrado |
| 500 | Erro interno no processamento de eventos |
