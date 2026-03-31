---
title: Arquitetura do Sistema
description: Visão geral das decisões de design, padrões e estrutura baseada em Event Sourcing.
tags: [arquitetura, decisões, padrões, eventsourcing]
repo: frontend
related:
  - /knowledge/stack.md
  - /knowledge/shared/api-contract.md
last_updated: 2026-03-31
status: estável
---

# Arquitetura

## Visão Geral
O Fate Companion utiliza uma arquitetura de **Event Sourcing**. Isso significa que as ações mecânicas (movimentação, dano, rolagem de dados) não modificam o banco de dados diretamente; em vez disso, são anexadas a um log cronológico de eventos (timeline).

## O Ciclo do Evento
1. **Ativação**: O usuário trigga uma ação na UI (ex: "Causar Dano").
2. **Dispatch**: O componente React chama `eventStore.append()`.
3. **Network**: O `eventStore` envia o evento para o backend (NestJS/Supabase).
4. **Relay**: O backend carimba o evento e rebate para todos os outros clientes na sala via WebSocket.
5. **Reatividade**: Todos os clientes recebem o evento e a lógica de **projeções** reconstrói o estado atual (`projections.ts`).

## Decisões de Design
| Decisão | Justificativa | Data |
|---|---|---|
| Event Sourcing | Permite replay de sessões, auditoria e sincronia em tempo real sem conflitos de mutação paralela. | 2026-02-15 |
| Projeções no Cliente | Reduz carga no backend e permite UI instantânea através de otimismo local. | 2026-02-15 |
| WebRTC nativo | Suporte a áudio e vídeo sem latência sem depender de serviços externos caros. | 2026-03-01 |
| Sincronia de Presença Híbrida | Uso combinado de WebRTC Signaling e Supabase Presence para limpar zombies e garantir lista de voz fiel. | 2026-03-31 |
| Nuclear Refresh (WebRTC) | Re-instanciação total do módulo via React Keys para purga absoluta de estado e recuperação de áudio stalled sem F5. | 2026-03-31 |
| Inventário Flutuante Lateral | Correção de visibilidade: movido para a esquerda (`left: -260px`) e habilitado `overflow: visible` no `.char-artifact` para evitar clipping. | 2026-03-31 |
| Draggability & Persistence | Inventário agora é arrastável pelo cabeçalho, com posição salva no `localStorage` por personagem. | 2026-03-31 |
| Restrição de Contexto | Inventário flutuante restrito à aba de Personagens; oculto em Arena e Bestiário para limpeza de UI. | 2026-03-31 |
| WebGL Fallback (Dados) | Recuperação automática de erro WebGL e modo low-power para mobile garantem resultado mesmo sob carga de streaming. | 2026-03-31 |
| Timeouts & Safety Rollbacks | Proteção contra travamentos de UI via safety timeouts (15s) no estado de rolagem e AbortController em todas as fecthes. | 2026-03-31 |
| Timeline Sorting Rigoroso | Ordenação prioritária por `seq` sobre `createdAt` local previne flickering de logs e saltos de eventos sob alta latência. | 2026-03-31 |
| Refatoração CharacterCard | Migração para subpasta e conversão de CSS para `.styles.tsx` para conformidade com convenções e melhoria de performance/manutenibilidade. | 2026-03-31 |
| Grid de Perícias Adaptativo | Uso de `auto-fit` e `minmax` para evitar recortes visuais em resoluções desktop variadas, garantindo integridade visual. | 2026-03-31 |
| Orquestração de Playlist (Auto-Play) | Uso de avanço determinístico restrito ao Mestre (GM) para manter sincronia via Event Sourcing e evitar duplicação de eventos. | 2026-03-31 |
| Sincronia de Notas Robusta | Implementação de monitoramento de canal realtime, log de eventos falhos e retentativa exponencial para garantir persistência de notas sob instabilidade. | 2026-03-31 |

## Padrões Adotados
- **Feature-based folders**: Componentes complexos (ex: `CombatCard`) têm sua própria subpasta com hooks e estilos.
- **Hook-to-Component**: Lógica de negócio é isolada em hooks customizados (ex: `useCombatCard`).
- **Global Event Store**: Um store centralizado que gerencia a fila de eventos e persistência.

## O que evitar
- Não coloque lógica de cálculo de jogo diretamente em componentes de UI. Use `gameLogic.ts`.
- Evite mutar o estado local sem despachar um evento se a ação for visível para outros jogadores.
