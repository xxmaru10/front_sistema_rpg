---
title: Contrato de API compartilhado
description: Fonte de verdade para rotas, tipos e payloads compartilhados entre frontend e backend.
tags: [api, contrato, tipos, rotas, shared]
repo: shared
related:
  - /knowledge/api/endpoints.md
last_updated: 2026-03-31
status: estável
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
| GET | `/events/:sessionId` | Carrega todos os eventos de uma sessão |
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

export type SessionData = {
  id: string;
  name: string;
  gmUserId: string;
};
```

## Códigos de Erro
| Código | Significado |
|---|---|
| 404 | Sessão ou evento não encontrado |
| 500 | Erro interno no processamento de eventos |
