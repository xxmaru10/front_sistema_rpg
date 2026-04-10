---
title: Arquitetura do Sistema
description: Visão geral das decisões de design, padrões e estrutura baseada em Event Sourcing.
tags: [arquitetura, decisões, padrões, eventsourcing]
repo: frontend
related:
  - /knowledge/stack.md
  - /knowledge/shared/api-contract.md
last_updated: 2026-04-10 (story-36/follow-up-slot-inventario-menções)
status: ativo
---

# Arquitetura

## Visão Geral
O Cronos Vtt utiliza uma arquitetura de **Event Sourcing**. Isso significa que as ações mecânicas (movimentação, dano, rolagem de dados) não modificam o banco de dados diretamente; em vez disso, são anexadas a um log cronológico de eventos (timeline).

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
| Esquema de Campos por Tipo (Story 20) | Mapa estrito de campos por WorldEntityType: `religionId` apenas para PERSONAGEM; `originId` para PERSONAGEM e BESTIARIO; `currentLocationId` para PERSONAGEM e FACAO; `linkedLocationId` para LOCALIZACAO, MAPA e BESTIARIO. Modal condicionalizado por tipo. Metadados de listagem expandidos por tipo (local, raça, profissão, tipo de local). Paste do MentionEditor sanitizado para texto puro. Scroll do dropdown de filtros corrigido via flex+minHeight. | 2026-04-04 |
| Fragmentação de useSessionNotes (Story 20 — Correção de Padrões) | Hook monolítico (1500+ linhas) fragmentado em 4 sub-hooks na pasta `src/hooks/session-notes/`: `useWorldEntities.ts`, `useSessionMissions.ts`, `useSessionSkillsItems.ts`, `useSessionNotesDiary.ts`. `useSessionNotes.ts` mantido como orquestrador com API pública inalterada (spread dos sub-hooks). `alert()/confirm()` substituídos por `console.error`. CSS injections movidas para `*.styles.tsx` com componente `<style>`. userId normalizado com `.trim().toLowerCase()` na entrada de cada sub-hook. | 2026-04-04 |
| WebRTC Qualidade de Áudio e Suporte Internacional | `latencyHint: 'interactive'` no AudioContext reduz buffer de processamento. `channelCount: 1` (mono) reduz carga ~50% por stream. Opus forçado como codec preferido via `setCodecPreferences` (reordenação, sem modificação de objetos — Chrome 105+ lança `InvalidModificationError` em objetos modificados). FEC (`useinbandfec=1`) e DTX (`usedtx=1`) via SDP munging em offer e answer, garantindo resiliência a perda de pacotes em links intercontinentais. Bitrate adaptativo por contagem de peers (64→32kbps), aplicado uma única vez em `connected` via `applyBitrateToSender`. Suporte até 12 peers em topologia mesh. `sampleRate` explícito removido do AudioContext e getUserMedia — browser usa taxa nativa do hardware para evitar mismatch com analyser. | 2026-04-04 |
| Robustez em Imagens de Mundo (Story 21) | Implementação de `isImageProcessing` no formulário para bloquear submissão durante compressão (Canvas API) em background. Simplificação da lógica de `imageUrl` em `useWorldEntities.ts` (unificado para todos os tipos). `fieldVisibility` agora padrão `false` (visível) para evitar confusão de "item sumido" após criação. | 2026-04-04 |
| ImageCropper Modal (Story 23) | Componente portal-based `src/components/ImageCropper` com Canvas API. Detecta tamanho: >limiar → abre cropper; ≤limiar → comprime direto. Zoom multiplicativo com clamp ao coverZoom. Offset clamped para garantir imagem sempre cobre o frame. Saída JPEG 0.7 quality. Threshold: retratos 600×600, mapas 1200×720. Integrado em CharacterCard e CreateWorldEntityModal (self-contained via useState local no modal). | 2026-04-04 |
| Responsividade e Iconografia da Ficha (Story 22) | Fix de overflow da coluna Lore/Aspectos via `minmax(0, 1fr)` no `.top-layout-grid` + `min-width: 0` em `.info-tower-column`. "RESERVA DESTINO" → "PONTOS DE DESTINO". Componente ~20% menor (padding 24→14px, font 3rem→2.4rem). Abas PowerTabs migradas para Lucide icons (`Zap`, `Briefcase`, `Wand2`) sem texto, com `title` tooltip. Barra mágica realocada para o topo do container de atributos e background unificado com o tema escuro global. | 2026-04-04 |
| Rebranding Global (Cronos Vtt) | Renomeação completa de "Fate Companion / Project GM" para **Cronos Vtt** em layouts, metadados e documentação para alinhar com a nova identidade visual. | 2026-04-04 |
| Padronização de Segurança e Eventos | Normalização obrigatória de `userId` (`.trim().toLowerCase()`) em todos os hooks e remoção total de chamadas nativas bloqueantes (`alert`/`confirm`) em favor de Portals/UI states. | 2026-04-04 |
| Blindagem de Áudio (Story 30) | `MusicPlayer` agora aceita apenas URL YouTube com `videoId` válido (bloqueia links de busca/resultados que causavam `NotSupportedError` e estado falso de "tocando"), e o retry de autoplay ignora fontes inválidas. `VoiceChatManager` passou a usar constraints sem `noiseSuppression/autoGainControl` para reduzir artefatos de voz e adicionou guarda de loopback: durante screen share com áudio, o broadcaster suprime playback remoto local para evitar eco "caverna" recapturado pela aba. | 2026-04-07 |
| Robustez de Áudio Atmosférico (Story 30) | `AtmosphericPlayer` agora aplica bootstrap por `bulkEvents` (último `ATMOSPHERIC_PLAYBACK_CHANGED`) para jogadores que entram após o início do ambiente, adiciona guarda de stale event por `seq/createdAt`, serializa operações de `play/pause` com token para eliminar corrida `AbortError` e inclui retry de autoplay por gesto de usuário quando bloqueado pelo navegador. | 2026-04-07 |
| Estabilidade Voice + Transmissão (Story 30) | `VoiceChatManager` voltou a priorizar inteligibilidade de voz (`noiseSuppression` + `autoGainControl` em constraints preferenciais), elevou bitrate de envio Opus para 48kbps (40kbps em malha alta) e trocou mute total do loopback guard por ducking (~35%) durante tab-audio share, preservando a escuta do mestre. `screen-share-manager` ganhou guardas anti-churn (não recriar PC saudável em `peer-join`, ignorar `answer` stale fora de `have-local-offer`, timeout só fecha PC ativo), reduzindo loops de `offer/answer` e `InvalidStateError`. `MusicPlayer` passou a aplicar `MUSIC_PLAYBACK_CHANGED` do bulk bootstrap (delta) antes do snapshot para restaurar corretamente estado `isPlaying`/indicador visual ao entrar na sessão. | 2026-04-07 |
| Malha de Voz Hardened (Story 30 — follow-up) | `VoiceChatManager` eliminou ping-pong de `voice-join` no answerer (agora espera passiva + fallback único), normalizou chaves de peer por `userId` para evitar duplicidade por casing, adicionou throttling de `voice-join`, timeout de segurança para conexões presas e reconexão dirigida por peer (sem broadcast em cascata). Ajustou bitrate Opus para 64/56/52kbps (malha baixa/média/alta), priorização de encoding e desativação de DTX para reduzir cortes perceptíveis de fala. `setMicDevice` passou a evitar automaticamente input Bluetooth HFP quando houver alternativa, reduzindo degradação em headsets wireless. `screen-share-manager` reduziu bitrate de vídeo para preservar uplink da call e priorizou bitrate de áudio da transmissão (128→64kbps adaptativo). `useSessionScreenControl`, `TransmissionPlayer` e `useSessionUIState` subiram fallback de volume da transmissão para 100% e reduziram reconnect automático desnecessário quando não há stream ativa. | 2026-04-07 |
| Cards de Combate com Impulso e Estresse Configurável (Story 32) | `Character` ganhou `impulseArrows` e `stressValues` por trilha. Projeções normalizam personagens legados, `STRESS_TRACK_EXPANDED` aceita `value` opcional, novo evento `STRESS_BOX_VALUE_UPDATED` permite edição granular e `gameLogic.calculateAbsorption` passou a absorver dano pelo valor real de cada caixa. UI de combate exibe setas de impulso (glow branco) com controle GM-only e header reorganizado (nome no topo, destino + impulso abaixo). | 2026-04-08 |
| Polimento Visual do Card da Arena (Story 32 — follow-up) | Trilha de estresse no card da Arena migrou para iconografia sem emoji (SVG `Brain` e `Dumbbell`), com espaçamento mais compacto entre rótulo e caixas para leitura rápida. Seções de extras foram diferenciadas por semântica cromática: Façanhas em azul (alinhadas ao botão de rolagem) e Magias em roxo, mantendo contraste e hierarquia visual. | 2026-04-08 |
| Reestruturação da Ficha com Resumo e Abas (Story 33) | `CharacterCard` foi reorganizado em um bloco superior de Resumo sempre visível e um segundo nível de abas para Lore, Façanhas/Magia, Inventário e Notas Privadas. A implementação preserva a lógica já existente de edição/eventos, reaproveitando os mesmos componentes e mantendo notas gerais acessíveis dentro do atalho privado da ficha. | 2026-04-08 |
| Navegação Lateral por Avatares na Arena (Story 34) | `CombatTab` passou a orquestrar abertura de cards por lado da Arena com rails laterais de retratos compactos; `CombatCard` ganhou modo compacto e o header expandido substituiu o antigo `+/-` por um botão com retrato. A mudança preserva o card completo existente, mantém hazards fora do novo fluxo e não altera Event Sourcing. | 2026-04-08 |
| Submenus Privados e Visão por Jogador (Story 36) | Notas privadas ganharam `noteFolders` próprios por usuário, persistidos por eventos e sempre resolvidos com fallback em `Todas`. A aba Jogadores passou a navegar por submenus derivados dos personagens e as projeções de notas adotaram `upsert`/patch por `id` para evitar duplicação rara em replay/retry. | 2026-04-09 |

| Consolidação Feature-based (Session Notes) | Migração completa de SessionNotes para `src/features/session-notes`. Agrupamento de hooks especializados (fragmentação do useSessionNotes), componentes de abas e estilos em um único domínio isolado. Substituição de `confirm()` nativo por `useDeleteConfirm` (UX de exclusão segura não-bloqueante/portal-based) em todas as abas. | 2026-04-04 |

## Registro de Decisões (Story 31)
- **Normalização de autoria nas notas**: comparações de `authorId` passaram a usar equivalência normalizada (`trim().toLowerCase()`) nos fluxos de renderização/permissão de Notas para eliminar dessincronia entre UI e eventos.
- **Reprojeção de edição de notas**: `NOTE_UPDATED` foi consolidado no reducer de projeções para refletir alterações de conteúdo após envio, sincronização e recarga.
- **Resiliência de persistência para notas**: retry/backoff e marcação de falha no `eventStore` foram ampliados para eventos de notas (incluindo IDs relacionados de nota), melhorando feedback de erro/retentativa.
- **Status de implementação**: correções aplicadas e validadas com build de produção (`next build`) em 2026-04-08.

## Registro de Decisões (Story 32)
- **Setas de impulso no modelo de personagem**: optamos por `impulseArrows` em `Character` com atualização via `CHARACTER_UPDATED`, mantendo compatibilidade com o fluxo já consolidado de patch parcial em Event Sourcing.
- **Estresse por capacidade de caixa**: adicionamos `stressValues.physical|mental` com fallback legado (`index + 1`) na projeção para preservar sessões antigas sem migração destrutiva.
- **Eventos de estresse evoluídos**: `STRESS_TRACK_EXPANDED` agora aceita `value` opcional e foi criado `STRESS_BOX_VALUE_UPDATED` para edição pontual de caixa, ambos clampados em `1..1000` no reducer.
- **Regra de absorção alinhada ao domínio**: `calculateAbsorption` passou a consumir capacidade real da caixa, mantendo marcação de caixas por índice e sem alterar contratos de consequência.
- **Permissão GM-only reforçada**: controles de setas e edição de valor de estresse foram encapsulados em handlers com guarda de papel (`isGM`) e emissão de eventos com `actorUserId` normalizado.
- **Polimento visual contextual da Arena**: card de combate recebeu iconografia vetorial (sem emoji) para trilhas de estresse e separação cromática explícita entre Façanhas (azul) e Magias (roxo), preservando o modelo de eventos e alterando apenas camada de apresentação.

## Registro de Decisões (Story 33)
- **Resumo sempre visível**: a ficha passou a ter um bloco superior permanente para identidade rápida do personagem, concentrando nome, retrato circular, estresse, consequências, destino e perícias treinadas sem alterar handlers ou eventos já existentes.
- **Abas de segundo nível na ficha**: Lore, Façanhas/Magia, Inventário e Notas foram separados em abas principais, mas continuam montados no React para preservar estado local ao alternar entre elas.
- **Paridade funcional por reaproveitamento**: `CharacterVitality`, `CharacterConsequences`, `CharacterLore`, `PowerTabsSection`, `SkillsSection`, `InventorySection` e `LinkedNotes` foram mantidos como fontes de comportamento, mudando apenas encaixe visual e navegação.
- **Atalho privado sem perda de notas antigas**: a aba de Notas Privadas abre as notas privadas por padrão, mas mantém acesso às notas gerais já existentes da ficha para cumprir a exigência de não remoção de funcionalidade.

## Registro de Decisões (Story 34)
- **Expansão orquestrada pela Arena**: o estado de abertura dos cards deixou de ser local ao `CombatCard` normal e passou a ser coordenado pela `CombatTab`, com listas independentes para heróis e ameaças.
- **Avatar como gatilho primário**: o antigo `+/-` foi substituído por um retrato circular com moldura temática, reaproveitado tanto no rail lateral compacto quanto no header do card expandido para recolhimento.
- **Pilhas independentes por lado**: cards abertos agora entram em ordem de clique abaixo do principal do respectivo lado, sem interferência cruzada entre a coluna de heróis e a de ameaças.
- **Escopo visual sem impacto de domínio**: hazards permaneceram fora do novo padrão de avatar lateral e nenhum contrato/evento de `domain.ts` precisou ser alterado, preservando Event Sourcing intacto.
- **Gaveta lateral com seta persistente**: o rail visível foi refinado para drawers ocultos na borda, revelados por hover no desktop e clique no mobile, reforçando a sensação de que os retratos “saem” das laterais da Arena.
- **Card aberto prioriza largura útil**: a grade da Arena passou a redistribuir espaço dinamicamente quando há cards expandidos, aproximando os cards abertos do centro sem comprimir excessivamente a zona de rolagem.
- **Retorno por seta no header**: quando o card está aberto, o retrato interno é suprimido em favor de um botão-seta que aponta para a lateral de origem e recolhe o card de volta ao estado oculto.
- **Resumo com perícias não nulas**: o bloco de Resumo da ficha passou a listar todas as perícias diferentes de `0`, incluindo valores negativos, preservando a leitura de penalidades mecânicas sem exigir entrada na aba completa de perícias.
- **Painel de desafio desacoplado de ameaça aberta**: a Arena agora reserva largura também quando apenas o desafio está ativo, evitando o colapso estreito do painel na ausência de adversários expandidos.
- **Privacidade da ficha inimiga para jogadores**: quando um jogador expande um inimigo na Arena, o card passa a exibir somente nome, retrato e seta de retorno; estresse, consequências, aspectos e extras seguem visíveis apenas para o GM, preservando sigilo sem remover a presença do inimigo na cena.
- **Handle externo e retratos centralizados na gaveta**: o rail lateral da Arena passou a manter apenas os avatares minimizados dentro do painel, com a seta/aba de abertura posicionada para fora da gaveta. Isso evita compressão visual dos retratos e reforça o papel do handle como controle separado do conteúdo.

## Registro de Decisões (Story 35)
- **Autoria de chat desacoplada da rolagem**: o payload de mensagem do `TextChatPanel` passou a incluir metadados de autoria (`authorRole`/`authorLabel`) para impedir que a identidade exibida no chat dependa do personagem selecionado no fluxo de rolagem.
- **Identidade fixa para GM no chat**: mensagens enviadas pelo GM usam `authorRole: "GM"` + `authorLabel: "Mestre"` para exibição determinística, enquanto `userId` permanece normalizado para transporte/comparação técnica entre clientes.
- **Renderização determinística de nome no chat**: a UI do chat passou a priorizar `authorRole`/`authorLabel` ao resolver o nome exibido, preservando fallback atual para mensagens legadas sem metadados.
- **Normalização rígida de autoria no chat**: comparações locais de autoria/histórico passaram a normalizar `userId` (`trim().toLowerCase()`) para evitar contagem de não lidas incorreta e prevenir eco/duplicidade visual por variação de casing.
- **Histórico completo para observabilidade de logs**: o frontend passou a carregar eventos com `GET /api/events/:sessionId?history=full`, garantindo que CombatLog/LogTab mantenham histórico visual após refresh e reentrada.
- **Modo full sem snapshot no payload**: no backend, quando `history=full`, o retorno omite snapshot para evitar replay duplicado em projeções quando a lista já contém todos os eventos.
- **Persistência de sessão atual por replay integral**: com histórico completo, `SESSION_NUMBER_UPDATED` é reprocessado integralmente na projeção, reduzindo risco de fallback incorreto de `sessionNumber` em fluxos de notas e filtros por sessão.
- **Cache local resiliente da timeline**: quando o backend retorna apenas delta, o frontend mantém um cache persistente por sessão (`localStorage`) e faz merge idempotente por `event.id`, evitando sumiço visual de rolagens após refresh, troca de aba/sessão ou reentrada.
- **Projeção segura com snapshot**: projeções que usam `snapshot` passaram a aplicar apenas eventos com `seq > snapshotUpToSeq` (ou `seq=0` otimista), eliminando reaplicação duplicada ao coexistirem snapshot + timeline cacheada.
- **Conformidade com convenções**: emissão de `SESSION_NUMBER_UPDATED` consolidada com `actorUserId` normalizado (`trim().toLowerCase()`), alinhando o fluxo de sessão às regras de identidade do projeto.

## Registro de Decisões (Story 36)
- **Pastas privadas como eventos próprios**: optamos por introduzir `noteFolders` separados de `Note`, com `ownerId`, `order` e `color`, para permitir subtópicos vazios, reordenação e persistência sem depender da existência de notas.
- **Fallback estrutural em `Todas`**: notas privadas sem `folderId` continuam válidas e aparecem automaticamente em `Todas`, preservando compatibilidade com histórico anterior.
- **Edição de notas de jogador via patch dedicado**: o fluxo `CHARACTER_NOTE_UPDATED` foi criado apenas para notas vinculadas de personagem, cobrindo a necessidade de edição em `Notas > Jogadores` sem refatorar todo o restante das notas vinculadas.
- **Deduplicação idempotente por `id`**: reducers de `NOTE_*` e `*_NOTE_ADDED` passaram a usar `upsert` por identificador, reduzindo risco de notas duplicadas em cenários de optimistic event, retry e replay.
- **Privacidade reforçada em exclusão/movimentação**: eventos de apagar/editar/mover notas privadas agora preservam `visibility: PLAYER_ONLY`, evitando vazamento de metadados de notas privadas durante manutenção de subtópicos.
- **Dropdown direto na visão Jogadores**: o filtro interno de `Notas > Jogadores` foi simplificado para um droplist com `Todos` + personagens, reduzindo ruído visual sem alterar o modelo de eventos.
- **Auto-menções por texto digitado**: o `MentionEditor` passou a converter automaticamente nomes digitados em spans de menção com comparação case-insensitive e confirmação leve no clique (`x` para remover, `v` para manter), mantendo o comportamento manual por `@`.
- **Persistência do HTML do editor**: o envio do diário principal passou a ler o `innerHTML` atual do editor antes de despachar `NOTE_*`, corrigindo perda de listas/marcadores quando a toolbar alterava o DOM sem atualizar o estado imediatamente.
- **Opt-out persistente de auto-menção**: ao remover uma auto-menção durante a digitação, o trecho passa a ficar explicitamente suprimido no editor para não ser religado de novo no mesmo fluxo de escrita.
- **Menções de item com efeito de inventário**: menções a `ITEM` no diário passaram a manter o cross-post atual e, adicionalmente, sincronizar uma cópia do item para o inventário do personagem-alvo, reaproveitando `CHARACTER_INVENTORY_UPDATED` e copiando nome, descrição, quantidade, bônus e imagem.
- **Manifestação de item no slot do inventário**: o modal de edição de slot passou a aceitar materialização de item global por nome exato ou por menção `ITEM` no editor rico da descrição, preenchendo automaticamente nome, descrição, quantidade, bônus e imagem sem introduzir chamadas diretas de API na UI.
- **Bônus como parte do item global**: `GlobalItem` foi expandido com `bonus` opcional (fallback 0), preservando compatibilidade com itens legados sem migração destrutiva.

## Padrões Adotados
- **Feature-based folders**: Componentes complexos (ex: `CombatCard`) têm sua própria subpasta com hooks e estilos.
- **Hook-to-Component**: Lógica de negócio é isolada em hooks customizados (ex: `use-power-tabs.ts`).
- **Global Event Store**: Um store centralizado que gerencia a fila de eventos e persistência.

## O que evitar
- Não coloque lógica de cálculo de jogo diretamente em componentes de UI. Use `gameLogic.ts`.
- Evite mutar o estado local sem despachar um evento se a ação for visível para outros jogadores.
