---
title: Arquitetura do Sistema
description: Visão geral das decisões de design, padrões e estrutura baseada em Event Sourcing.
tags: [arquitetura, decisões, padrões, eventsourcing]
repo: frontend
related:
  - /knowledge/stack.md
  - /knowledge/shared/api-contract.md
last_updated: 2026-04-04
status: ativo
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
| Estado de UI stuck | Toda ação de carregamento/estado bloqueado (ex: `isRolling`) deve ter um safety timeout para auto-destravamento. | 2026-03-31 |
| WebGL Fallback (Dados) | Recuperação automática de erro WebGL e modo low-power para mobile garantem resultado mesmo sob carga de streaming. | 2026-03-31 |
| Timeouts & Safety Rollbacks | Proteção contra travamentos de UI via safety timeouts (15s) no estado de rolagem e AbortController em todas as fecthes. | 2026-03-31 |
| Timeline Sorting Rigoroso | Ordenação prioritária por `seq` sobre `createdAt` local previne flickering de logs e saltos de eventos sob alta latência. | 2026-03-31 |
| Refatoração CharacterCard | Migração para subpasta e conversão de CSS para `.styles.tsx` para conformidade com convenções e melhoria de performance/manutenibilidade. | 2026-03-31 |
| Grid de Perícias Adaptativo | Uso de `auto-fit` e `minmax` para evitar recortes visuais em resoluções desktop variadas, garantindo integridade visual. | 2026-03-31 |
| Orquestração de Playlist (Auto-Play) | Uso de avanço determinístico restrito ao Mestre (GM) para manter sincronia via Event Sourcing e evitar duplicação de eventos. | 2026-03-31 |
| Sincronia de Notas Robusta | Implementação de monitoramento de canal realtime, log de eventos falhos e retentativa exponencial para garantir persistência de notas sob instabilidade. | 2026-03-31 |
| Consolidação PowerTabs | Unificação de Façanhas, Inventário e Magias em um único container de abas estático para otimizar espaço e fluxo. | 2026-03-31 |
| Expansão de Viewport (+40%) | Aumento do `max-width` da ficha para 2500px, priorizando espaço para Lore/Aspectos e mantendo fidelidade de retrato. | 2026-03-31 |
| Minimalismo de Headers | Remoção de títulos redundantes do `SessionHeader` para reduzir ruído visual e priorizar arte de capa. | 2026-03-31 |
| Projeção Light no Join-Info | Otimização do backend para filtrar personagens deletados e prover metadados atualizados na tela de entrada. | 2026-04-01 |
| Estética Premium na Seleção | Reformulação visual da escolha de personagens com Grid de Tarot e animações de selo para maior imersão. | 2026-04-01 |
| Patching Diferencial (World Entities) | Otimização de rede que envia apenas campos alterados (`Partial<WorldEntity>`) em eventos de atualização, prevenindo erros 413 (Payload Too Large). | 2026-04-02 |
| Otimização de Asset Imaging | Redução de resolução (600px) e compressão agressiva (0.7 quality) via Canvas API para todos os uploads de imagens (Entidades, Mapas e Personagens). | 2026-04-02 |
| Sistema de Religiões | Integração de Religião como entidade de primeira classe com suporte a iconografia dedicada (`Church`) e vinculação em Personagens/NPCs. | 2026-04-02 |
| Navegação via Portal | Uso de React Portals para menus de sub-navegação em SessionNotes para evitar conflitos de z-index e clipping de overflow. | 2026-04-02 |
| Post-its Sincronizados | Migração completa de localStorage para Event Sourcing; visibilidade PLAYER_ONLY garante privacidade entre sessões e usuários. | 2026-04-02 |
| Filtros Universais (Searchable) | Expansão do sistema de filtros para todas as abas (Notas, Tempo, Jogo) com busca interna e renderização via Portal para conformidade vitoriana. | 2026-04-03 |
| Sugestões de Tags (Autocomplete) | Implementação de dropdown de sugestão em World Entities baseado na projeção de tags existentes, otimizando a criação de entidades. | 2026-04-03 |
| Robustez de Tagging Mobile | Correção de salto de foco via `preventDefault` e suporte a `onBlur` + multiplicadores (,, ;) para entrada de tags estável em dispositivos móveis. | 2026-04-03 |
| Transmissão de Tela Estável (Story 19) | Normalização de userId (`.trim().toLowerCase()`) no `screen-share-manager.ts`. Broadcaster sempre recria conexão ao receber `peer-join` (fix: F5 do jogador sem intervenção do mestre). Bitrate adaptativo por peerCount (≤2→4Mbps, ≤5→2.5Mbps, ≤8→1.5Mbps, 9+→1Mbps) via `getAdaptiveBitrate()`. Safety timeout 15s para ICE stuck. `reconnect()` público. Botão `RefreshCw` na Arena via `.screenshare-refresh-btn`. Badge "Sem sinal" após 10s sem frames via `.screenshare-nosignal`. Vídeo oculto via `display:none` CSS em outras abas (nunca unmount). | 2026-04-04 |
| WebRTC Áudio Bidirecional (Story 18) | Fix do loop de re-join (H5): non-offerer agora faz espera passiva com fallback único de 5s. Normalização de userId (.trim().toLowerCase()) no deterministic offerer. Flag `_presenceSubscribed` + retry exponencial para `track()` prematuro. Safety timeout de 15s para conexões presas em 'connecting'. | 2026-04-04 |
| WebRTC Qualidade de Áudio e Suporte Internacional | `latencyHint: 'interactive'` no AudioContext reduz buffer de processamento. `channelCount: 1` (mono) reduz carga ~50% por stream. Opus forçado como codec preferido via `setCodecPreferences` (reordenação, sem modificação de objetos — Chrome 105+ lança `InvalidModificationError` em objetos modificados). FEC (`useinbandfec=1`) e DTX (`usedtx=1`) via SDP munging em offer e answer, garantindo resiliência a perda de pacotes em links intercontinentais. Bitrate adaptativo por contagem de peers (64→32kbps), aplicado uma única vez em `connected` via `applyBitrateToSender`. Suporte até 12 peers em topologia mesh. `sampleRate` explícito removido do AudioContext e getUserMedia — browser usa taxa nativa do hardware para evitar mismatch com analyser. | 2026-04-04 |

## Padrões Adotados
- **Feature-based folders**: Componentes complexos (ex: `CombatCard`) têm sua própria subpasta com hooks e estilos.
- **Hook-to-Component**: Lógica de negócio é isolada em hooks customizados (ex: `use-power-tabs.ts`).
- **Global Event Store**: Um store centralizado que gerencia a fila de eventos e persistência.

## O que evitar
- Não coloque lógica de cálculo de jogo diretamente em componentes de UI. Use `gameLogic.ts`.
- Evite mutar o estado local sem despachar um evento se a ação for visível para outros jogadores.
