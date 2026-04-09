---
title: "Story 35 - Bugfix: refresh de logs apagando histórico e persistência da sessão atual"
description: "Corrigir o fluxo de recarga para impedir sumiço de logs no refresh/logout e garantir que a sessão atual permaneça persistida para logs e notas."
priority: "alta"
status: "concluído"
last_updated: "2026-04-09 (implementado)"
tags: [bugfix, logs, notas, eventsourcing, snapshot, sessao]
---

# Story 35 - Bugfix: refresh de logs apagando histórico e persistência da sessão atual

## Contexto
Foram reportados dois problemas acoplados:
1. Ao clicar nos botões de refresh de logs, o histórico some da interface em vez de recarregar.
2. Após sair da sessão/site e entrar novamente, logs de rolagem e referência da sessão atual no topo podem voltar como se estivessem “zerados”, impactando a leitura por sessão e o fluxo de notas.

Leitura de contexto no código atual indica:
- `GET /api/events/:sessionId` no backend está retornando eventos em delta após snapshot (`seq > snapshotUpToSeq`) em `src/events/events.service.ts`.
- O contrato documentado em `/knowledge/shared/api-contract.md` descreve que essa rota carrega todos os eventos da sessão.
- `CombatLog` e `LogTab` renderizam diretamente a partir de `events` em memória no frontend.
- O refresh atual (`useSessionEvents -> globalEventStore.initSession(sessionId, true)`) reinicializa cache local e pode expor apenas delta, escondendo histórico visual.
- Novas notas usam `state.sessionNumber || 1` em `useSessionNotesDiary.ts`; se a sessão atual não for restaurada corretamente, notas podem cair na sessão errada.

## Escopo

### Fase 1 - Consistência do contrato de carregamento de eventos
- Alinhar backend e frontend para que o refresh/reentrada mantenham histórico necessário para visualização de logs.
- Preservar o benefício de snapshot sem perder timeline visível.
- Formalizar payload esperado na integração (incluindo atualização do contrato compartilhado, se necessário).

### Fase 2 - Robustez dos botões de refresh dos logs
- Garantir que refresh em `CombatLog` e `LogTab` recarregue dados sem “apagar” histórico existente quando os dados ainda existem no backend.
- Evitar estado permanente de lista vazia após refresh quando há eventos persistidos.

### Fase 3 - Persistência da sessão atual (sessionNumber)
- Garantir que o número da sessão atual permaneça consistente após logout/relogin/reload.
- Garantir que novas notas continuem sendo gravadas com o `sessionNumber` correto da sessão atual.
- Garantir coerência entre topo/filtros de sessão e segmentação de notas/logs por sessão.

### Fase 4 - Compatibilidade e regressão
- Manter Event Sourcing e projeções sem regressão funcional.
- Manter filtros por sessão dos logs e da aba “Sessão” das notas com comportamento determinístico após refresh e reentrada.

## Arquivos Afetados
| Arquivo | Responsabilidade no escopo |
|---|---|
| `src/lib/eventStore.ts` | Ajustar fluxo de `initSession`/refresh para não perder histórico visual em cenários com snapshot. |
| `src/lib/apiClient.ts` | Adequar tipagem/consumo do payload de carregamento de sessão conforme contrato final. |
| `src/app/session/[id]/hooks/useSessionEvents.ts` | Orquestrar refresh sem apagar dados de UI quando histórico existe no backend. |
| `src/app/session/[id]/hooks/useSessionDerivations.ts` | Garantir mapeamento por sessão consistente após recarga/reentrada. |
| `src/components/CombatLog.tsx` | Validar render de histórico de rolagem após refresh/logout. |
| `src/components/session/LogTab.tsx` | Validar render e filtros por sessão após refresh/logout. |
| `src/features/session-notes/hooks/useSessionNotesDiary.ts` | Assegurar gravação de notas com `sessionNumber` restaurado corretamente. |
| `src/hooks/useHeaderLogic.ts` | Revisar/restaurar fonte de verdade de sessão atual no topo (ou substituição equivalente no fluxo atual). |
| `../back_sistema_rpg/src/events/events.service.ts` | Ajustar estratégia de carregamento para atender contrato e suporte ao histórico visível. |
| `../back_sistema_rpg/src/events/events.controller.ts` | Adequar retorno da rota caso a estrutura de payload de loadSession mude. |
| `knowledge/shared/api-contract.md` | Atualizar contrato para refletir o comportamento real acordado entre frontend/backend. |

## Critérios de Aceitação
1. Clicar em refresh no log da Arena (`CombatLog`) não resulta em perda permanente de histórico quando eventos existem no backend.
2. Clicar em refresh na aba `LogTab` não limpa indevidamente os logs e mantém agrupamento por sessão consistente.
3. Após logout e novo login na mesma sessão, os logs de rolagem continuam visíveis sem necessidade de recriar eventos.
4. O número da sessão atual permanece estável após sair e voltar ao site/sessão.
5. Notas novas, após reentrada, são gravadas com o `sessionNumber` correto da sessão atual (sem fallback incorreto para `1` quando a sessão já avançou).
6. Filtros/visões por sessão em logs e notas permanecem coerentes com os dados persistidos.
7. O comportamento de refresh não introduz regressão no Event Sourcing (ordenação por `seq`, projeções e sincronização em tempo real).

## Fora de Escopo
- Redesign visual de componentes de logs/notas.
- Alteração de regras de combate, mecânicas de rolagem ou permissões de jogo.
- Migração massiva de dados legados fora do necessário para suportar o bugfix.

## Dependências e Riscos
- Mudança cross-repo (frontend + backend) exige alinhamento de deploy entre os dois lados.
- Risco de regressão de performance se a estratégia de retorno de histórico não considerar volume de eventos.
- Risco de divergência de contrato se backend e frontend forem atualizados de forma parcial.

## Status de Execução
- Implementação concluída.
- Backend: endpoint de eventos agora suporta `GET /api/events/:sessionId?history=full` para retorno de histórico completo sem snapshot no payload.
- Frontend: carregamento da sessão passou a consumir `?history=full`, preservando histórico de logs em refresh/reentrada e mantendo `sessionNumber` consistente por replay completo dos eventos.
- Contrato compartilhado atualizado em `knowledge/shared/api-contract.md` (frontend/backend).
- Validação técnica:
  - `back_sistema_rpg`: `npm run build` ✅
  - `front_sistema_rpg`: `npm run build` ✅
