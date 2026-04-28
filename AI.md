---
repo: frontend
language: pt-BR
last_updated: 2026-04-28 (story-68 modo teatro com cenas/camadas/cenario inicial)
---

# Cronos Vtt — Frontend

> Sistema de Virtual Tabletop (VTT) focado em gerenciamento de sessões de RPG de mesa, inspirado em sistemas de rolagens narrativas, zonas, aspectos de cena, estresse e consequências (Fate Core/Accel). Utiliza uma arquitetura de Event Sourcing para manter a sincronia entre jogadores e mestre.

## Como usar este arquivo
Este é o ponto de entrada para agentes de IA. Leia este arquivo primeiro e nada mais.
A partir das seções abaixo, carregue apenas os arquivos relevantes para sua tarefa atual.
Mantenha o uso da janela de contexto entre 50% e 70%.

## Repositório irmão
- **Backend**: `./backend`
- Contrato de API compartilhado: `/knowledge/shared/api-contract.md`

## Mapa de arquivos críticos (ler sempre antes de qualquer tarefa)
| Arquivo | Propósito |
|---|---|
| `/knowledge/architecture.md` | Visão geral da arquitetura (Event Sourcing, Projeções) |
| `/knowledge/conventions.md` | Padrões de código, nomenclatura e estilo |
| `/knowledge/stack.md` | Tecnologias (Next.js 15, React 19, Three.js) |
| `/knowledge/ai-usage.md` | Guia de Eficiência e Redução de Custos (Ler Sempre) |

## Carregar por contexto (carregar apenas o relevante)
| Se sua tarefa envolve... | Carregue estes arquivos |
|---|---|
| Interface, layout, componentes visuais | `/knowledge/ui/styling.md`, `/knowledge/ui/components.md` |
| Autenticação e sessão | `/knowledge/auth/flow.md`, `/knowledge/shared/api-contract.md` |
| Chamadas de API e Eventos | `/knowledge/api/endpoints.md`, `/knowledge/shared/api-contract.md` |
| Regras de Jogo e Projeções | `/knowledge/architecture.md` (seção Projeções) |
| Infraestrutura e deploy | `/knowledge/infra/environments.md` |

## Épicos ativos
| Refatoração de Componentes | em andamento | `/epics/epic-01-refatoracao-modular.md` |
| Battlemap: Camadas, Formas, Edição de Fundo e Grade | planejado | `/epics/epic-03-battlemap-camadas-formas-edicao-fundo-grade.md` |
| Suporte a Múltiplos Sistemas de RPG (Plugin) | planejado | `/epics/epic-04-suporte-a-multiplos-sistemas-rpg.md` |
| Sincronização Voz WebRTC | em andamento | `/stories/story-05.md` |
| Layout Perícias Cortadas | concluído | `/stories/story-06-corrigir-layout-pericias-cortadas.md` |
| Sincronia de Notas de Sessão | concluído | `/stories/story-07-estabilizar-sincronia-notas.md` |
| Seletor Multi-Dado (Caixa) | concluído | `/stories/story-44-seletor-multi-dado-com-clear-e-notacao-viva.md` |
| Ocultar Rolagem do Mestre | concluído | `/stories/story-45-olho-ocultar-rolagem-do-mestre.md` |
| Performance Geral (Transmissão, Voz, Render) | em-revisão | `/stories/story-54-performance-transmissao-voz-e-render-cpu-100.md` |
| MusicPlayer Receiver YouTube (loop Playing/Buffering) | pronto | `/stories/story-55-musicplayer-receiver-youtube-idempotencia.md` |
| Shell Visual Ficha/Notas (GPU idle 20% fora da arena) | em-revisão | `/stories/story-56-performance-shell-visual-ficha-notas.md` |
| Nitidez de Texto na Transmissão (contentHint experimento) | em-revisão | `/stories/story-57-nitidez-texto-transmissao-content-hint.md` |
| Performance Fora da Arena por Aba (Notas, Ficha, Header) | em-revisão | `/stories/story-58-performance-abas-ficha-notas-header.md` |
| Re-renders em Cascata no Main Thread (MusicPlayer + DOM) | em-revisÃ£o | `/stories/story-59-rerender-cascata-musicplayer-main-thread.md` |
| DOM Compacto Mobile e INP Sub-200ms | em-revisao | `/stories/story-60-dom-compacto-mobile-e-inp-sub-200ms.md` |
| MusicPlayer setState fan-out + iframe YT desacoplado | concluida | `/stories/story-61-musicplayer-yt-setstate-fanout-e-iframe-desacoplado.md` |
| Estabilizar transmissao com voz em notebook fraco | aberta | `/stories/story-62-estabilizar-transmissao-voz-notebook-fraco.md` |
| Infraestrutura de Plugin de Sistema (campo system, registry, seletor) | planejada | `/stories/story-63-infraestrutura-plugin-sistema.md` |
| Extrair Fate Core como primeiro plugin | planejada | `/stories/story-64-extrair-fate-como-primeiro-plugin.md` |
| Performance — finishRoll fan-out + YouTube idle + cache sincrono | concluida | `/stories/story-66-performance-finishroll-eventstore-fanout-e-yt-idle.md` |
| Tipografia G�tico, Cor de T�tulo Separada e Tema Synthwave | proposta | /stories/story-67-tema-gotico-tipografia-cor-titulo-e-tema-synthwave-neon.md |
| Modo Teatro na Interface entre Arena e Streaming | em-revisao | /stories/story-68-modo-teatro-na-interface-entre-arena-e-streaming.md |

## Tags disponíveis no projeto
`ui` `api` `auth` `eventsourcing` `vtt` `3d` `webrtc` `componente` `fluxo` `schema` `regras` `config` `estável` `em-revisão` `deprecated`

## Arquitetura Plataforma × Sistema (LER ANTES DE QUALQUER TAREFA)

O Cronos VTT é uma **plataforma multi-sistema**. Existem duas camadas independentes:

| Camada | O que mora aqui | Onde fica no código |
|---|---|---|
| **Plataforma** (núcleo compartilhado) | Event sourcing, WebSocket, snapshot, battlemap, notas, missões, timeline, música/SFX, voz, VI, chat, imagens, sticky notes, identidade do jogador, autenticação, layout geral | `src/lib/`, `src/hooks/`, `src/app/`, `src/components/` (exceto ficha/combate/dado), backend inteiro exceto reducers de sistema |
| **Sistema** (plugin de regras de RPG) | Template de personagem, event types específicos, reducer de ações, lógica de dano/morte, ficha, combate, dado, condições/recursos | `src/systems/<id>/` (ex.: `src/systems/fate/`, `src/systems/vampire/`) |

Sistemas existentes/planejados: `fate` (Fate Core, plugin atual), `vampire` (Vampiro homebrew), futuros `dnd-5e`, `coc` etc. Cada mesa (`Session.system`) escolhe **um** plugin no momento da criação.

**Regra de bolso para classificar uma feature**: *"funciona sem saber as regras do RPG?"* → Sim = plataforma. Não = plugin de sistema específico.

Ver detalhes em `/epics/epic-04-suporte-a-multiplos-sistemas-rpg.md` e (após a story-64) `/knowledge/architecture.md` seção "Plugin de Sistema".

## Regras de comportamento para agentes

### Protocolo de Escopo de Módulo/Sistema (OBRIGATÓRIO — fazer ANTES de codar)

Antes de iniciar qualquer alteração de código ou design, a IA **deve** identificar e confirmar o escopo da mudança em relação à arquitetura plataforma × plugin. Use a árvore de decisão abaixo:

1. **Identificar o tipo de mudança**:
   - É uma **regra de RPG** (dano, atributo, ficha, dado, condição, recurso de personagem)? → provavelmente plugin.
   - É uma **ferramenta de mesa** (sincronia, UI genérica, mídia, voz, notas, mapa)? → provavelmente plataforma.
   - **Em dúvida**: trate como ambígua e pergunte.

2. **Perguntar ao humano explicitamente** antes de tocar em arquivos, usando este formato (em pt-BR):
   > "Esta mudança se aplica a: (a) **plataforma** (todos os sistemas/mesas), (b) **um plugin específico** — qual? (`fate`, `vampire`, outro), (c) **vários plugins** — quais?, ou (d) **interface `SystemPlugin`** (afeta o contrato de todos os plugins atuais e futuros)? Se eu inferi errado, me corrija antes de eu começar."
   
   Sempre proponha sua melhor inferência junto da pergunta (não jogue a decisão crua para o humano), mas **não comece a editar** sem confirmação quando o escopo não estiver explícito no pedido.

3. **Pular a pergunta apenas quando**:
   - O usuário **já indicou o escopo** explicitamente (ex.: "no plugin Fate", "para todas as mesas", "só Vampiro").
   - A story atual (`/stories/story-NN-...`) já delimita o escopo no front matter ou no objetivo.
   - A mudança é puramente cosmética/textual sem ligação com regras (ex.: typo em label genérico).

4. **Ao escrever código**, respeitar a fronteira:
   - **Nunca** importar tipos/funções de `src/systems/<id>/` em código de plataforma. Se a plataforma precisa saber de algo do sistema, vai pelo `SystemPlugin` via registry.
   - **Nunca** referenciar mecânicas Fate (stress, aspectos, fate points, perícias, consequências, refresh) fora de `src/systems/fate/`. Mesmo símbolo: vazamento de plugin = bug arquitetural.
   - Mudança que afeta **vários plugins** quase sempre é mudança na interface `SystemPlugin` — deixe isso explícito na resposta e cheque cada plugin existente.
   - Se um arquivo de plataforma **precisar** condicionar comportamento ao sistema, use `state.system` / `session.system` e delegue ao plugin; nunca faça `if (system === "fate")` na plataforma.

5. **Ao concluir**, registrar no resumo final qual escopo foi tocado: `escopo: plataforma` | `escopo: plugin/<id>` | `escopo: interface SystemPlugin + plugins [...]`. Isso entra no commit/PR e na atualização de `last_updated`.

> **Nota para mesas legadas**: sessões sem `system` definido são tratadas como `fate` por compatibilidade (ver epic-04). Mudanças "globais em Fate" hoje afetam essas mesas — confirme se é intencional.

### Regras de Navegação Estrita (CRÍTICO)
1. **Nunca faça varredura cega**: Não utilize `grep` global ou `list_dir` recursivo sem um objetivo específico baseado na tarefa. Use o Knowledge Graph (`/knowledge`) primeiro.
2. **Protocolo de Carregamento**: Antes de carregar o conteúdo de um arquivo `.md`, leia apenas os primeiros 150 caracteres para validar a `description` no YAML Front Matter. Só carregue o arquivo completo se ele for estritamente necessário.
3. **Limite de Contexto**: Mantenha o uso da janela de contexto entre **50% e 70%**. Se precisar carregar mais de 3 arquivos grandes (>500 linhas), **pergunte ao humano primeiro**.
4. **Foco no Escopo**: Não modifique arquivos fora do escopo descrito na história atual em `/stories`. Se precisar fazer uma alteração "cross-file", registre a necessidade no `AI.md` primeiro.
5. **Atualização Reativa**: Ao concluir, atualize `last_updated` e registre decisões em `/knowledge/architecture.md`.

